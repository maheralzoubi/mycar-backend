import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Driver, DriverSchema } from './schemas/driver.schema';
import {
  ServiceRequest,
  ServiceRequestSchema,
} from '../service-requests/schemas/service-request.schema';
import { RealtimeModule } from '../realtime/realtime.module';
import { DriversService } from './drivers.service';
import { DriversController } from './drivers.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Driver.name, schema: DriverSchema },
      { name: ServiceRequest.name, schema: ServiceRequestSchema },
    ]),
    forwardRef(() => RealtimeModule),
  ],
  providers: [DriversService],
  controllers: [DriversController],
  exports: [DriversService],
})
export class DriversModule {}
