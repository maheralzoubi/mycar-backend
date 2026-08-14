import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { RequestStatus } from '../../common/enums/request-status.enum';
import { ServiceType } from '../../common/enums/service-type.enum';

export type ServiceRequestDocument = ServiceRequest & Document<Types.ObjectId>;

@Schema({ _id: false })
class LocationPoint {
  @Prop({ required: true })
  lat: number;

  @Prop({ required: true })
  lng: number;
}

@Schema({ timestamps: true })
export class ServiceRequest {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Driver', default: null, index: true })
  driverId: Types.ObjectId | null;

  @Prop({ type: String, enum: Object.values(ServiceType), required: true })
  serviceType: ServiceType;

  @Prop({ type: LocationPoint, required: true })
  pickupLocation: LocationPoint;

  @Prop({ required: true })
  pickupAddress: string;

  @Prop({ type: LocationPoint, default: null })
  dropoffLocation: LocationPoint | null;

  @Prop({ required: true })
  estimatedPrice: number;

  @Prop({ type: Number, default: null })
  finalPrice: number | null;

  @Prop({ required: true })
  estimatedMinutes: number;

  @Prop({
    type: String,
    enum: Object.values(RequestStatus),
    default: RequestStatus.SEARCHING,
    index: true,
  })
  status: RequestStatus;

  @Prop({ type: LocationPoint, default: null })
  driverLocation: LocationPoint | null;

  @Prop({ type: String, default: null })
  notes: string | null;

  @Prop({ type: [String], default: [] })
  photoUrls: string[];

  @Prop({ type: Number, default: null })
  rating: number | null;

  @Prop({ type: String, default: null })
  review: string | null;

  @Prop({ type: [Types.ObjectId], ref: 'Driver', default: [] })
  declinedByDriverIds: Types.ObjectId[];

  @Prop({ type: Date, default: null })
  acceptedAt: Date | null;

  @Prop({ type: Date, default: null })
  completedAt: Date | null;

  @Prop({ type: Date, default: null })
  cancelledAt: Date | null;

  @Prop({ type: String, enum: ['cash'], default: 'cash' })
  paymentMethod: 'cash';

  @Prop({ type: Boolean, default: false })
  cashCollected: boolean;
}

export const ServiceRequestSchema = SchemaFactory.createForClass(ServiceRequest);
ServiceRequestSchema.index({ status: 1, createdAt: -1 });
