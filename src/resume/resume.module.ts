import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ResumeService } from './resume.service';
import { ResumeParsingService } from './resume-parsing.service';
import { ResumeController } from './resume.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [ResumeController],
  providers: [ResumeService, ResumeParsingService],
  exports: [ResumeService, ResumeParsingService],
})
export class ResumeModule {}
