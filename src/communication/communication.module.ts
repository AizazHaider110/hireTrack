import { Module, OnModuleInit } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookController } from './webhook.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { WorkersService } from '../events/workers.service';

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [EmailController, NotificationController, WebhookController],
  providers: [EmailService, NotificationService, WebhookDeliveryService],
  exports: [EmailService, NotificationService, WebhookDeliveryService],
})
export class CommunicationModule implements OnModuleInit {
  constructor(
    private readonly workersService: WorkersService,
    private readonly webhookDeliveryService: WebhookDeliveryService,
  ) {}

  onModuleInit() {
    // Inject webhook delivery service into workers service
    this.workersService.setWebhookDeliveryService(this.webhookDeliveryService);
  }
}
