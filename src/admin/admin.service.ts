import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ServiceRequest,
  ServiceRequestDocument,
} from '../service-requests/schemas/service-request.schema';
import { DriverDocument } from '../drivers/schemas/driver.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { DriversService } from '../drivers/drivers.service';
import { UsersService } from '../users/users.service';
import { toAdminDriverView } from '../drivers/drivers.mapper';
import { toAdminUserView } from '../users/users.mapper';
import { ACTIVE_REQUEST_STATUSES, RequestStatus } from '../common/enums/request-status.enum';
import { startOfMonth, startOfToday, startOfWeek, sumSince } from '../common/utils/period.util';
import { AdminRequestsQuery } from './dto/admin-requests-query.dto';

const amountOf = (r: ServiceRequestDocument) => r.finalPrice ?? r.estimatedPrice;
const completedAtOf = (r: ServiceRequestDocument) => r.completedAt;

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(ServiceRequest.name)
    private readonly requestModel: Model<ServiceRequestDocument>,
    private readonly driversService: DriversService,
    private readonly usersService: UsersService,
  ) {}

  async overview() {
    const [totalCustomers, totalDrivers, onlineDrivers, activeJobs, completedRequests] =
      await Promise.all([
        this.usersService.count(),
        this.driversService.count(),
        this.driversService.countOnline(),
        this.requestModel.countDocuments({ status: { $in: ACTIVE_REQUEST_STATUSES } }).exec(),
        this.requestModel.find({ status: RequestStatus.COMPLETED }).exec(),
      ]);

    return {
      totalCustomers,
      totalDrivers,
      onlineDrivers,
      activeJobs,
      totalCompletedJobs: completedRequests.length,
      totalRevenue: completedRequests.reduce((sum, r) => sum + amountOf(r), 0),
      todayRevenue: sumSince(completedRequests, startOfToday(), completedAtOf, amountOf),
      weekRevenue: sumSince(completedRequests, startOfWeek(), completedAtOf, amountOf),
      monthRevenue: sumSince(completedRequests, startOfMonth(), completedAtOf, amountOf),
    };
  }

  async drivers() {
    const drivers = await this.driversService.findAll();
    return drivers.map(toAdminDriverView);
  }

  async suspendDriver(id: string, isSuspended: boolean) {
    const driver = await this.driversService.setSuspended(id, isSuspended);
    if (!driver) throw new NotFoundException('Driver not found');
    return toAdminDriverView(driver);
  }

  async pendingDrivers() {
    const drivers = await this.driversService.findPending();
    return drivers.map(toAdminDriverView);
  }

  async approveDriver(id: string) {
    const driver = await this.driversService.setVerificationStatus(id, 'approved');
    if (!driver) throw new NotFoundException('Driver not found');
    return toAdminDriverView(driver);
  }

  async rejectDriver(id: string, reason?: string) {
    const driver = await this.driversService.setVerificationStatus(id, 'rejected', reason);
    if (!driver) throw new NotFoundException('Driver not found');
    return toAdminDriverView(driver);
  }

  async customers() {
    const users = await this.usersService.findAll();
    return users.map(toAdminUserView);
  }

  async serviceRequests(query: AdminRequestsQuery) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.serviceType) filter.serviceType = query.serviceType;
    if (query.active === 'true') filter.status = { $in: ACTIVE_REQUEST_STATUSES };
    if (query.from || query.to) {
      const createdAt: Record<string, Date> = {};
      if (query.from) createdAt.$gte = new Date(query.from);
      if (query.to) createdAt.$lte = new Date(query.to);
      filter.createdAt = createdAt;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await Promise.all([
      this.requestModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('customerId')
        .populate('driverId')
        .exec(),
      this.requestModel.countDocuments(filter).exec(),
    ]);

    return {
      items: items.map((r) => this.toAdminRequestView(r)),
      total,
      page,
      limit,
    };
  }

  async requestDetail(id: string) {
    const request = await this.requestModel
      .findById(id)
      .populate('customerId')
      .populate('driverId')
      .exec();
    if (!request) throw new NotFoundException('Request not found');
    return this.toAdminRequestView(request);
  }

  async revenue(days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const rows = await this.requestModel
      .aggregate<{ _id: string; total: number; count: number }>([
        { $match: { status: RequestStatus.COMPLETED, completedAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
            total: { $sum: { $ifNull: ['$finalPrice', '$estimatedPrice'] } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .exec();

    return rows.map((r) => ({ date: r._id, total: r.total, count: r.count }));
  }

  async leaderboard(limit: number) {
    const rows = await this.requestModel
      .aggregate<{ _id: string; totalEarnings: number; completedJobs: number }>([
        { $match: { status: RequestStatus.COMPLETED, driverId: { $ne: null } } },
        {
          $group: {
            _id: '$driverId',
            totalEarnings: { $sum: { $ifNull: ['$finalPrice', '$estimatedPrice'] } },
            completedJobs: { $sum: 1 },
          },
        },
        { $sort: { totalEarnings: -1 } },
        { $limit: limit },
      ])
      .exec();

    const drivers = await this.driversService.findByIds(rows.map((r) => r._id));
    const byId = new Map(drivers.map((d) => [d._id.toString(), d]));

    return rows.map((r) => {
      const driver = byId.get(r._id.toString());
      return {
        driverId: r._id.toString(),
        name: driver?.name ?? 'Unknown',
        rating: driver?.rating ?? 0,
        vehicleType: driver?.vehicleType ?? null,
        totalEarnings: r.totalEarnings,
        completedJobs: r.completedJobs,
      };
    });
  }

  private toAdminRequestView(request: ServiceRequestDocument) {
    const customer = request.customerId as unknown as UserDocument | null;
    const driver = request.driverId as unknown as DriverDocument | null;

    return {
      id: request._id.toString(),
      status: request.status,
      serviceType: request.serviceType,
      pickupLocation: request.pickupLocation,
      pickupAddress: request.pickupAddress,
      estimatedPrice: request.estimatedPrice,
      finalPrice: request.finalPrice,
      driverLocation: request.driverLocation,
      notes: request.notes,
      rating: request.rating,
      review: request.review,
      paymentMethod: request.paymentMethod,
      cashCollected: request.cashCollected,
      customer: customer
        ? {
            id: customer._id.toString(),
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
          }
        : null,
      driver: driver
        ? {
            id: driver._id.toString(),
            name: driver.name,
            phone: driver.phone,
            vehicleType: driver.vehicleType,
            vehiclePlate: driver.vehiclePlate,
          }
        : null,
      createdAt: (request as unknown as { createdAt: Date }).createdAt,
      acceptedAt: request.acceptedAt,
      completedAt: request.completedAt,
      cancelledAt: request.cancelledAt,
    };
  }
}
