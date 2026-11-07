import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { access, unlink } from 'fs/promises';
import { ServiceRequest, ServiceRequestDocument } from './schemas/service-request.schema';
import { CreateRequestDto } from './dto/create-request.dto';
import { RateDto } from './dto/rate.dto';
import {
  LEGAL_STATUS_TRANSITIONS,
  RequestStatus,
} from '../common/enums/request-status.enum';
import { PRICE_PER_KM, SERVICE_CATALOG, ServiceType } from '../common/enums/service-type.enum';
import { DriversService } from '../drivers/drivers.service';
import { UsersService } from '../users/users.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PushNotificationsService } from '../notifications/push-notifications.service';
import { toRequestResponse } from './service-requests.mapper';
import { toPublicDriver } from '../drivers/drivers.mapper';
import { hasImageSignature, ownedPhotoPath, requestPhotoUrl } from './request-photos';

const STATUS_PUSH_TEXT: Partial<Record<RequestStatus, string>> = {
  [RequestStatus.DRIVER_EN_ROUTE]: 'Your driver is on the way',
  [RequestStatus.ARRIVED]: 'Your driver has arrived',
  [RequestStatus.IN_PROGRESS]: 'Your service has started',
  [RequestStatus.COMPLETED]: 'Your service is complete',
};

const DEFAULT_DISTANCE_KM = 3.0;

@Injectable()
export class ServiceRequestsService {
  constructor(
    @InjectModel(ServiceRequest.name)
    private readonly requestModel: Model<ServiceRequestDocument>,
    private readonly driversService: DriversService,
    private readonly usersService: UsersService,
    private readonly dispatchService: DispatchService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly pushNotifications: PushNotificationsService,
  ) {}

  async estimatePrice(serviceType: ServiceType, location: { lat: number; lng: number }) {
    const catalog = SERVICE_CATALOG[serviceType];
    const nearest = await this.driversService.findNearestOnline(location, [], 1);
    const distanceKm = nearest[0]?.distanceKm ?? DEFAULT_DISTANCE_KM;
    return {
      estimatedPrice: Math.round((catalog.basePrice + distanceKm * PRICE_PER_KM) * 100) / 100,
      estimatedMinutes: catalog.etaMinutes,
    };
  }

  /**
   * Accepts photos multer has already stored under the customer's folder and
   * returns their URLs for `create`. If any file isn't really the image type
   * it claims to be, the whole batch is deleted and rejected.
   */
  async uploadPhotos(customerId: string, files: Express.Multer.File[]) {
    if (files.length === 0) {
      throw new BadRequestException('At least one photo is required');
    }
    const valid = await Promise.all(
      files.map((file) => hasImageSignature(file.path, file.mimetype).catch(() => false)),
    );
    if (valid.includes(false)) {
      await Promise.all(files.map((file) => unlink(file.path).catch(() => undefined)));
      throw new BadRequestException('One or more photos are not valid images');
    }
    return { photoUrls: files.map((file) => requestPhotoUrl(customerId, file.filename)) };
  }

  /** Rejects photo URLs this customer didn't upload or that no longer exist. */
  private async checkPhotoUrls(customerId: string, photoUrls: string[]) {
    for (const url of photoUrls) {
      const path = ownedPhotoPath(url, customerId);
      const exists = path !== null && (await access(path).then(() => true, () => false));
      if (!exists) {
        throw new BadRequestException(`Unknown photo: ${url}`);
      }
    }
    return photoUrls;
  }

  async create(customerId: string, dto: CreateRequestDto) {
    const photoUrls = await this.checkPhotoUrls(customerId, dto.photoUrls ?? []);
    const { estimatedPrice, estimatedMinutes } = await this.estimatePrice(
      dto.serviceType,
      dto.location,
    );

    const request = await this.requestModel.create({
      customerId,
      serviceType: dto.serviceType,
      pickupLocation: dto.location,
      pickupAddress: dto.address,
      notes: dto.notes ?? null,
      photoUrls,
      estimatedPrice,
      estimatedMinutes,
      status: RequestStatus.SEARCHING,
    });

    await this.dispatchService.broadcast(request);
    const response = await this.toResponse(request);
    this.realtimeGateway.emitToAdmins('admin:request-created', response);
    return response;
  }

  async findByIdForCustomer(id: string, customerId: string) {
    const request = await this.findOrThrow(id);
    if (request.customerId.toString() !== customerId) {
      throw new ForbiddenException('Not your request');
    }
    return this.toResponse(request);
  }

  async history(customerId: string) {
    const requests = await this.requestModel
      .find({ customerId })
      .sort({ createdAt: -1 })
      .exec();
    return Promise.all(requests.map((r) => this.toResponse(r)));
  }

  async cancel(id: string, customerId: string) {
    const request = await this.findOrThrow(id);
    if (request.customerId.toString() !== customerId) {
      throw new ForbiddenException('Not your request');
    }
    if ([RequestStatus.COMPLETED, RequestStatus.CANCELLED].includes(request.status)) {
      throw new BadRequestException(`Cannot cancel a ${request.status} request`);
    }

    this.dispatchService.cancel(id);
    request.status = RequestStatus.CANCELLED;
    request.cancelledAt = new Date();
    await request.save();

    if (request.driverId) {
      this.realtimeGateway.emitToDriver(request.driverId.toString(), 'status-changed', {
        requestId: id,
        status: RequestStatus.CANCELLED,
      });
    }
    const response = await this.toResponse(request);
    this.realtimeGateway.emitToAdmins('admin:request-updated', response);
    return response;
  }

  async rate(id: string, customerId: string, dto: RateDto) {
    const request = await this.findOrThrow(id);
    if (request.customerId.toString() !== customerId) {
      throw new ForbiddenException('Not your request');
    }
    if (request.status !== RequestStatus.COMPLETED) {
      throw new BadRequestException('Can only rate a completed request');
    }
    request.rating = dto.stars;
    request.review = dto.review ?? null;
    await request.save();
    return this.toResponse(request);
  }

  async accept(id: string, driverId: string) {
    const updated = await this.requestModel
      .findOneAndUpdate(
        { _id: id, status: RequestStatus.SEARCHING, driverId: null },
        { status: RequestStatus.DRIVER_ASSIGNED, driverId, acceptedAt: new Date() },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new ConflictException('Request already taken or no longer available');
    }

    this.dispatchService.cancel(id);
    const others = this.dispatchService
      .consumeBroadcastedDrivers(id)
      .filter((otherId) => otherId !== driverId);
    for (const otherId of others) {
      this.realtimeGateway.emitToDriver(otherId, 'job-taken-by-other', { requestId: id });
    }

    const driver = await this.driversService.findById(driverId);
    this.realtimeGateway.emitToCustomer(updated.customerId.toString(), 'driver-assigned', {
      requestId: id,
      driver: driver ? toPublicDriver(driver) : null,
      driverLocation: driver?.currentLocation ?? null,
    });

    const customer = await this.usersService.findById(updated.customerId.toString());
    void this.pushNotifications.sendToToken(
      customer?.fcmToken,
      { title: 'Driver assigned', body: `${driver?.name ?? 'A driver'} is heading your way` },
      { type: 'driver-assigned', requestId: id },
    );

    const response = await this.toResponse(updated);
    this.realtimeGateway.emitToAdmins('admin:request-updated', response);
    return response;
  }

  async decline(id: string, driverId: string) {
    const updated = await this.requestModel
      .findByIdAndUpdate(
        id,
        { $addToSet: { declinedByDriverIds: driverId } },
        { new: true },
      )
      .exec();
    if (!updated) throw new NotFoundException('Request not found');

    if (updated.status === RequestStatus.SEARCHING) {
      this.dispatchService.cancel(id);
      await this.dispatchService.broadcast(updated, 1);
    }
    return { ok: true };
  }

  async updateStatus(
    id: string,
    driverId: string,
    status: RequestStatus,
    cashCollected?: boolean,
  ) {
    const request = await this.findOrThrow(id);
    if (request.driverId?.toString() !== driverId) {
      throw new ForbiddenException('Not your job');
    }
    const legal = LEGAL_STATUS_TRANSITIONS[request.status] ?? [];
    if (!legal.includes(status)) {
      throw new BadRequestException(`Cannot transition from ${request.status} to ${status}`);
    }
    if (status === RequestStatus.COMPLETED && !cashCollected) {
      throw new BadRequestException(
        'Confirm cash collection from the customer before completing the job',
      );
    }

    request.status = status;
    if (status === RequestStatus.COMPLETED) {
      request.completedAt = new Date();
      request.finalPrice = request.finalPrice ?? request.estimatedPrice;
      request.cashCollected = true;
      await this.driversService.incrementCompletedJobs(driverId);
    }
    if (status === RequestStatus.CANCELLED) {
      request.cancelledAt = new Date();
    }
    await request.save();

    this.realtimeGateway.emitToCustomer(request.customerId.toString(), 'status-changed', {
      requestId: id,
      status,
    });

    const pushText = STATUS_PUSH_TEXT[status];
    if (pushText) {
      const customer = await this.usersService.findById(request.customerId.toString());
      void this.pushNotifications.sendToToken(
        customer?.fcmToken,
        { title: 'Job update', body: pushText },
        { type: 'status-changed', requestId: id, status },
      );
    }

    const response = await this.toResponse(request);
    this.realtimeGateway.emitToAdmins('admin:request-updated', response);
    return response;
  }

  private async findOrThrow(id: string) {
    const request = await this.requestModel.findById(id).exec();
    if (!request) throw new NotFoundException('Request not found');
    return request;
  }

  private async toResponse(request: ServiceRequestDocument) {
    const [driver, customer] = await Promise.all([
      request.driverId ? this.driversService.findById(request.driverId.toString()) : null,
      this.usersService.findById(request.customerId.toString()),
    ]);
    return toRequestResponse(request, driver, customer);
  }
}
