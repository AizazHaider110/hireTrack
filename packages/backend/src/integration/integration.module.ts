import { Module } from '@nestjs/common';
import { IntegrationService } from './integration.service';
import {
  ApiKeyController,
  ExternalApiController,
  ApiDocsController,
} from './integration.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { CommunicationModule } from '../communication/communication.module';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { RateLimitGuard } from '../auth/guards/rate-limit.guard';

@Module({
  imports: [PrismaModule, EventsModule, CommunicationModule],
  controllers: [ApiKeyController, ExternalApiController, ApiDocsController],
  providers: [IntegrationService, ApiKeyGuard, RateLimitGuard],
  exports: [IntegrationService],
})
export class IntegrationModule {}
