import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DriversService } from '../drivers/drivers.service';
import { UsersService } from '../users/users.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PushNotificationsService } from '../notifications/push-notifications.service';
import { SERVICE_TYPE_LABELS } from '../common/enums/service-type.enum';
import { RequestStatus } from '../common/enums/request-status.enum';
import {
  ServiceRequest,
  ServiceRequestDocument,
} from '../service-requests/schemas/service-request.schema';

const NEAREST_DRIVER_LIMIT = 5;
const OFFER_TIMEOUT_MS = 25_000;
const MAX_BROADCAST_ATTEMPTS = 2;

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly lastBroadcast = new Map<string, string[]>();

  constructor(
    @InjectModel(ServiceRequest.name)
    private readonly requestModel: Model<ServiceRequestDocument>,
    private readonly driversService: DriversService,
    private readonly usersService: UsersService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly pushNotifications: PushNotificationsService,
  ) {}

  async broadcast(request: ServiceRequestDocument, attempt = 1) {
    const nearby = await this.driversService.findNearestOnline(
      request.pickupLocation,
      request.declinedByDriverIds,
      NEAREST_DRIVER_LIMIT,
    );

    if (nearby.length === 0) {
      this.logger.log(`No online drivers available for request ${request._id.toString()}`);
      return;
    }

    this.lastBroadcast.set(
      request._id.toString(),
      nearby.map((n) => n.driver._id.toString()),
    );

    const customer = await this.usersService.findById(request.customerId.toString());

    for (const { driver, distanceKm } of nearby) {
      const requestId = request._id.toString();
      this.realtimeGateway.emitToDriver(driver._id.toString(), 'new-job-available', {
        requestId,
        serviceType: request.serviceType,
        customerName: customer?.name ?? 'Customer',
        customerPhone: customer?.phone ?? '',
        customerAddress: request.pickupAddress,
        pickupLocation: request.pickupLocation,
        distanceKm,
        price: request.estimatedPrice,
        expiresInSeconds: OFFER_TIMEOUT_MS / 1000,
      });

      void this.pushNotifications.sendToToken(
        driver.fcmToken,
        {
          title: 'New job request',
          body: `${SERVICE_TYPE_LABELS[request.serviceType]} — ${distanceKm.toFixed(1)} km away, $${request.estimatedPrice.toFixed(2)}`,
        },
        { type: 'new-job-available', requestId },
      );
    }

    if (attempt < MAX_BROADCAST_ATTEMPTS) {
      this.scheduleTimeout(
        request._id.toString(),
        nearby.map((n) => n.driver._id),
        attempt + 1,
      );
    }
  }

  cancel(requestId: string) {
    const timer = this.timers.get(requestId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(requestId);
    }
  }

  consumeBroadcastedDrivers(requestId: string): string[] {
    const ids = this.lastBroadcast.get(requestId) ?? [];
    this.lastBroadcast.delete(requestId);
    return ids;
  }

  private scheduleTimeout(
    requestId: string,
    broadcastedDriverIds: Types.ObjectId[],
    nextAttempt: number,
  ) {
    this.cancel(requestId);
    const timer = setTimeout(async () => {
      const current = await this.requestModel.findById(requestId).exec();
      if (!current || current.status !== RequestStatus.SEARCHING) return;

      current.declinedByDriverIds.push(...broadcastedDriverIds);
      await current.save();
      await this.broadcast(current, nextAttempt);
    }, OFFER_TIMEOUT_MS);
    this.timers.set(requestId, timer);
  }
}
