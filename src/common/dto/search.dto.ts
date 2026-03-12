import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ApplicationStatus,
  TalentStatus,
  AvailabilityStatus,
} from '@prisma/client';

/**
 * Supported entity types for search
 */
export enum SearchEntityType {
  CANDIDATE = 'candidate',
  JOB = 'job',
  APPLICATION = 'application',
  ALL = 'all',
}

/**
 * Sort order options
 */
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

/**
 * Search result sort fields
 */
export enum SearchSortField {
  RELEVANCE = 'relevance',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  NAME = 'name',
  SCORE = 'score',
}

/**
 * Main search request DTO
 */
export class SearchDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsEnum(SearchEntityType)
  entityType?: SearchEntityType = SearchEntityType.ALL;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(SearchSortField)
  sortBy?: SearchSortField = SearchSortField.RELEVANCE;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @IsOptional()
  @IsBoolean()
  highlightResults?: boolean = true;
}

/**
 * Candidate-specific search filters
 */
export class CandidateSearchFiltersDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

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
  @IsEnum(TalentStatus)
  talentStatus?: TalentStatus;

  @IsOptional()
  @IsEnum(AvailabilityStatus)
  availability?: AvailabilityStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  maxScore?: number;
}

/**
 * Job-specific search filters
 */
export class JobSearchFiltersDto {
  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requirements?: string[];

  @IsOptional()
  @IsString()
  salaryMin?: string;

  @IsOptional()
  @IsString()
  salaryMax?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;
}

/**
 * Application-specific search filters
 */
export class ApplicationSearchFiltersDto {
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @IsOptional()
  @IsUUID()
  jobId?: string;

  @IsOptional()
  @IsUUID()
  candidateId?: string;

  @IsOptional()
  @IsString()
  appliedAfter?: string;

  @IsOptional()
  @IsString()
  appliedBefore?: string;
}

/**
 * Advanced search request with filters
 */
export class AdvancedSearchDto extends SearchDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CandidateSearchFiltersDto)
  candidateFilters?: CandidateSearchFiltersDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => JobSearchFiltersDto)
  jobFilters?: JobSearchFiltersDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ApplicationSearchFiltersDto)
  applicationFilters?: ApplicationSearchFiltersDto;

  @IsOptional()
  @IsBoolean()
  useBooleanOperators?: boolean = false;
}

/**
 * Saved search DTO
 */
export class CreateSavedSearchDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  query: string;

  @IsOptional()
  @IsEnum(SearchEntityType)
  entityType?: SearchEntityType;

  @IsOptional()
  filters?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  alertEnabled?: boolean = false;

  @IsOptional()
  @IsString()
  alertFrequency?: 'daily' | 'weekly' | 'immediate';

  @IsOptional()
  @IsBoolean()
  isShared?: boolean = false;
}

export class UpdateSavedSearchDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsEnum(SearchEntityType)
  entityType?: SearchEntityType;

  @IsOptional()
  filters?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  alertEnabled?: boolean;

  @IsOptional()
  @IsString()
  alertFrequency?: 'daily' | 'weekly' | 'immediate';

  @IsOptional()
  @IsBoolean()
  isShared?: boolean;
}

/**
 * Search result item interface
 */
export interface SearchResultItem {
  id: string;
  entityType: SearchEntityType;
  title: string;
  subtitle?: string;
  description?: string;
  highlights?: SearchHighlight[];
  score: number;
  data: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Search highlight for matched terms
 */
export interface SearchHighlight {
  field: string;
  snippet: string;
  matchedTerms: string[];
}

/**
 * Paginated search results
 */
export interface SearchResults {
  items: SearchResultItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  query: string;
  entityType: SearchEntityType;
  executionTimeMs: number;
}

/**
 * Saved search interface
 */
export interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  query: string;
  entityType: SearchEntityType;
  filters?: Record<string, any>;
  alertEnabled: boolean;
  alertFrequency?: string;
  isShared: boolean;
  createdBy: string;
  lastExecutedAt?: Date;
  resultCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Search alert notification
 */
export interface SearchAlert {
  id: string;
  savedSearchId: string;
  savedSearchName: string;
  newResultsCount: number;
  results: SearchResultItem[];
  triggeredAt: Date;
}
