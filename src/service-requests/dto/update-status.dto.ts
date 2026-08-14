import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { RequestStatus } from '../../common/enums/request-status.enum';

export class UpdateRequestStatusDto {
  @IsEnum(RequestStatus)
  status: RequestStatus;

  // Required to be `true` when status is COMPLETED — the driver confirming
  // they physically collected cash payment from the customer.
  @IsOptional()
  @IsBoolean()
  cashCollected?: boolean;
}
