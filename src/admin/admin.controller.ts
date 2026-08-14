import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { AdminRequestsQuery } from './dto/admin-requests-query.dto';
import { RejectDriverDto } from './dto/reject-driver.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  overview() {
    return this.adminService.overview();
  }

  @Get('drivers')
  drivers() {
    return this.adminService.drivers();
  }

  @Patch('drivers/:id/suspend')
  suspend(@Param('id') id: string) {
    return this.adminService.suspendDriver(id, true);
  }

  @Patch('drivers/:id/activate')
  activate(@Param('id') id: string) {
    return this.adminService.suspendDriver(id, false);
  }

  @Get('drivers/pending')
  pendingDrivers() {
    return this.adminService.pendingDrivers();
  }

  @Patch('drivers/:id/approve')
  approveDriver(@Param('id') id: string) {
    return this.adminService.approveDriver(id);
  }

  @Patch('drivers/:id/reject')
  rejectDriver(@Param('id') id: string, @Body() dto: RejectDriverDto) {
    return this.adminService.rejectDriver(id, dto.reason);
  }

  @Get('customers')
  customers() {
    return this.adminService.customers();
  }

  @Get('service-requests')
  serviceRequests(@Query() query: AdminRequestsQuery) {
    return this.adminService.serviceRequests(query);
  }

  @Get('service-requests/:id')
  requestDetail(@Param('id') id: string) {
    return this.adminService.requestDetail(id);
  }

  @Get('revenue')
  revenue(@Query('days') days?: string) {
    return this.adminService.revenue(days ? parseInt(days, 10) : 30);
  }

  @Get('drivers-leaderboard')
  leaderboard(@Query('limit') limit?: string) {
    return this.adminService.leaderboard(limit ? parseInt(limit, 10) : 10);
  }
}
