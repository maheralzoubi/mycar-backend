import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/types/jwt-payload.type';
import { ServiceRequestsService } from './service-requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { RateDto } from './dto/rate.dto';
import { UpdateRequestStatusDto } from './dto/update-status.dto';
import { PriceEstimateQuery } from './dto/price-estimate.query';

@Controller('service-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceRequestsController {
  constructor(private readonly service: ServiceRequestsService) {}

  @Get('price-estimate')
  @Roles('customer')
  priceEstimate(@Query() query: PriceEstimateQuery) {
    return this.service.estimatePrice(query.serviceType, { lat: query.lat, lng: query.lng });
  }

  @Get('history')
  @Roles('customer')
  history(@CurrentUser() user: JwtPayload) {
    return this.service.history(user.sub);
  }

  @Post()
  @Roles('customer')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateRequestDto) {
    return this.service.create(user.sub, dto);
  }

  @Get(':id')
  @Roles('customer')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.findByIdForCustomer(id, user.sub);
  }

  @Post(':id/cancel')
  @Roles('customer')
  cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.cancel(id, user.sub);
  }

  @Post(':id/rate')
  @Roles('customer')
  rate(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: RateDto) {
    return this.service.rate(id, user.sub, dto);
  }

  @Post(':id/accept')
  @Roles('driver')
  @HttpCode(200)
  accept(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.accept(id, user.sub);
  }

  @Post(':id/decline')
  @Roles('driver')
  @HttpCode(200)
  decline(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.decline(id, user.sub);
  }

  @Patch(':id/status')
  @Roles('driver')
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateRequestStatusDto,
  ) {
    return this.service.updateStatus(id, user.sub, dto.status, dto.cashCollected);
  }
}
