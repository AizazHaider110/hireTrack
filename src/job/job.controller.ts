import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { JobService } from './job.service';
import { CreateJobDto, UpdateJobDto } from '../common/dto/job.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { AuditInterceptor, Audit } from '../audit/audit.interceptor';

@Controller('jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Get()
  async getAllJobs(@Query('isActive') isActive?: string) {
    const isActiveBool =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.jobService.getAllJobs(isActiveBool);
  }

  @Get(':id')
  async getJobById(@Param('id') id: string) {
    return this.jobService.getJobById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RECRUITER, Role.ADMIN)
  @UseInterceptors(AuditInterceptor)
  @Audit('job', 'job.created')
  async createJob(@Body() createJobDto: CreateJobDto, @Req() req: any) {
    return this.jobService.createJob(req.user.id, req.user.role, createJobDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RECRUITER, Role.ADMIN)
  @UseInterceptors(AuditInterceptor)
  @Audit('job', 'job.updated')
  async updateJob(
    @Param('id') id: string,
    @Body() updateJobDto: UpdateJobDto,
    @Req() req: any,
  ) {
    return this.jobService.updateJob(
      id,
      req.user.id,
      req.user.role,
      updateJobDto,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RECRUITER, Role.ADMIN)
  @UseInterceptors(AuditInterceptor)
  @Audit('job', 'job.deleted')
  async deleteJob(@Param('id') id: string, @Req() req: any) {
    return this.jobService.deleteJob(id, req.user.id, req.user.role);
  }

  @Get('recruiter/my-jobs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RECRUITER, Role.ADMIN)
  async getMyJobs(@Req() req: any) {
    return this.jobService.getJobsByRecruiter(req.user.id);
  }
}
