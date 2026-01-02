import { IsString, IsEmail, IsOptional, IsArray, IsBoolean, IsEnum, IsObject, IsUUID, IsUrl } from 'class-validator';
import { WebhookEvent } from '@prisma/client';

export class NotificationDto {
  @IsEmail()
  to: string;

  @IsString()
  subject: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class ApplicationStatusUpdateDto {
  @IsUUID()
  applicationId: string;

  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  message?: string;
}

export class InterviewReminderDto {
  @IsUUID()
  interviewId: string;

  @IsOptional()
  @IsString()
  customMessage?: string;
}

export class CreateWebhookDto {
  @IsUrl()
  url: string;

  @IsArray()
  @IsEnum(WebhookEvent, { each: true })
  events: WebhookEvent[];

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateWebhookDto {
  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(WebhookEvent, { each: true })
  events?: WebhookEvent[];

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class WebhookDeliveryDto {
  @IsUUID()
  webhookId: string;

  @IsEnum(WebhookEvent)
  event: WebhookEvent;

  @IsObject()
  payload: any;
}

export class BulkNotificationDto {
  @IsArray()
  notifications: NotificationDto[];
}

export class WebhookTestDto {
  @IsUUID()
  webhookId: string;

  @IsOptional()
  @IsObject()
  testPayload?: any;
}