import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { LatLngDto } from '../../common/dto/lat-lng.dto';
import { ServiceType } from '../../common/enums/service-type.enum';
import { MAX_REQUEST_PHOTOS } from '../../common/config/multer.config';

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

  /**
   * URLs returned by `POST /service-requests/photos`. Ownership and existence
   * are checked by the service.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_REQUEST_PHOTOS)
  @ArrayUnique()
  @IsString({ each: true })
  photoUrls?: string[];
}
