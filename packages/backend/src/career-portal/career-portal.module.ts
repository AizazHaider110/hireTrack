import { Module } from '@nestjs/common';
import { CareerPortalController } from './career-portal.controller';
import { CareerPortalService } from './career-portal.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, EventsModule, AuditModule],
  controllers: [CareerPortalController],
  providers: [CareerPortalService],
  exports: [CareerPortalService],
})
export class CareerPortalModule {}
