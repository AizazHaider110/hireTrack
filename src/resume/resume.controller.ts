import { Controller, Post, Get, UseGuards, Req, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResumeService } from './resume.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '@prisma/client';

@Controller('resume')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResumeController {
  constructor(private readonly resumeService: ResumeService) {}

  @Post('upload')
  @Roles(Role.CANDIDATE)
  @UseInterceptors(FileInterceptor('resume'))
  async uploadResume(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Resume file is required');
    }

    // Validate file type
    const allowedMimeTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only PDF and DOCX files are allowed');
    }

    return this.resumeService.updateCandidateResume(req.user.id, file);
  }

  @Get('profile')
  @Roles(Role.CANDIDATE)
  async getResumeProfile(@Req() req: any) {
    return this.resumeService.getCandidateResume(req.user.id);
  }
}
