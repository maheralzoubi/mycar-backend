import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/types/jwt-payload.type';
import { UsersService } from './users.service';
import { UpdateFcmTokenDto } from './dto/update-fcm-token.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('customer')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('me/fcm-token')
  async updateFcmToken(@CurrentUser() user: JwtPayload, @Body() dto: UpdateFcmTokenDto) {
    await this.usersService.setFcmToken(user.sub, dto.token);
    return { ok: true };
  }
}
