import { Type } from 'class-transformer';
import { IsBooleanString, IsEnum, IsInt, IsISO8601, IsOptional, Min } from 'class-validator';
import { RequestStatus } from '../../common/enums/request-status.enum';
import { ServiceType } from '../../common/enums/service-type.enum';

export class AdminRequestsQuery {
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @IsOptional()
  @IsBooleanString()
  active?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
