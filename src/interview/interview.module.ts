import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InterviewService } from './interview.service';
import { InterviewController } from './interview.controller';
import { CalendarIntegrationService, GoogleCalendarProvider, OutlookCalendarProvider } from './calendar-integration.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, EventsModule, ConfigModule],
  controllers: [InterviewController],
  providers: [
    InterviewService,
    CalendarIntegrationService,
    GoogleCalendarProvider,
    OutlookCalendarProvider,
  ],
  exports: [InterviewService, CalendarIntegrationService],
})
export class InterviewModule {}