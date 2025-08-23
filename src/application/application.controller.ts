import { Body, Controller, Delete, Get, Param, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { NestInterceptor } from '@nestjs/common';
import { diskStorage } from 'multer';
import { ApplicationService } from './application.service';
import { ApplicationStatus } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';

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
  @Post(':candidateId/:jobId/upload-resume')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
      }
    })
  }))
  async uploadResume(
    @Param('candidateId') candidateId: string,
    @Param('jobId') jobId: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    const filePath = `/uploads/${file.filename}`;
    return this.service.apply(candidateId, jobId, filePath);
  }
}

