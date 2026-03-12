import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsUUID,
  IsUrl,
  IsNumber,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { WebhookEvent } from '@prisma/client';

export class CreateApiKeyDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  rateLimit?: number; // requests per minute
}

export class UpdateApiKeyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  rateLimit?: number;
}

export class ApiKeyResponseDto {
  id: string;
  name: string;
  description?: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  rateLimit: number;
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

export class ApiKeyCreatedResponseDto extends ApiKeyResponseDto {
  apiKey: string; // Full key only shown once on creation
}

export class IntegrationEventDto {
  @IsEnum(WebhookEvent)
  event: WebhookEvent;

  @IsObject()
  data: any;
}

export class ExternalApplicationDto {
  @IsUUID()
  jobId: string;

  @IsString()
  candidateEmail: string;

  @IsString()
  candidateName: string;

  @IsOptional()
  @IsString()
  resumeUrl?: string;

  @IsOptional()
  @IsString()
  coverLetter?: string;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;

  @IsOptional()
  @IsString()
  source?: string;
}

export class ExternalCandidateDto {
  @IsString()
  email: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  resumeUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsString()
  experience?: string;

  @IsOptional()
  @IsString()
  education?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class BulkImportDto {
  @IsArray()
  candidates: ExternalCandidateDto[];

  @IsOptional()
  @IsBoolean()
  skipDuplicates?: boolean;
}

export class IntegrationStatusDto {
  service: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: Date;
  error?: string;
}

export class RateLimitInfoDto {
  limit: number;
  remaining: number;
  resetAt: Date;
}

// API Scopes
export enum ApiScope {
  READ_JOBS = 'read:jobs',
  WRITE_JOBS = 'write:jobs',
  READ_CANDIDATES = 'read:candidates',
  WRITE_CANDIDATES = 'write:candidates',
  READ_APPLICATIONS = 'read:applications',
  WRITE_APPLICATIONS = 'write:applications',
  READ_INTERVIEWS = 'read:interviews',
  WRITE_INTERVIEWS = 'write:interviews',
  READ_ANALYTICS = 'read:analytics',
  WEBHOOKS = 'webhooks',
  ADMIN = 'admin',
}
