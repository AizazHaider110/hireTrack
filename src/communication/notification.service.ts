import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../events/queue.service';
import { EventBusService } from '../events/event-bus.service';
import { EmailService } from './email.service';
import { QueueName, JobName } from '../events/event-types';
import {
  NotificationDto,
  ApplicationStatusUpdateDto,
  InterviewReminderDto,
  CreateWebhookDto,
  UpdateWebhookDto,
  WebhookDeliveryDto,
  BulkNotificationDto,
  WebhookTestDto,
} from '../common/dto/notification.dto';
import { 
  Webhook, 
  WebhookEvent, 
  WebhookDelivery, 
  DeliveryStatus, 
  ApplicationStatus,
  EmailTemplateType 
} from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly eventBus: EventBusService,
    private readonly emailService: EmailService,
  ) {
    this.setupEventListeners();
  }

  /**
   * Send application status update notification
   */
  async sendApplicationStatusUpdate(data: ApplicationStatusUpdateDto): Promise<void> {
    const application = await this.prisma.application.findUnique({
      where: { id: data.applicationId },
      include: {
        candidate: {
          include: {
            user: true,
          },
        },
        job: true,
      },
    });

    if (!application) {
      throw new NotFoundException(`Application with ID ${data.applicationId} not found`);
    }

    // Determine email template type based on status
    let templateType: EmailTemplateType;
    switch (data.status) {
      case ApplicationStatus.REVIEWED:
        templateType = EmailTemplateType.APPLICATION_RECEIVED;
        break;
      case ApplicationStatus.INTERVIEWED:
        templateType = EmailTemplateType.INTERVIEW_INVITATION;
        break;
      case ApplicationStatus.REJECTED:
        templateType = EmailTemplateType.REJECTION;
        break;
      case ApplicationStatus.OFFERED:
        templateType = EmailTemplateType.OFFER_LETTER;
        break;
      default:
        templateType = EmailTemplateType.STAGE_CHANGE;
    }

    // Send email notification
    await this.emailService.sendTemplateEmail({
      templateType,
      to: application.candidate.user.email,
      variables: {
        candidateName: application.candidate.user.name,
        jobTitle: application.job.title,
        status: data.status,
        message: data.message || '',
        companyName: 'Your Company', // This should come from configuration
      },
    });

    // Trigger webhooks
    await this.triggerWebhooks(WebhookEvent.CANDIDATE_STAGE_CHANGED, {
      applicationId: application.id,
      candidateId: application.candidateId,
      jobId: application.jobId,
      oldStatus: application.status,
      newStatus: data.status,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Sent application status update for ${application.id}: ${data.status}`);
  }

  /**
   * Send interview reminder
   */
  async sendInterviewReminder(data: InterviewReminderDto): Promise<void> {
    const interview = await this.prisma.interview.findUnique({
      where: { id: data.interviewId },
      include: {
        candidate: {
          include: {
            user: true,
          },
        },
        interviewers: true,
      },
    });

    if (!interview) {
      throw new NotFoundException(`Interview with ID ${data.interviewId} not found`);
    }

    // Send reminder to candidate
    await this.emailService.sendTemplateEmail({
      templateType: EmailTemplateType.INTERVIEW_REMINDER,
      to: interview.candidate.user.email,
      variables: {
        candidateName: interview.candidate.user.name,
        interviewDate: interview.scheduledAt.toLocaleDateString(),
        interviewTime: interview.scheduledAt.toLocaleTimeString(),
        location: interview.location,
        duration: `${interview.duration} minutes`,
        customMessage: data.customMessage || '',
      },
    });

    // Send reminder to interviewers - get user details separately
    for (const interviewer of interview.interviewers) {
      const user = await this.prisma.user.findUnique({
        where: { id: interviewer.userId },
        select: { id: true, name: true, email: true },
      });

      if (user) {
        await this.emailService.sendTemplateEmail({
          templateType: EmailTemplateType.INTERVIEW_REMINDER,
          to: user.email,
          variables: {
            candidateName: interview.candidate.user.name,
            interviewerName: user.name,
            interviewDate: interview.scheduledAt.toLocaleDateString(),
            interviewTime: interview.scheduledAt.toLocaleTimeString(),
            location: interview.location,
            duration: `${interview.duration} minutes`,
            customMessage: data.customMessage || '',
          },
        });
      }
    }

    this.logger.log(`Sent interview reminders for interview ${interview.id}`);
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(data: BulkNotificationDto): Promise<void> {
    // Queue bulk notification job
    await this.queueService.addJob(
      QueueName.NOTIFICATIONS,
      JobName.SEND_NOTIFICATION,
      {
        type: 'bulk_notification',
        payload: {
          notifications: data.notifications,
        },
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    );

    this.logger.log(`Queued ${data.notifications.length} bulk notifications`);
  }

  /**
   * Create webhook subscription
   */
  async subscribeToWebhook(data: CreateWebhookDto, createdBy: string): Promise<Webhook> {
    const secret = data.secret || this.generateWebhookSecret();

    const webhook = await this.prisma.webhook.create({
      data: {
        url: data.url,
        events: data.events,
        secret,
        isActive: data.isActive ?? true,
        createdBy,
      },
    });

    this.logger.log(`Created webhook subscription: ${webhook.url}`);

    // Publish event
    this.eventBus.publish('webhook.created', {
      webhookId: webhook.id,
      url: webhook.url,
      events: webhook.events,
    });

    return webhook;
  }

  /**
   * Update webhook subscription
   */
  async updateWebhook(id: string, data: UpdateWebhookDto): Promise<Webhook> {
    const existingWebhook = await this.prisma.webhook.findUnique({
      where: { id },
    });

    if (!existingWebhook) {
      throw new NotFoundException(`Webhook with ID ${id} not found`);
    }

    const webhook = await this.prisma.webhook.update({
      where: { id },
      data: {
        url: data.url,
        events: data.events,
        secret: data.secret,
        isActive: data.isActive,
      },
    });

    this.logger.log(`Updated webhook subscription: ${webhook.url}`);

    // Publish event
    this.eventBus.publish('webhook.updated', {
      webhookId: webhook.id,
      url: webhook.url,
      events: webhook.events,
    });

    return webhook;
  }

  /**
   * Get webhook subscriptions
   */
  async getWebhooks(createdBy?: string): Promise<Webhook[]> {
    return this.prisma.webhook.findMany({
      where: createdBy ? { createdBy } : undefined,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get webhook by ID
   */
  async getWebhookById(id: string): Promise<Webhook | null> {
    return this.prisma.webhook.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 10, // Last 10 deliveries
        },
      },
    });
  }

  /**
   * Delete webhook subscription
   */
  async deleteWebhook(id: string): Promise<void> {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id },
    });

    if (!webhook) {
      throw new NotFoundException(`Webhook with ID ${id} not found`);
    }

    await this.prisma.webhook.delete({
      where: { id },
    });

    this.logger.log(`Deleted webhook subscription: ${webhook.url}`);

    // Publish event
    this.eventBus.publish('webhook.deleted', {
      webhookId: id,
      url: webhook.url,
    });
  }

  /**
   * Test webhook delivery
   */
  async testWebhook(data: WebhookTestDto): Promise<void> {
    const webhook = await this.getWebhookById(data.webhookId);
    if (!webhook) {
      throw new NotFoundException(`Webhook with ID ${data.webhookId} not found`);
    }

    const testPayload = data.testPayload || {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery',
      },
    };

    await this.deliverWebhook(data.webhookId, WebhookEvent.CANDIDATE_APPLIED, testPayload);
  }

  /**
   * Deliver webhook
   */
  async deliverWebhook(webhookId: string, event: WebhookEvent, payload: any): Promise<void> {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook || !webhook.isActive) {
      this.logger.warn(`Webhook ${webhookId} not found or inactive`);
      return;
    }

    if (!webhook.events.includes(event)) {
      this.logger.debug(`Webhook ${webhookId} not subscribed to event ${event}`);
      return;
    }

    // Create delivery record
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        webhookId,
        event,
        payload,
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
          webhookUrl: webhook.url,
          secret: webhook.secret,
          event,
          payload,
        },
      },
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }
    );

    this.logger.debug(`Queued webhook delivery ${delivery.id} for ${webhook.url}`);
  }

  /**
   * Update webhook delivery status
   */
  async updateWebhookDeliveryStatus(
    deliveryId: string,
    status: DeliveryStatus,
    responseCode?: number,
    responseBody?: string,
    error?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      attempts: {
        increment: 1,
      },
      lastAttemptAt: new Date(),
    };

    if (responseCode !== undefined) {
      updateData.responseCode = responseCode;
    }

    if (responseBody !== undefined) {
      updateData.responseBody = responseBody;
    }

    if (status === DeliveryStatus.FAILED && error) {
      // Calculate next retry time (exponential backoff)
      const baseDelay = 1000; // 1 second
      const delivery = await this.prisma.webhookDelivery.findUnique({
        where: { id: deliveryId },
      });
      
      if (delivery && delivery.attempts < 5) {
        const delay = baseDelay * Math.pow(2, delivery.attempts);
        updateData.nextRetryAt = new Date(Date.now() + delay);
        updateData.status = DeliveryStatus.RETRYING;
      }
    }

    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: updateData,
    });

    this.logger.debug(`Updated webhook delivery ${deliveryId} status to ${status}`);
  }

  /**
   * Get webhook delivery statistics
   */
  async getWebhookStatistics(webhookId: string, days: number = 30) {
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
      { total: 0, delivered: 0, failed: 0, pending: 0 }
    );

    const successRate = stats.total > 0 ? (stats.delivered / stats.total) * 100 : 0;

    return {
      ...stats,
      successRate: Math.round(successRate * 100) / 100,
      period: `${days} days`,
    };
  }

  /**
   * Trigger webhooks for an event
   */
  private async triggerWebhooks(event: WebhookEvent, payload: any): Promise<void> {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        isActive: true,
        events: {
          has: event,
        },
      },
    });

    for (const webhook of webhooks) {
      await this.deliverWebhook(webhook.id, event, payload);
    }
  }

  /**
   * Generate webhook secret
   */
  private generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Setup event listeners for automatic notifications
   */
  private setupEventListeners(): void {
    // Listen for application events
    this.eventBus.subscribe('candidate.applied', async (event) => {
      await this.triggerWebhooks(WebhookEvent.CANDIDATE_APPLIED, event.payload);
    });

    this.eventBus.subscribe('candidate.stage_changed', async (event) => {
      await this.triggerWebhooks(WebhookEvent.CANDIDATE_STAGE_CHANGED, event.payload);
    });

    // Listen for interview events
    this.eventBus.subscribe('interview.scheduled', async (event) => {
      await this.triggerWebhooks(WebhookEvent.INTERVIEW_SCHEDULED, event.payload);
    });

    this.eventBus.subscribe('interview.completed', async (event) => {
      await this.triggerWebhooks(WebhookEvent.INTERVIEW_COMPLETED, event.payload);
    });

    // Listen for offer events
    this.eventBus.subscribe('offer.sent', async (event) => {
      await this.triggerWebhooks(WebhookEvent.OFFER_SENT, event.payload);
    });

    this.eventBus.subscribe('offer.accepted', async (event) => {
      await this.triggerWebhooks(WebhookEvent.OFFER_ACCEPTED, event.payload);
    });

    // Listen for candidate events
    this.eventBus.subscribe('candidate.rejected', async (event) => {
      await this.triggerWebhooks(WebhookEvent.CANDIDATE_REJECTED, event.payload);
    });

    this.logger.log('Notification event listeners setup complete');
  }
}