import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DriverDocument = Driver & Document<Types.ObjectId>;

export type VerificationStatus = 'pending' | 'approved' | 'rejected';

@Schema({ _id: false })
class LocationPoint {
  @Prop({ required: true })
  lat: number;

  @Prop({ required: true })
  lng: number;
}

@Schema({ timestamps: true })
export class Driver {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  vehicleType: string;

  @Prop({ required: true })
  vehiclePlate: string;

  @Prop({ default: 5 })
  rating: number;

  @Prop({ default: 0 })
  totalJobs: number;

  @Prop({ default: false })
  isOnline: boolean;

  @Prop({ default: false })
  isSuspended: boolean;

  @Prop({ type: LocationPoint, default: null })
  currentLocation: LocationPoint | null;

  @Prop({ type: String, default: null })
  socketId: string | null;

  @Prop({ type: String, default: null })
  fcmToken: string | null;

  @Prop({ required: true })
  licenseNumber: string;

  @Prop({ type: String, default: null })
  licensePhotoUrl: string | null;

  @Prop({ type: String, default: null })
  vehicleRegistrationPhotoUrl: string | null;

  @Prop({ type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' })
  verificationStatus: VerificationStatus;

  @Prop({ type: String, default: null })
  rejectionReason: string | null;
}

export const DriverSchema = SchemaFactory.createForClass(Driver);
