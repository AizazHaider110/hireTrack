import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TalentStatus, AvailabilityStatus } from '@prisma/client';

export class AddToTalentPoolDto {
  @IsUUID()
  candidateId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsEnum(TalentStatus)
  status: TalentStatus;

  @IsEnum(AvailabilityStatus)
  availability: AvailabilityStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  source?: string;
}

export class UpdateTalentPoolEntryDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(TalentStatus)
  status?: TalentStatus;

  @IsOptional()
  @IsEnum(AvailabilityStatus)
  availability?: AvailabilityStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class TalentPoolSearchDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(TalentStatus)
  status?: TalentStatus;

  @IsOptional()
  @IsEnum(AvailabilityStatus)
  availability?: AvailabilityStatus;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minExperienceYears?: number;

  @IsOptional()
  @IsInt()
  @Max(50)
  maxExperienceYears?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}

export class RecordEngagementDto {
  @IsString()
  type: string; // 'email', 'call', 'meeting', 'note'

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  outcome?: string;
}

export class BulkImportCandidateDto {
  @IsString()
  name: string;

  @IsString()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

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
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(TalentStatus)
  status?: TalentStatus;

  @IsOptional()
  @IsEnum(AvailabilityStatus)
  availability?: AvailabilityStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  source?: string;
}

export class BulkImportDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkImportCandidateDto)
  candidates: BulkImportCandidateDto[];
}

export class SuggestCandidatesDto {
  @IsUUID()
  jobId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  minMatchScore?: number;
}

export interface TalentPoolEntry {
  id: string;
  candidateId: string;
  candidate: {
    id: string;
    skills: string[];
    education: string | null;
    experience: string | null;
    user: {
      id: string;
      name: string;
      email: string;
      phone: string | null;
    };
  };
  tags: string[];
  status: TalentStatus;
  availability: AvailabilityStatus;
  lastContactedAt: Date | null;
  notes: string | null;
  addedBy: string;
  addedAt: Date;
  updatedAt: Date;
}

export interface CandidateMatch {
  entry: TalentPoolEntry;
  matchScore: number;
  matchDetails: {
    skillsMatch: number;
    experienceMatch: number;
    availabilityBonus: number;
  };
}

export interface EngagementActivity {
  id: string;
  entryId: string;
  type: string;
  description: string;
  outcome?: string;
  recordedBy: string;
  recordedAt: Date;
}

export interface TalentPoolSearchResult {
  entries: TalentPoolEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
