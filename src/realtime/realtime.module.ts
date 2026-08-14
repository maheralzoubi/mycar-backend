import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DriversModule } from '../drivers/drivers.module';
import {
  ServiceRequest,
  ServiceRequestSchema,
} from '../service-requests/schemas/service-request.schema';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [
    forwardRef(() => DriversModule),
    MongooseModule.forFeature([{ name: ServiceRequest.name, schema: ServiceRequestSchema }]),
  ],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
