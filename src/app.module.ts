import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config/configuration';
import { HealthController } from './health/health.controller';
import { UsersModule } from './users/users.module';
import { DriversModule } from './drivers/drivers.module';
import { AuthModule } from './auth/auth.module';
import { GeocodingModule } from './geocoding/geocoding.module';
import { RealtimeModule } from './realtime/realtime.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { ServiceRequestsModule } from './service-requests/service-requests.module';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    NotificationsModule,
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('mongoUri'),
      }),
    }),
    UsersModule,
    DriversModule,
    AuthModule,
    GeocodingModule,
    RealtimeModule,
    DispatchModule,
    ServiceRequestsModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
