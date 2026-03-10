import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_INTERCEPTOR } from '@nestjs/core';
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
import { TeamModule } from './team/team.module';
import { TalentPoolModule } from './talent-pool/talent-pool.module';
import { CareerPortalModule } from './career-portal/career-portal.module';
import { IntegrationModule } from './integration/integration.module';
import { FileModule } from './file/file.module';
import { SearchModule } from './search/search.module';
import { WorkflowModule } from './workflow/workflow.module';
import { CacheModule } from './common/cache/cache.module';
import { MonitoringModule } from './common/monitoring/monitoring.module';
import { PerformanceInterceptor } from './common/interceptors/performance.interceptor';
import { LoggingMiddleware } from './common/middleware/logging.middleware';

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
    // Infrastructure modules
    PrismaModule,
    CacheModule,
    MonitoringModule,
    EventsModule,
    AuditModule,
    // Core modules
    AuthModule,
    UserModule,
    JobModule,
    ApplicationModule,
    ResumeModule,
    AdminModule,
    // ATS feature modules
    PipelineModule,
    InterviewModule,
    CommunicationModule,
    ScoringModule,
    AnalyticsModule,
    TeamModule,
    TalentPoolModule,
    CareerPortalModule,
    IntegrationModule,
    FileModule,
    SearchModule,
    WorkflowModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
