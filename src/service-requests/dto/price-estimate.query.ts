import { Type } from 'class-transformer';
import { IsEnum, IsNumber } from 'class-validator';
import { ServiceType } from '../../common/enums/service-type.enum';

export class PriceEstimateQuery {
  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @Type(() => Number)
  @IsNumber()
  lat: number;

  @Type(() => Number)
  @IsNumber()
  lng: number;
}
