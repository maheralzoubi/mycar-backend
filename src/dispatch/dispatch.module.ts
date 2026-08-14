import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DriversModule } from '../drivers/drivers.module';
import { UsersModule } from '../users/users.module';
import { RealtimeModule } from '../realtime/realtime.module';
import {
  ServiceRequest,
  ServiceRequestSchema,
} from '../service-requests/schemas/service-request.schema';
import { DispatchService } from './dispatch.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ServiceRequest.name, schema: ServiceRequestSchema }]),
    DriversModule,
    UsersModule,
    RealtimeModule,
  ],
  providers: [DispatchService],
  exports: [DispatchService],
})
export class DispatchModule {}
