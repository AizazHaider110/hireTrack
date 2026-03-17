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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EmailService } from './email.service';
import {
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
  SendTemplateEmailDto,
  SendBulkEmailsDto,
  EmailMetricsResponseDto,
} from '../common/dto/email.dto';
import { EmailTemplate, EmailTemplateType, Role } from '@prisma/client';

@Controller('email')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  /**
   * Send email using template
   */
  @Post('send-template')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  @HttpCode(HttpStatus.ACCEPTED)
  async sendTemplateEmail(
    @Body() data: SendTemplateEmailDto,
  ): Promise<{ message: string }> {
    await this.emailService.sendTemplateEmail(data);
    return { message: 'Email queued for sending' };
  }

  /**
   * Send bulk emails
   */
  @Post('send-bulk')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  @HttpCode(HttpStatus.ACCEPTED)
  async sendBulkEmails(
    @Body() data: SendBulkEmailsDto,
  ): Promise<{ message: string; count: number }> {
    await this.emailService.sendBulkEmails(data.emails);
    return {
      message: 'Bulk emails queued for sending',
      count: data.emails.length,
    };
  }

  /**
   * Create email template
   */
  @Post('templates')
  @Roles(Role.ADMIN, Role.HIRING_MANAGER)
  async createTemplate(
    @Body() data: CreateEmailTemplateDto,
  ): Promise<EmailTemplate> {
    return this.emailService.createTemplate(data);
  }

  /**
   * Get all email templates
   */
  @Get('templates')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER, Role.INTERVIEWER)
  async getTemplates(
    @Query('type') type?: EmailTemplateType,
  ): Promise<EmailTemplate[]> {
    return this.emailService.getTemplates(type);
  }

  /**
   * Get email template by ID
   */
  @Get('templates/:id')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER, Role.INTERVIEWER)
  async getTemplate(@Param('id') id: string): Promise<EmailTemplate> {
    const template = await this.emailService.getTemplateById(id);
    if (!template) {
      throw new Error('Template not found');
    }
    return template;
  }

  /**
   * Update email template
   */
  @Put('templates/:id')
  @Roles(Role.ADMIN, Role.HIRING_MANAGER)
  async updateTemplate(
    @Param('id') id: string,
    @Body() data: UpdateEmailTemplateDto,
  ): Promise<EmailTemplate> {
    return this.emailService.updateTemplate(id, data);
  }

  /**
   * Delete email template
   */
  @Delete('templates/:id')
  @Roles(Role.ADMIN, Role.HIRING_MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTemplate(@Param('id') id: string): Promise<void> {
    await this.emailService.deleteTemplate(id);
  }

  /**
   * Get email template metrics
   */
  @Get('templates/:id/metrics')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async getTemplateMetrics(
    @Param('id') id: string,
  ): Promise<EmailMetricsResponseDto> {
    return this.emailService.trackEmailMetrics(id);
  }

  /**
   * Get email job status
   */
  @Get('jobs/:id/status')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async getEmailJobStatus(@Param('id') id: string) {
    return this.emailService.getEmailJobStatus(id);
  }

  /**
   * Get email statistics for a date range
   */
  @Get('statistics')
  @Roles(Role.ADMIN, Role.HIRING_MANAGER)
  async getEmailStatistics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('templateId') templateId?: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    return this.emailService.getEmailStatistics(start, end, templateId);
  }
}
