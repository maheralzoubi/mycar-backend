import { IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class LatLngDto {
  @Type(() => Number)
  @IsNumber()
  lat: number;

  @Type(() => Number)
  @IsNumber()
  lng: number;
}
