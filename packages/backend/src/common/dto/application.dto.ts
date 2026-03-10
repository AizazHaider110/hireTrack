import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApplicationStatus } from '@prisma/client';

export class CreateApplicationDto {
  @IsString()
  jobId: string;

  @IsOptional()
  @IsString()
  coverLetter?: string;

  @IsOptional()
  @IsString()
  resumeUrl?: string;
}

export class UpdateApplicationDto {
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @IsOptional()
  @IsString()
  coverLetter?: string;
}
