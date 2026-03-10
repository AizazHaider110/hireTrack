import {
  IsString,
  IsEmail,
  IsOptional,
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsUUID,
} from 'class-validator';
import { EmailTemplateType } from '@prisma/client';

export class CreateEmailTemplateDto {
  @IsString()
  name: string;

  @IsString()
  subject: string;

  @IsString()
  body: string;

  @IsArray()
  @IsString({ each: true })
  variables: string[];

  @IsEnum(EmailTemplateType)
  type: EmailTemplateType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateEmailTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[];

  @IsOptional()
  @IsEnum(EmailTemplateType)
  type?: EmailTemplateType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SendTemplateEmailDto {
  @IsEnum(EmailTemplateType)
  templateType: EmailTemplateType;

  @IsEmail()
  to: string;

  @IsObject()
  variables: Record<string, any>;

  @IsOptional()
  @IsString()
  scheduledFor?: string; // ISO date string
}

export class BulkEmailDto {
  @IsEmail()
  to: string;

  @IsString()
  subject: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;
}

export class SendBulkEmailsDto {
  @IsArray()
  emails: BulkEmailDto[];
}

export class EmailMetricsResponseDto {
  templateId: string;
  templateName: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  unsubscribeRate: number;
  date: Date;
}
