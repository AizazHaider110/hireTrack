import { Module } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { ScoringController } from './scoring.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ResumeModule } from '../resume/resume.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, ResumeModule, EventsModule],
  controllers: [ScoringController],
  providers: [ScoringService],
  exports: [ScoringService],
})
export class ScoringModule {}
