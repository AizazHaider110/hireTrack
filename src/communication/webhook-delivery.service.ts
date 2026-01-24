import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../events/queue.service';
import { EventBusService } from '../events/event-bus.service';
import { QueueName, JobName } from '../events/event-types';
import {
  Webhook,
  WebhookEvent,
  WebhookDelivery,
  DeliveryStatus,
} from '@prisma/client';
import * as crypto from 'crypto';

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: any;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
  duration?: number;
}

export interface WebhookStatistics {
  total: number;
  delivered: number;
  failed: number;
  pending: number;
  successRate: number;
  averageResponseTime?: number;
  period: string;
}

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);
  private readonly MAX_RETRY_ATTEMPTS = 5;
  private readonly BASE_RETRY_DELAY = 1000; // 1 second

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Generate HMAC signature for webhook payload
   */
  generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }

  /**
   * Queue a webhook delivery
   */
  async queueWebhookDelivery(
    webhookId: string,
    event: WebhookEvent,
    data: any,
  ): Promise<WebhookDelivery | null> {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook || !webhook.isActive) {
      this.logger.warn(`Webhook ${webhookId} not found or inactive`);
      return null;
    }

    if (!webhook.events.includes(event)) {
      this.logger.debug(
        `Webhook ${webhookId} not subscribed to event ${event}`,
      );
      return null;
    }

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    // Create delivery record
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        webhookId,
        event,
        payload: payload as any,
        status: DeliveryStatus.PENDING,
      },
    });

    // Queue webhook delivery job
    await this.queueService.addJob(
      QueueName.WEBHOOKS,
      JobName.DELIVER_WEBHOOK,
      {
        type: 'webhook_delivery',
        payload: {
          deliveryId: delivery.id,
          webhookId: webhook.id,
          webhookUrl: webhook.url,
          secret: webhook.secret,
          event,
          payload,
        },
      },
      {
        attempts: this.MAX_RETRY_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: this.BASE_RETRY_DELAY,
        },
      },
    );

    this.logger.debug(
      `Queued webhook delivery ${delivery.id} for ${webhook.url}`,
    );

    return delivery;
  }

  /**
   * Execute webhook delivery (called by worker)
   */
  async executeDelivery(
    deliveryId: string,
    webhookUrl: string,
    secret: string,
    payload: WebhookPayload,
  ): Promise<WebhookDeliveryResult> {
    const startTime = Date.now();
    const payloadString = JSON.stringify(payload);
    const signature = this.generateSignature(payloadString, secret);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-Event': payload.event,
          'X-Webhook-Timestamp': payload.timestamp,
          'X-Webhook-Delivery-Id': deliveryId,
          'User-Agent': 'ATS-Webhook-Delivery/1.0',
        },
        body: payloadString,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      const duration = Date.now() - startTime;
      const responseBody = await response.text();

      const result: WebhookDeliveryResult = {
        success: response.ok,
        statusCode: response.status,
        responseBody: responseBody.substring(0, 1000), // Limit response body size
        duration,
      };

      // Update delivery record
      await this.updateDeliveryStatus(
        deliveryId,
        response.ok ? DeliveryStatus.DELIVERED : DeliveryStatus.FAILED,
        response.status,
        result.responseBody,
        response.ok ? undefined : `HTTP ${response.status}`,
      );

      if (response.ok) {
        this.logger.log(
          `Webhook delivered successfully to ${webhookUrl} in ${duration}ms`,
        );
        this.eventBus.publish('webhook.delivered', {
          deliveryId,
          webhookUrl,
          event: payload.event,
          duration,
        });
      } else {
        this.logger.warn(
          `Webhook delivery failed to ${webhookUrl}: HTTP ${response.status}`,
        );
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Webhook delivery error to ${webhookUrl}: ${errorMessage}`,
      );

      // Update delivery record with error
      await this.updateDeliveryStatus(
        deliveryId,
        DeliveryStatus.FAILED,
        undefined,
        undefined,
        errorMessage,
      );

      return {
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Update webhook delivery status
   */
  async updateDeliveryStatus(
    deliveryId: string,
    status: DeliveryStatus,
    responseCode?: number,
    responseBody?: string,
    error?: string,
  ): Promise<WebhookDelivery> {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) {
      throw new NotFoundException(`Delivery ${deliveryId} not found`);
    }

    const updateData: any = {
      status,
      attempts: delivery.attempts + 1,
      lastAttemptAt: new Date(),
    };

    if (responseCode !== undefined) {
      updateData.responseCode = responseCode;
    }

    if (responseBody !== undefined) {
      updateData.responseBody = responseBody;
    }

    // Calculate next retry time for failed deliveries
    if (
      status === DeliveryStatus.FAILED &&
      delivery.attempts < this.MAX_RETRY_ATTEMPTS - 1
    ) {
      const delay = this.BASE_RETRY_DELAY * Math.pow(2, delivery.attempts);
      updateData.nextRetryAt = new Date(Date.now() + delay);
      updateData.status = DeliveryStatus.RETRYING;
    }

    return this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: updateData,
    });
  }

  /**
   * Retry failed webhook deliveries
   */
  async retryFailedDeliveries(): Promise<number> {
    const failedDeliveries = await this.prisma.webhookDelivery.findMany({
      where: {
        status: DeliveryStatus.RETRYING,
        nextRetryAt: {
          lte: new Date(),
        },
        attempts: {
          lt: this.MAX_RETRY_ATTEMPTS,
        },
      },
      include: {
        webhook: true,
      },
    });

    let retriedCount = 0;

    for (const delivery of failedDeliveries) {
      if (!delivery.webhook.isActive) {
        // Mark as failed if webhook is now inactive
        await this.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: { status: DeliveryStatus.FAILED },
        });
        continue;
      }

      // Re-queue the delivery
      await this.queueService.addJob(
        QueueName.WEBHOOKS,
        JobName.DELIVER_WEBHOOK,
        {
          type: 'webhook_delivery',
          payload: {
            deliveryId: delivery.id,
            webhookId: delivery.webhookId,
            webhookUrl: delivery.webhook.url,
            secret: delivery.webhook.secret,
            event: delivery.event,
            payload: delivery.payload,
          },
        },
        {
          attempts: this.MAX_RETRY_ATTEMPTS - delivery.attempts,
          backoff: {
            type: 'exponential',
            delay: this.BASE_RETRY_DELAY,
          },
        },
      );

      retriedCount++;
    }

    if (retriedCount > 0) {
      this.logger.log(`Retried ${retriedCount} failed webhook deliveries`);
    }

    return retriedCount;
  }

  /**
   * Trigger webhooks for an event
   */
  async triggerWebhooks(
    event: WebhookEvent,
    data: any,
  ): Promise<WebhookDelivery[]> {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        isActive: true,
        events: {
          has: event,
        },
      },
    });

    const deliveries: WebhookDelivery[] = [];

    for (const webhook of webhooks) {
      const delivery = await this.queueWebhookDelivery(webhook.id, event, data);
      if (delivery) {
        deliveries.push(delivery);
      }
    }

    this.logger.log(
      `Triggered ${deliveries.length} webhooks for event ${event}`,
    );

    return deliveries;
  }

  /**
   * Get webhook delivery by ID
   */
  async getDeliveryById(deliveryId: string): Promise<WebhookDelivery | null> {
    return this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        webhook: {
          select: {
            id: true,
            url: true,
            events: true,
            isActive: true,
          },
        },
      },
    });
  }

  /**
   * Get deliveries for a webhook
   */
  async getDeliveriesByWebhook(
    webhookId: string,
    options?: {
      status?: DeliveryStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ deliveries: WebhookDelivery[]; total: number }> {
    const where: any = { webhookId };

    if (options?.status) {
      where.status = options.status;
    }

    const [deliveries, total] = await Promise.all([
      this.prisma.webhookDelivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      this.prisma.webhookDelivery.count({ where }),
    ]);

    return { deliveries, total };
  }

  /**
   * Get webhook delivery statistics
   */
  async getWebhookStatistics(
    webhookId: string,
    days: number = 30,
  ): Promise<WebhookStatistics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const deliveries = await this.prisma.webhookDelivery.findMany({
      where: {
        webhookId,
        createdAt: {
          gte: startDate,
        },
      },
    });

    const stats = deliveries.reduce(
      (acc, delivery) => {
        acc.total++;
        switch (delivery.status) {
          case DeliveryStatus.DELIVERED:
            acc.delivered++;
            break;
          case DeliveryStatus.FAILED:
            acc.failed++;
            break;
          case DeliveryStatus.PENDING:
          case DeliveryStatus.RETRYING:
            acc.pending++;
            break;
        }
        return acc;
      },
      { total: 0, delivered: 0, failed: 0, pending: 0 },
    );

    const successRate =
      stats.total > 0 ? (stats.delivered / stats.total) * 100 : 0;

    return {
      ...stats,
      successRate: Math.round(successRate * 100) / 100,
      period: `${days} days`,
    };
  }

  /**
   * Get overall webhook system statistics
   */
  async getSystemStatistics(days: number = 7): Promise<{
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    pendingDeliveries: number;
    successRate: number;
    activeWebhooks: number;
    eventBreakdown: Record<string, number>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [deliveries, activeWebhooks] = await Promise.all([
      this.prisma.webhookDelivery.findMany({
        where: {
          createdAt: {
            gte: startDate,
          },
        },
      }),
      this.prisma.webhook.count({
        where: { isActive: true },
      }),
    ]);

    const stats = deliveries.reduce(
      (acc, delivery) => {
        acc.totalDeliveries++;

        switch (delivery.status) {
          case DeliveryStatus.DELIVERED:
            acc.successfulDeliveries++;
            break;
          case DeliveryStatus.FAILED:
            acc.failedDeliveries++;
            break;
          case DeliveryStatus.PENDING:
          case DeliveryStatus.RETRYING:
            acc.pendingDeliveries++;
            break;
        }

        // Event breakdown
        acc.eventBreakdown[delivery.event] =
          (acc.eventBreakdown[delivery.event] || 0) + 1;

        return acc;
      },
      {
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        pendingDeliveries: 0,
        eventBreakdown: {} as Record<string, number>,
      },
    );

    const successRate =
      stats.totalDeliveries > 0
        ? (stats.successfulDeliveries / stats.totalDeliveries) * 100
        : 0;

    return {
      ...stats,
      successRate: Math.round(successRate * 100) / 100,
      activeWebhooks,
    };
  }

  /**
   * Manually retry a specific delivery
   */
  async manualRetry(deliveryId: string): Promise<WebhookDelivery> {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { webhook: true },
    });

    if (!delivery) {
      throw new NotFoundException(`Delivery ${deliveryId} not found`);
    }

    if (!delivery.webhook.isActive) {
      throw new BadRequestException('Webhook is inactive');
    }

    // Reset status and queue for retry
    const updatedDelivery = await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: DeliveryStatus.PENDING,
        nextRetryAt: null,
      },
    });

    // Queue the delivery
    await this.queueService.addJob(
      QueueName.WEBHOOKS,
      JobName.DELIVER_WEBHOOK,
      {
        type: 'webhook_delivery',
        payload: {
          deliveryId: delivery.id,
          webhookId: delivery.webhookId,
          webhookUrl: delivery.webhook.url,
          secret: delivery.webhook.secret,
          event: delivery.event,
          payload: delivery.payload,
        },
      },
      {
        attempts: 1,
      },
    );

    this.logger.log(`Manual retry queued for delivery ${deliveryId}`);

    return updatedDelivery;
  }

  /**
   * Cancel pending deliveries for a webhook
   */
  async cancelPendingDeliveries(webhookId: string): Promise<number> {
    const result = await this.prisma.webhookDelivery.updateMany({
      where: {
        webhookId,
        status: {
          in: [DeliveryStatus.PENDING, DeliveryStatus.RETRYING],
        },
      },
      data: {
        status: DeliveryStatus.FAILED,
      },
    });

    this.logger.log(
      `Cancelled ${result.count} pending deliveries for webhook ${webhookId}`,
    );

    return result.count;
  }

  /**
   * Clean up old delivery records
   */
  async cleanupOldDeliveries(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.webhookDelivery.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        status: {
          in: [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED],
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old webhook deliveries`);

    return result.count;
  }
}
