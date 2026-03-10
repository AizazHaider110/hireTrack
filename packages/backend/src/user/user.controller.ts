import { Controller, Get, Put, Body, UseGuards, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('user')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  async getProfile(@Req() req: any) {
    return this.userService.getProfile(req.user.id);
  }

  @Put('profile')
  async updateProfile(
    @Body() updateData: { name?: string; phone?: string },
    @Req() req: any,
  ) {
    return this.userService.updateProfile(req.user.id, updateData);
  }

  @Get('candidate-profile')
  @Roles(Role.CANDIDATE)
  async getCandidateProfile(@Req() req: any) {
    return this.userService.getCandidateProfile(req.user.id, req.user.role);
  }
}
