import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GeocodingService } from './geocoding.service';

class ReverseGeocodeQuery {
  @Type(() => Number)
  @IsNumber()
  lat: number;

  @Type(() => Number)
  @IsNumber()
  lng: number;
}

@Controller('geocode')
@UseGuards(JwtAuthGuard)
export class GeocodingController {
  constructor(private readonly geocodingService: GeocodingService) {}

  @Get('reverse')
  async reverse(@Query() query: ReverseGeocodeQuery) {
    const address = await this.geocodingService.reverseGeocode(query.lat, query.lng);
    return { address };
  }
}
