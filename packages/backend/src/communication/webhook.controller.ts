import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { NotificationService } from './notification.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import {
  CreateWebhookDto,
  UpdateWebhookDto,
  WebhookTestDto,
} from '../common/dto/notification.dto';
import { Webhook, WebhookDelivery, Role, DeliveryStatus } from '@prisma/client';

@Controller('webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WebhookController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly webhookDeliveryService: WebhookDeliveryService,
  ) {}

  /**
   * Create webhook subscription
   */
  @Post()
  @Roles(Role.ADMIN, Role.HIRING_MANAGER)
  async createWebhook(
    @Body() data: CreateWebhookDto,
    @Request() req: any,
  ): Promise<Webhook> {
    return this.notificationService.subscribeToWebhook(data, req.user.id);
  }

  /**
   * Get all webhook subscriptions
   */
  @Get()
  @Roles(Role.ADMIN, Role.HIRING_MANAGER, Role.RECRUITER)
  async getWebhooks(@Request() req: any): Promise<Webhook[]> {
    // Admins can see all webhooks, others only their own
    const createdBy = req.user.role === Role.ADMIN ? undefined : req.user.id;
    return this.notificationService.getWebhooks(createdBy);
  }

  /**
   * Get webhook by ID
   */
  @Get(':id')
  @Roles(Role.ADMIN, Role.HIRING_MANAGER, Role.RECRUITER)
  async getWebhook(@Param('id') id: string): Promise<Webhook> {
    const webhook = await this.notificationService.getWebhookById(id);
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    return webhook;
  }

  /**
   * Update webhook subscription
   */
  @Put(':id')
  @Roles(Role.ADMIN, Role.HIRING_MANAGER)
  async updateWebhook(
    @Param('id') id: string,
    @Body() data: UpdateWebhookDto,
  ): Promise<Webhook> {
    return this.notificationService.updateWebhook(id, data);
  }

  /**
   * Delete webhook subscription
   */
  @Delete(':id')
  @Roles(Role.ADMIN, Role.HIRING_MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWebhook(@Param('id') id: string): Promise<void> {
    // Cancel pending deliveries before deleting
    await this.webhookDeliveryService.cancelPendingDeliveries(id);
    await this.notificationService.deleteWebhook(id);
  }

  /**
   * Test webhook delivery
   */
  @Post(':id/test')
  @Roles(Role.ADMIN, Role.HIRING_MANAGER)
  @HttpCode(HttpStatus.ACCEPTED)
  async testWebhook(
    @Param('id') id: string,
  ): Promise<{ message: string; deliveryId?: string }> {
    const webhook = await this.notificationService.getWebhookById(id);
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    await this.notificationService.testWebhook({ webhookId: id });
    return { message: 'Test webhook delivery queued' };
  }

  /**
   * Get webhook delivery statistics
   */
  @Get(':id/statistics')
  @Roles(Role.ADMIN, Role.HIRING_MANAGER, Role.RECRUITER)
  async getWebhookStatistics(
    @Param('id') id: string,
    @Query('days') days?: string,
  ) {
    const dayCount = days ? parseInt(days, 10) : 30;
    return this.webhookDeliveryService.getWebhookStatistics(id, dayCount);
  }

  /**
   * Get webhook deliveries
   */
  @Get(':id/deliveries')
  @Roles(Role.ADMIN, Role.HIRING_MANAGER, Role.RECRUITER)
  async getWebhookDeliveries(
    @Param('id') id: string,
    @Query('status') status?: DeliveryStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ deliveries: WebhookDelivery[]; total: number }> {
    return this.webhookDeliveryService.getDeliveriesByWebhook(id, {
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  /**
   * Get specific delivery details
   */
  @Get('deliveries/:deliveryId')
  @Roles(Role.ADMIN, Role.HIRING_MANAGER, Role.RECRUITER)
  async getDelivery(
    @Param('deliveryId') deliveryId: string,
  ): Promise<WebhookDelivery> {
    const delivery =
      await this.webhookDeliveryService.getDeliveryById(deliveryId);
    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }
    return delivery;
  }

  /**
   * Manually retry a failed delivery
   */
  @Post('deliveries/:deliveryId/retry')
  @Roles(Role.ADMIN, Role.HIRING_MANAGER)
  @HttpCode(HttpStatus.ACCEPTED)
  async retryDelivery(
    @Param('deliveryId') deliveryId: string,
  ): Promise<{ message: string; delivery: WebhookDelivery }> {
    const delivery = await this.webhookDeliveryService.manualRetry(deliveryId);
    return {
      message: 'Delivery retry queued',
      delivery,
    };
  }

  /**
   * Get system-wide webhook statistics
   */
  @Get('system/statistics')
  @Roles(Role.ADMIN)
  async getSystemStatistics(@Query('days') days?: string) {
    const dayCount = days ? parseInt(days, 10) : 7;
    return this.webhookDeliveryService.getSystemStatistics(dayCount);
  }

  /**
   * Retry all failed deliveries
   */
  @Post('system/retry-failed')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  async retryFailedDeliveries(): Promise<{ message: string; count: number }> {
    const count = await this.webhookDeliveryService.retryFailedDeliveries();
    return {
      message: `Retried ${count} failed deliveries`,
      count,
    };
  }

  /**
   * Clean up old delivery records
   */
  @Post('system/cleanup')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async cleanupDeliveries(
    @Query('daysToKeep') daysToKeep?: string,
  ): Promise<{ message: string; count: number }> {
    const days = daysToKeep ? parseInt(daysToKeep, 10) : 30;
    const count = await this.webhookDeliveryService.cleanupOldDeliveries(days);
    return {
      message: `Cleaned up ${count} old delivery records`,
      count,
    };
  }
}
