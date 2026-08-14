import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { DriversService } from '../drivers/drivers.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { JwtPayload } from '../common/types/jwt-payload.type';
import { toDriverProfile } from '../drivers/drivers.mapper';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly driversService: DriversService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    if (dto.role === 'customer') {
      const existing = await this.usersService.findByEmail(dto.email);
      if (existing) throw new ConflictException('Email already registered');

      const user = await this.usersService.create({
        email: dto.email,
        passwordHash,
        name: dto.name,
        phone: dto.phone,
      });
      return this.buildAuthResponse(
        { sub: user._id.toString(), role: 'customer', email: user.email },
        { id: user._id.toString(), email: user.email, name: user.name, phone: user.phone },
      );
    }

    if (!dto.vehicleType || !dto.vehiclePlate || !dto.licenseNumber) {
      throw new BadRequestException(
        'vehicleType, vehiclePlate, and licenseNumber are required for drivers',
      );
    }
    const existingDriver = await this.driversService.findByEmail(dto.email);
    if (existingDriver) throw new ConflictException('Email already registered');

    const driver = await this.driversService.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      phone: dto.phone,
      vehicleType: dto.vehicleType,
      vehiclePlate: dto.vehiclePlate,
      licenseNumber: dto.licenseNumber,
    });
    return this.buildAuthResponse(
      { sub: driver._id.toString(), role: 'driver', email: driver.email },
      toDriverProfile(driver),
    );
  }

  async login(dto: LoginDto) {
    if (dto.role === 'customer') {
      const user = await this.usersService.findByEmail(dto.email);
      if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
        throw new UnauthorizedException('Invalid credentials');
      }
      return this.buildAuthResponse(
        { sub: user._id.toString(), role: 'customer', email: user.email },
        { id: user._id.toString(), email: user.email, name: user.name, phone: user.phone },
      );
    }

    const driver = await this.driversService.findByEmail(dto.email);
    if (!driver || !(await bcrypt.compare(dto.password, driver.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.buildAuthResponse(
      { sub: driver._id.toString(), role: 'driver', email: driver.email },
      toDriverProfile(driver),
    );
  }

  adminLogin(dto: AdminLoginDto) {
    const adminEmail = this.config.get<string>('admin.email');
    const adminPassword = this.config.get<string>('admin.password');

    if (dto.email.toLowerCase() !== adminEmail?.toLowerCase() || dto.password !== adminPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(
      { sub: 'owner', role: 'admin', email: adminEmail },
      { email: adminEmail },
    );
  }

  private buildAuthResponse(payload: JwtPayload, user: Record<string, unknown>) {
    return {
      accessToken: this.jwtService.sign(payload),
      user,
    };
  }
}
