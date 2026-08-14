import { IsString } from 'class-validator';

export class UpdateFcmTokenDto {
  @IsString()
  token: string;
}
