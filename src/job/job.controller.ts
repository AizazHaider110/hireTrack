import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { JobService } from './job.service';
import { Prisma } from '@prisma/client';

@Controller('jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Get()
  getAllJobs() {
    return this.jobService.getAllJobs();
  }

  @Post()
  createJob(@Body() data: Prisma.JobPostingCreateInput) {
    return this.jobService.createJob(data);
  }

  @Delete(':id')
  deleteJob(@Param('id') id: string) {
    return this.jobService.deleteJob(id);
  }
}
