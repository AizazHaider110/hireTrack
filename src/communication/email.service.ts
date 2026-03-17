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
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
  SendTemplateEmailDto,
  BulkEmailDto,
  EmailMetricsResponseDto,
} from '../common/dto/email.dto';
import {
  EmailTemplate,
  EmailTemplateType,
  EmailStatus,
  EmailMetrics,
} from '@prisma/client';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Send email using template
   */
  async sendTemplateEmail(data: SendTemplateEmailDto): Promise<void> {
    const template = await this.getActiveTemplateByType(data.templateType);

    if (!template) {
      throw new NotFoundException(
        `No active template found for type: ${data.templateType}`,
      );
    }

    // Validate that all required variables are provided
    const missingVariables = template.variables.filter(
      (variable) => !(variable in data.variables),
    );

    if (missingVariables.length > 0) {
      throw new BadRequestException(
        `Missing required template variables: ${missingVariables.join(', ')}`,
      );
    }

    // Substitute variables in subject and body
    const subject = this.substituteVariables(template.subject, data.variables);
    const body = this.substituteVariables(template.body, data.variables);

    // Create email job record
    const emailJob = await this.prisma.emailJob.create({
      data: {
        to: data.to,
        subject,
        body,
        templateId: template.id,
        variables: data.variables,
        scheduledFor: data.scheduledFor
          ? new Date(data.scheduledFor)
          : undefined,
        status: EmailStatus.PENDING,
      },
    });

    // Queue email for sending
    await this.queueService.addJob(
      QueueName.EMAIL,
      JobName.SEND_EMAIL,
      {
        type: 'template_email',
        payload: {
          emailJobId: emailJob.id,
          to: data.to,
          subject,
          body,
          templateId: template.id,
        },
      },
      {
        delay: data.scheduledFor
          ? new Date(data.scheduledFor).getTime() - Date.now()
          : 0,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    this.logger.log(
      `Queued template email for ${data.to} using template ${template.name}`,
    );

    // Publish event
    this.eventBus.publish('email.queued', {
      emailJobId: emailJob.id,
      templateType: data.templateType,
      recipient: data.to,
    });
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmails(emails: BulkEmailDto[]): Promise<void> {
    const emailJobs = await Promise.all(
      emails.map(async (email) => {
        let subject = email.subject;
        let body = email.body;

        // If template is specified, use it
        if (email.templateId) {
          const template = await this.getTemplateById(email.templateId);
          if (template && email.variables) {
            subject = this.substituteVariables(
              template.subject,
              email.variables,
            );
            body = this.substituteVariables(template.body, email.variables);
          }
        }

        return this.prisma.emailJob.create({
          data: {
            to: email.to,
            subject,
            body,
            templateId: email.templateId,
            variables: email.variables,
            status: EmailStatus.PENDING,
          },
        });
      }),
    );

    // Queue bulk email job
    await this.queueService.addJob(
      QueueName.EMAIL,
      JobName.SEND_BULK_EMAIL,
      {
        type: 'bulk_email',
        payload: {
          emailJobIds: emailJobs.map((job) => job.id),
        },
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    this.logger.log(`Queued ${emails.length} bulk emails`);

    // Publish event
    this.eventBus.publish('email.bulk_queued', {
      count: emails.length,
      emailJobIds: emailJobs.map((job) => job.id),
    });
  }

  /**
   * Create email template
   */
  async createTemplate(data: CreateEmailTemplateDto): Promise<EmailTemplate> {
    const template = await this.prisma.emailTemplate.create({
      data: {
        name: data.name,
        subject: data.subject,
        body: data.body,
        variables: data.variables,
        type: data.type,
        isActive: data.isActive ?? true,
      },
    });

    this.logger.log(`Created email template: ${template.name}`);

    // Publish event
    this.eventBus.publish('email.template_created', {
      templateId: template.id,
      name: template.name,
      type: template.type,
    });

    return template;
  }

  /**
   * Update email template
   */
  async updateTemplate(
    id: string,
    data: UpdateEmailTemplateDto,
  ): Promise<EmailTemplate> {
    const existingTemplate = await this.getTemplateById(id);
    if (!existingTemplate) {
      throw new NotFoundException(`Email template with ID ${id} not found`);
    }

    const template = await this.prisma.emailTemplate.update({
      where: { id },
      data: {
        name: data.name,
        subject: data.subject,
        body: data.body,
        variables: data.variables,
        type: data.type,
        isActive: data.isActive,
      },
    });

    this.logger.log(`Updated email template: ${template.name}`);

    // Publish event
    this.eventBus.publish('email.template_updated', {
      templateId: template.id,
      name: template.name,
      type: template.type,
    });

    return template;
  }

  /**
   * Get email templates
   */
  async getTemplates(type?: EmailTemplateType): Promise<EmailTemplate[]> {
    return this.prisma.emailTemplate.findMany({
      where: type ? { type } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get template by ID
   */
  async getTemplateById(id: string): Promise<EmailTemplate | null> {
    return this.prisma.emailTemplate.findUnique({
      where: { id },
    });
  }

  /**
   * Get active template by type
   */
  async getActiveTemplateByType(
    type: EmailTemplateType,
  ): Promise<EmailTemplate | null> {
    return this.prisma.emailTemplate.findFirst({
      where: {
        type,
        isActive: true,
      },
    });
  }

  /**
   * Delete email template
   */
  async deleteTemplate(id: string): Promise<void> {
    const template = await this.getTemplateById(id);
    if (!template) {
      throw new NotFoundException(`Email template with ID ${id} not found`);
    }

    await this.prisma.emailTemplate.delete({
      where: { id },
    });

    this.logger.log(`Deleted email template: ${template.name}`);

    // Publish event
    this.eventBus.publish('email.template_deleted', {
      templateId: id,
      name: template.name,
      type: template.type,
    });
  }

  /**
   * Track email metrics
   */
  async trackEmailMetrics(
    templateId: string,
  ): Promise<EmailMetricsResponseDto> {
    const template = await this.getTemplateById(templateId);
    if (!template) {
      throw new NotFoundException(
        `Email template with ID ${templateId} not found`,
      );
    }

    // Get today's metrics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let metrics = await this.prisma.emailMetrics.findUnique({
      where: {
        templateId_date: {
          templateId,
          date: today,
        },
      },
    });

    // If no metrics exist for today, create them
    if (!metrics) {
      metrics = await this.prisma.emailMetrics.create({
        data: {
          templateId,
          date: today,
        },
      });
    }

    // Calculate rates
    const openRate =
      metrics.sent > 0 ? (metrics.opened / metrics.sent) * 100 : 0;
    const clickRate =
      metrics.opened > 0 ? (metrics.clicked / metrics.opened) * 100 : 0;
    const bounceRate =
      metrics.sent > 0 ? (metrics.bounced / metrics.sent) * 100 : 0;
    const unsubscribeRate =
      metrics.sent > 0 ? (metrics.unsubscribed / metrics.sent) * 100 : 0;

    return {
      templateId: template.id,
      templateName: template.name,
      sent: metrics.sent,
      delivered: metrics.delivered,
      opened: metrics.opened,
      clicked: metrics.clicked,
      bounced: metrics.bounced,
      unsubscribed: metrics.unsubscribed,
      openRate: Math.round(openRate * 100) / 100,
      clickRate: Math.round(clickRate * 100) / 100,
      bounceRate: Math.round(bounceRate * 100) / 100,
      unsubscribeRate: Math.round(unsubscribeRate * 100) / 100,
      date: metrics.date,
    };
  }

  /**
   * Update email metrics (called by email delivery system)
   */
  async updateEmailMetrics(
    templateId: string,
    action:
      | 'sent'
      | 'delivered'
      | 'opened'
      | 'clicked'
      | 'bounced'
      | 'unsubscribed',
    count: number = 1,
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.emailMetrics.upsert({
      where: {
        templateId_date: {
          templateId,
          date: today,
        },
      },
      update: {
        [action]: {
          increment: count,
        },
      },
      create: {
        templateId,
        date: today,
        [action]: count,
      },
    });

    this.logger.debug(
      `Updated email metrics for template ${templateId}: ${action} +${count}`,
    );
  }

  /**
   * Get email job status
   */
  async getEmailJobStatus(jobId: string) {
    return this.prisma.emailJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        to: true,
        subject: true,
        status: true,
        attempts: true,
        lastError: true,
        createdAt: true,
        sentAt: true,
      },
    });
  }

  /**
   * Update email job status (called by queue processor)
   */
  async updateEmailJobStatus(
    jobId: string,
    status: EmailStatus,
    error?: string,
  ): Promise<void> {
    const updateData: any = {
      status,
      attempts: {
        increment: 1,
      },
    };

    if (error) {
      updateData.lastError = error;
    }

    if (status === EmailStatus.SENT) {
      updateData.sentAt = new Date();
    }

    await this.prisma.emailJob.update({
      where: { id: jobId },
      data: updateData,
    });

    this.logger.debug(`Updated email job ${jobId} status to ${status}`);
  }

  /**
   * Substitute variables in template text
   */
  private substituteVariables(
    text: string,
    variables: Record<string, any>,
  ): string {
    let result = text;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, String(value));
    }

    return result;
  }

  /**
   * Get email statistics for a date range
   */
  async getEmailStatistics(
    startDate: Date,
    endDate: Date,
    templateId?: string,
  ): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalClicked: number;
    totalBounced: number;
    totalUnsubscribed: number;
    averageOpenRate: number;
    averageClickRate: number;
    averageBounceRate: number;
  }> {
    const whereClause: any = {
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (templateId) {
      whereClause.templateId = templateId;
    }

    const metrics = await this.prisma.emailMetrics.findMany({
      where: whereClause,
    });

    const totals = metrics.reduce(
      (acc, metric) => ({
        totalSent: acc.totalSent + metric.sent,
        totalDelivered: acc.totalDelivered + metric.delivered,
        totalOpened: acc.totalOpened + metric.opened,
        totalClicked: acc.totalClicked + metric.clicked,
        totalBounced: acc.totalBounced + metric.bounced,
        totalUnsubscribed: acc.totalUnsubscribed + metric.unsubscribed,
      }),
      {
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalBounced: 0,
        totalUnsubscribed: 0,
      },
    );

    const averageOpenRate =
      totals.totalSent > 0 ? (totals.totalOpened / totals.totalSent) * 100 : 0;
    const averageClickRate =
      totals.totalOpened > 0
        ? (totals.totalClicked / totals.totalOpened) * 100
        : 0;
    const averageBounceRate =
      totals.totalSent > 0 ? (totals.totalBounced / totals.totalSent) * 100 : 0;

    return {
      ...totals,
      averageOpenRate: Math.round(averageOpenRate * 100) / 100,
      averageClickRate: Math.round(averageClickRate * 100) / 100,
      averageBounceRate: Math.round(averageBounceRate * 100) / 100,
    };
  }
}
