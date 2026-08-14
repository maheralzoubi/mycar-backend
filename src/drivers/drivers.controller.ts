import { Controller, ForbiddenException, Get, NotFoundException, Patch, Post, Body, UseGuards, UseInterceptors, UploadedFiles, BadRequestException } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/types/jwt-payload.type';
import { DriversService } from './drivers.service';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateFcmTokenDto } from './dto/update-fcm-token.dto';
import { toDriverProfile } from './drivers.mapper';
import {
  ServiceRequest,
  ServiceRequestDocument,
} from '../service-requests/schemas/service-request.schema';
import { RequestStatus } from '../common/enums/request-status.enum';
import { startOfMonth, startOfToday, startOfWeek, sumSince } from '../common/utils/period.util';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { driverDocsStorage, imageFileFilter } from '../common/config/multer.config';

@Controller('drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('driver')
export class DriversController {
  constructor(
    private readonly driversService: DriversService,
    private readonly realtimeGateway: RealtimeGateway,
    @InjectModel(ServiceRequest.name)
    private readonly requestModel: Model<ServiceRequestDocument>,
  ) {}

  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    const driver = await this.driversService.findById(user.sub);
    if (!driver) throw new NotFoundException('Driver not found');
    return toDriverProfile(driver);
  }

  @Patch('me/status')
  async updateStatus(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateStatusDto,
  ) {
    if (dto.isOnline) {
      const current = await this.driversService.findById(user.sub);
      if (!current) throw new NotFoundException('Driver not found');
      if (current.isSuspended) {
        throw new ForbiddenException('Your account has been suspended');
      }
      if (current.verificationStatus !== 'approved') {
        throw new ForbiddenException(
          current.verificationStatus === 'rejected'
            ? `Your documents were rejected: ${current.rejectionReason ?? 'no reason given'}`
            : 'Your account is still pending verification',
        );
      }
    }
    const driver = await this.driversService.setOnlineStatus(user.sub, dto.isOnline);
    if (!driver) throw new NotFoundException('Driver not found');
    this.realtimeGateway.emitToAdmins('admin:driver-status-changed', {
      driverId: driver._id.toString(),
      isOnline: driver.isOnline,
    });
    return toDriverProfile(driver);
  }

  @Post('me/documents')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'licensePhoto', maxCount: 1 },
        { name: 'vehicleRegistrationPhoto', maxCount: 1 },
      ],
      { storage: driverDocsStorage, fileFilter: imageFileFilter, limits: { fileSize: 10 * 1024 * 1024 } },
    ),
  )
  async uploadDocuments(
    @CurrentUser() user: JwtPayload,
    @UploadedFiles()
    files: {
      licensePhoto?: Express.Multer.File[];
      vehicleRegistrationPhoto?: Express.Multer.File[];
    },
  ) {
    const licensePhoto = files.licensePhoto?.[0];
    const vehicleRegistrationPhoto = files.vehicleRegistrationPhoto?.[0];
    if (!licensePhoto && !vehicleRegistrationPhoto) {
      throw new BadRequestException('At least one document is required');
    }

    const driver = await this.driversService.uploadDocuments(user.sub, {
      licensePhotoUrl: licensePhoto ? `/uploads/driver-docs/${licensePhoto.filename}` : undefined,
      vehicleRegistrationPhotoUrl: vehicleRegistrationPhoto
        ? `/uploads/driver-docs/${vehicleRegistrationPhoto.filename}`
        : undefined,
    });
    if (!driver) throw new NotFoundException('Driver not found');
    return toDriverProfile(driver);
  }

  @Post('me/fcm-token')
  async updateFcmToken(@CurrentUser() user: JwtPayload, @Body() dto: UpdateFcmTokenDto) {
    await this.driversService.setFcmToken(user.sub, dto.token);
    return { ok: true };
  }

  @Post('me/location')
  async updateLocation(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateLocationDto,
  ) {
    await this.driversService.updateLocation(user.sub, dto.lat, dto.lng);
    return { ok: true };
  }

  @Get('me/earnings')
  async earnings(@CurrentUser() user: JwtPayload) {
    const completedJobs = await this.requestModel
      .find({ driverId: user.sub, status: RequestStatus.COMPLETED })
      .sort({ completedAt: -1 })
      .exec();

    const amountOf = (job: ServiceRequestDocument) => job.finalPrice ?? job.estimatedPrice;
    const dateOf = (job: ServiceRequestDocument) => job.completedAt;

    const balance = completedJobs.reduce((sum, job) => sum + amountOf(job), 0);

    return {
      balance,
      todayEarnings: sumSince(completedJobs, startOfToday(), dateOf, amountOf),
      weekEarnings: sumSince(completedJobs, startOfWeek(), dateOf, amountOf),
      monthEarnings: sumSince(completedJobs, startOfMonth(), dateOf, amountOf),
      completedJobs: completedJobs.map((job) => ({
        id: job._id.toString(),
        serviceType: job.serviceType,
        customerAddress: job.pickupAddress,
        price: job.finalPrice ?? job.estimatedPrice,
        completedAt: job.completedAt,
      })),
    };
  }
}
