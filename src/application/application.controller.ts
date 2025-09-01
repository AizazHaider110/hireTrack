import { Controller, Get, Post, Put, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApplicationService } from './application.service';
import { CreateApplicationDto, UpdateApplicationDto } from '../common/dto/application.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('applications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  @Post()
  @Roles(Role.CANDIDATE)
  async createApplication(@Body() createApplicationDto: CreateApplicationDto, @Req() req: any) {
    return this.applicationService.createApplication(req.user.id, req.user.role, createApplicationDto);
  }

  @Get('my-applications')
  @Roles(Role.CANDIDATE)
  async getMyApplications(@Req() req: any) {
    return this.applicationService.getApplicationsByCandidate(req.user.id, req.user.role);
  }

  @Get('job/:jobId')
  @Roles(Role.RECRUITER, Role.ADMIN)
  async getApplicationsByJob(@Param('jobId') jobId: string, @Req() req: any) {
    return this.applicationService.getApplicationsByJob(jobId, req.user.id, req.user.role);
  }

  @Put(':id/status')
  @Roles(Role.RECRUITER, Role.ADMIN)
  async updateApplicationStatus(
    @Param('id') id: string,
    @Body() updateApplicationDto: UpdateApplicationDto,
    @Req() req: any,
  ) {
    return this.applicationService.updateApplicationStatus(id, req.user.id, req.user.role, updateApplicationDto);
  }

  @Get('admin/all')
  @Roles(Role.ADMIN)
  async getAllApplications(@Req() req: any) {
    return this.applicationService.getAllApplications(req.user.role);
  }
}

