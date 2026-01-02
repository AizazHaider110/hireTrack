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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { NotificationService } from './notification.service';
import {
  NotificationDto,
  ApplicationStatusUpdateDto,
  InterviewReminderDto,
  CreateWebhookDto,
  UpdateWebhookDto,
  BulkNotificationDto,
  WebhookTestDto,
} from '../common/dto/notification.dto';
import { Webhook, Role } from '@prisma/client';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Send application status update notification
   */
  @Post('application-status')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  @HttpCode(HttpStatus.ACCEPTED)
  async sendApplicationStatusUpdate(
    @Body() data: ApplicationStatusUpdateDto
  ): Promise<{ message: string }> {
    await this.notificationService.sendApplicationStatusUpdate(data);
    return { message: 'Application status notification sent' };
  }

  /**
   * Send interview reminder
   */
  @Post('interview-reminder')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER, Role.INTERVIEWER)
  @HttpCode(HttpStatus.ACCEPTED)
  async sendInterviewReminder(
    @Body() data: InterviewReminderDto
  ): Promise<{ message: string }> {
    await this.notificationService.sendInterviewReminder(data);
    return { message: 'Interview reminder sent' };
  }

  /**
   * Send bulk notifications
   */
  @Post('bulk')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  @HttpCode(HttpStatus.ACCEPTED)
  async sendBulkNotifications(
    @Body() data: BulkNotificationDto
  ): Promise<{ message: string; count: number }> {
    await this.notificationService.sendBulkNotifications(data);
    return {
      message: 'Bulk notifications queued',
      count: data.notifications.length,
    };
  }

  /**
   * Create webhook subscription
   */
  @Post('webhooks')
  @Roles(Role.ADMIN, Role.HIRING_MANAGER)
  async createWebhook(
    @Body() data: CreateWebhookDto,
    @Request() req: any
  ): Promise<Webhook> {
    return this.notificationService.subscribeToWebhook(data, req.user.id);
  }

  /**
   * Get webhook subscriptions
   */
  @Get('webhooks')
  @Roles(Role.ADMIN, Role.HIRING_MANAGER, Role.RECRUITER)
  async getWebhooks(@Request() req: any): Promise<Webhook[]> {
    // Admins can see all webhooks, others only their own
    const createdBy = req.user.role === Role.ADMIN ? undefined : req.user.id;
    return this.notificationService.getWebhooks(createdBy);
  }

  /**
   * Get webhook by ID
   */
  @Get('webhooks/:id')
  @Roles(Role.ADMIN, Role.HIRING_MANAGER, Role.RECRUITER)
  async getWebhook(@Param('id') id: string): Promise<Webhook> {
    const webhook = await this.notificationService.getWebhookById(id);
    if (!webhook) {
      throw new Error('Webhook not found');
    }
    return webhook;
  }

  /**
   * Update webhook subscription
   */
  @Put('webhooks/:id')
  @Roles(Role.ADMIN, Role.HIRING_MANAGER)
  async updateWebhook(
    @Param('id') id: string,
    @Body() data: UpdateWebhookDto
  ): Promise<Webhook> {
    return this.notificationService.updateWebhook(id, data);
  }

  /**
   * Delete webhook subscription
   */
  @Delete('webhooks/:id')
  @Roles(Role.ADMIN, Role.HIRING_MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWebhook(@Param('id') id: string): Promise<void> {
    await this.notificationService.deleteWebhook(id);
  }

  /**
   * Test webhook delivery
   */
  @Post('webhooks/test')
  @Roles(Role.ADMIN, Role.HIRING_MANAGER)
  @HttpCode(HttpStatus.ACCEPTED)
  async testWebhook(@Body() data: WebhookTestDto): Promise<{ message: string }> {
    await this.notificationService.testWebhook(data);
    return { message: 'Test webhook delivery queued' };
  }

  /**
   * Get webhook delivery statistics
   */
  @Get('webhooks/:id/statistics')
  @Roles(Role.ADMIN, Role.HIRING_MANAGER, Role.RECRUITER)
  async getWebhookStatistics(
    @Param('id') id: string,
    @Query('days') days?: string
  ) {
    const dayCount = days ? parseInt(days, 10) : 30;
    return this.notificationService.getWebhookStatistics(id, dayCount);
  }
}