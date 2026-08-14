import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Driver, DriverDocument } from './schemas/driver.schema';
import { haversineKm } from '../common/utils/geo.util';

export interface NearbyDriver {
  driver: DriverDocument;
  distanceKm: number;
}

@Injectable()
export class DriversService {
  constructor(
    @InjectModel(Driver.name) private driverModel: Model<DriverDocument>,
  ) {}

  findByEmail(email: string) {
    return this.driverModel.findOne({ email: email.toLowerCase() }).exec();
  }

  findById(id: string) {
    return this.driverModel.findById(id).exec();
  }

  create(data: {
    email: string;
    passwordHash: string;
    name: string;
    phone: string;
    vehicleType: string;
    vehiclePlate: string;
    licenseNumber: string;
  }) {
    return this.driverModel.create(data);
  }

  async uploadDocuments(
    driverId: string,
    files: { licensePhotoUrl?: string; vehicleRegistrationPhotoUrl?: string },
  ) {
    const update: Record<string, string> = {};
    if (files.licensePhotoUrl) update.licensePhotoUrl = files.licensePhotoUrl;
    if (files.vehicleRegistrationPhotoUrl) {
      update.vehicleRegistrationPhotoUrl = files.vehicleRegistrationPhotoUrl;
    }
    return this.driverModel.findByIdAndUpdate(driverId, update, { new: true }).exec();
  }

  async setVerificationStatus(
    driverId: string,
    status: 'approved' | 'rejected',
    reason?: string,
  ) {
    return this.driverModel
      .findByIdAndUpdate(
        driverId,
        {
          verificationStatus: status,
          rejectionReason: status === 'rejected' ? (reason ?? null) : null,
        },
        { new: true },
      )
      .exec();
  }

  async setFcmToken(driverId: string, fcmToken: string) {
    return this.driverModel.findByIdAndUpdate(driverId, { fcmToken }, { new: true }).exec();
  }

  findPending() {
    return this.driverModel.find({ verificationStatus: 'pending' }).sort({ createdAt: 1 }).exec();
  }

  async setOnlineStatus(driverId: string, isOnline: boolean) {
    return this.driverModel
      .findByIdAndUpdate(driverId, { isOnline }, { new: true })
      .exec();
  }

  async setOffline(driverId: Types.ObjectId | string) {
    return this.driverModel
      .findByIdAndUpdate(driverId, { isOnline: false, socketId: null }, { new: true })
      .exec();
  }

  async setOfflineBySocketId(socketId: string) {
    return this.driverModel
      .findOneAndUpdate({ socketId }, { isOnline: false, socketId: null }, { new: true })
      .exec();
  }

  async setSocketId(driverId: string, socketId: string) {
    return this.driverModel
      .findByIdAndUpdate(driverId, { socketId }, { new: true })
      .exec();
  }

  async updateLocation(driverId: string, lat: number, lng: number) {
    return this.driverModel
      .findByIdAndUpdate(
        driverId,
        { currentLocation: { lat, lng } },
        { new: true },
      )
      .exec();
  }

  async incrementCompletedJobs(driverId: Types.ObjectId | string) {
    return this.driverModel
      .findByIdAndUpdate(driverId, { $inc: { totalJobs: 1 } }, { new: true })
      .exec();
  }

  async setSuspended(driverId: string, isSuspended: boolean) {
    return this.driverModel
      .findByIdAndUpdate(
        driverId,
        isSuspended
          ? { isSuspended: true, isOnline: false, socketId: null }
          : { isSuspended: false },
        { new: true },
      )
      .exec();
  }

  findAll() {
    return this.driverModel.find().sort({ createdAt: -1 }).exec();
  }

  count() {
    return this.driverModel.countDocuments().exec();
  }

  countOnline() {
    return this.driverModel.countDocuments({ isOnline: true }).exec();
  }

  findByIds(ids: (Types.ObjectId | string)[]) {
    return this.driverModel.find({ _id: { $in: ids } }).exec();
  }

  async findNearestOnline(
    point: { lat: number; lng: number },
    excludeIds: (Types.ObjectId | string)[],
    limit: number,
  ): Promise<NearbyDriver[]> {
    const excludeStrings = excludeIds.map((id) => id.toString());
    const candidates = await this.driverModel
      .find({ isOnline: true, currentLocation: { $ne: null } })
      .exec();

    return candidates
      .filter((d) => !excludeStrings.includes(d._id.toString()))
      .map((driver) => ({
        driver,
        distanceKm: haversineKm(point, driver.currentLocation as { lat: number; lng: number }),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);
  }
}
