import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApplicationService } from './application.service';
import { ApplicationStatus } from '@prisma/client';

@Controller('applications')
export class ApplicationController {
  constructor(private readonly service: ApplicationService) {}

  @Post()
  apply(
    @Body() body: { candidateId: string; jobId: string; resume?: string }
  ) {
    return this.service.apply(body.candidateId, body.jobId, body.resume);
  }

  @Get()
  getAll() {
    return this.service.getAll();
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: ApplicationStatus }
  ) {
    return this.service.updateStatus(id, body.status);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
