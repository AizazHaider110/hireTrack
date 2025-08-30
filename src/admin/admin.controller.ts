import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  async getDashboardStats(@Req() req: any) {
    return this.adminService.getDashboardStats(req.user.role);
  }

  @Get('users')
  async getAllUsers(@Req() req: any) {
    return this.adminService.getAllUsers(req.user.role);
  }

  @Get('users/:id')
  async getUserById(@Param('id') id: string, @Req() req: any) {
    return this.adminService.getUserById(id, req.user.role);
  }
}
