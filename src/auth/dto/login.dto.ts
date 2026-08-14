import { IsEmail, IsIn, IsString } from 'class-validator';
import { Role } from '../../common/types/jwt-payload.type';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsIn(['customer', 'driver'])
  role: Role;
}
