import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { JobModule } from './job/job.module';
import { CandidateModule } from './candidate/candidate.module';
import { ApplicationModule } from './application/application.module';

@Module({
  imports: [PrismaModule, JobModule, CandidateModule, ApplicationModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
