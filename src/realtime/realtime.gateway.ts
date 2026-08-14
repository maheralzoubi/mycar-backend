import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { DriversService } from '../drivers/drivers.service';
import { JwtPayload } from '../common/types/jwt-payload.type';
import { RequestStatus } from '../common/enums/request-status.enum';
import {
  ServiceRequest,
  ServiceRequestDocument,
} from '../service-requests/schemas/service-request.schema';

const ACTIVE_STATUSES = [
  RequestStatus.DRIVER_ASSIGNED,
  RequestStatus.DRIVER_EN_ROUTE,
  RequestStatus.ARRIVED,
  RequestStatus.IN_PROGRESS,
];

@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly socketUsers = new Map<string, JwtPayload>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly driversService: DriversService,
    @InjectModel(ServiceRequest.name)
    private readonly requestModel: Model<ServiceRequestDocument>,
  ) {}

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      client.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      this.socketUsers.set(client.id, payload);

      if (payload.role === 'admin') {
        client.join('admin');
      } else {
        const room = payload.role === 'driver' ? `driver:${payload.sub}` : `customer:${payload.sub}`;
        client.join(room);
      }

      if (payload.role === 'driver') {
        await this.driversService.setSocketId(payload.sub, client.id);
      }
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const payload = this.socketUsers.get(client.id);
    this.socketUsers.delete(client.id);
    if (payload?.role === 'driver') {
      await this.driversService.setOfflineBySocketId(client.id);
    }
  }

  @SubscribeMessage('driver:location-update')
  async handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { lat: number; lng: number },
  ) {
    const payload = this.socketUsers.get(client.id);
    if (!payload || payload.role !== 'driver') return;

    await this.driversService.updateLocation(payload.sub, body.lat, body.lng);

    const activeRequest = await this.requestModel
      .findOneAndUpdate(
        { driverId: payload.sub, status: { $in: ACTIVE_STATUSES } },
        { driverLocation: { lat: body.lat, lng: body.lng } },
      )
      .exec();

    if (activeRequest) {
      this.emitToCustomer(activeRequest.customerId.toString(), 'driver-location-update', {
        requestId: activeRequest._id.toString(),
        location: { lat: body.lat, lng: body.lng },
      });
    }

    this.emitToAdmins('admin:driver-location-update', {
      driverId: payload.sub,
      location: { lat: body.lat, lng: body.lng },
    });
  }

  emitToDriver(driverId: string, event: string, payload: unknown) {
    this.server.to(`driver:${driverId}`).emit(event, payload);
  }

  emitToCustomer(customerId: string, event: string, payload: unknown) {
    this.server.to(`customer:${customerId}`).emit(event, payload);
  }

  emitToAdmins(event: string, payload: unknown) {
    this.server.to('admin').emit(event, payload);
  }
}
