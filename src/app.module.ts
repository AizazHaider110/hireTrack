import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { JobModule } from './job/job.module';
import { ApplicationModule } from './application/application.module';
import { ResumeModule } from './resume/resume.module';
import { AdminModule } from './admin/admin.module';
import { EventsModule } from './events/events.module';
import { AuditModule } from './audit/audit.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { InterviewModule } from './interview/interview.module';
import { CommunicationModule } from './communication/communication.module';
import { ScoringModule } from './scoring/scoring.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    EventsModule,
    AuditModule,
    AuthModule,
    UserModule,
    JobModule,
    ApplicationModule,
    ResumeModule,
    AdminModule,
    PipelineModule,
    InterviewModule,
    CommunicationModule,
    ScoringModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
