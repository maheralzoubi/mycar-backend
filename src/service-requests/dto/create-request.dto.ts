import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { LatLngDto } from '../../common/dto/lat-lng.dto';
import { ServiceType } from '../../common/enums/service-type.enum';

export class CreateRequestDto {
  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @ValidateNested()
  @Type(() => LatLngDto)
  location: LatLngDto;

  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
