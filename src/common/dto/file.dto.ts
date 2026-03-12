import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

export enum FileEntityType {
  CANDIDATE = 'candidate',
  APPLICATION = 'application',
  JOB = 'job',
  INTERVIEW = 'interview',
  TEAM = 'team',
}

export class UploadFileDto {
  @IsEnum(FileEntityType)
  entityType: FileEntityType;

  @IsString()
  entityId: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateFileDto {
  @IsOptional()
  @IsString()
  description?: string;
}

export class FileQueryDto {
  @IsOptional()
  @IsEnum(FileEntityType)
  entityType?: FileEntityType;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsBoolean()
  includeDeleted?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class BulkDeleteDto {
  @IsArray()
  @IsString({ each: true })
  fileIds: string[];
}

export class BulkDownloadDto {
  @IsArray()
  @IsString({ each: true })
  fileIds: string[];
}

export class FileResponseDto {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  entityType: string;
  entityId: string;
  uploadedBy: string;
  version: number;
  downloadUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PresignedUrlResponseDto {
  url: string;
  expiresAt: Date;
}
