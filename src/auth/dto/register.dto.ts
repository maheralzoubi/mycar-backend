import { IsEmail, IsIn, IsString, MinLength, ValidateIf } from 'class-validator';
import { Role } from '../../common/types/jwt-payload.type';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsIn(['customer', 'driver'])
  role: Role;

  @IsString()
  name: string;

  @IsString()
  phone: string;

  @ValidateIf((dto: RegisterDto) => dto.role === 'driver')
  @IsString()
  vehicleType?: string;

  @ValidateIf((dto: RegisterDto) => dto.role === 'driver')
  @IsString()
  vehiclePlate?: string;

  @ValidateIf((dto: RegisterDto) => dto.role === 'driver')
  @IsString()
  licenseNumber?: string;
}
