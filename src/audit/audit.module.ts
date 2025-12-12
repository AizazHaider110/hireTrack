import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditEventListener } from './audit-event.listener';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [AuditController],
  providers: [AuditService, AuditEventListener],
  exports: [AuditService],
})
export class AuditModule {}
