import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsNumber,
  IsEmail,
  IsEnum,
  IsObject,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Job search and filtering DTOs
export class PublicJobSearchDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsString()
  salaryMin?: string;

  @IsOptional()
  @IsString()
  salaryMax?: string;

  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'title' | 'location';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}

// Public application submission DTO
export class PublicApplicationDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  coverLetter?: string;

  @IsOptional()
  @IsString()
  resumeUrl?: string;

  @IsOptional()
  @IsString()
  linkedInUrl?: string;

  @IsOptional()
  @IsString()
  portfolioUrl?: string;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;

  @IsOptional()
  @IsString()
  source?: string;
}

// Career page branding DTOs
export class CareerPageThemeDto {
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @IsOptional()
  @IsString()
  textColor?: string;

  @IsOptional()
  @IsString()
  fontFamily?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @IsOptional()
  @IsString()
  faviconUrl?: string;

  // Mobile-responsive design settings (Requirement 8.6)
  @IsOptional()
  @IsObject()
  mobileSettings?: {
    showBanner?: boolean;
    compactJobCards?: boolean;
    stickyHeader?: boolean;
    bottomNavigation?: boolean;
  };

  // Custom CSS for advanced customization
  @IsOptional()
  @IsString()
  customCss?: string;
}

export class CareerPageSectionDto {
  @IsString()
  type: 'hero' | 'about' | 'benefits' | 'culture' | 'testimonials' | 'custom';

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsArray()
  items?: any[];

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}

export class CreateCareerPageDto {
  @IsString()
  companyId: string;

  @IsString()
  slug: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CareerPageSectionDto)
  sections?: CareerPageSectionDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CareerPageThemeDto)
  theme?: CareerPageThemeDto;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateCareerPageDto {
  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CareerPageSectionDto)
  sections?: CareerPageSectionDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CareerPageThemeDto)
  theme?: CareerPageThemeDto;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

// Response types
export interface PublicJob {
  id: string;
  title: string;
  description: string;
  location: string;
  salary?: string;
  requirements: string[];
  createdAt: Date;
  companyName?: string;
}

export interface PublicJobDetails extends PublicJob {
  customFields?: {
    id: string;
    fieldName: string;
    fieldType: string;
    isRequired: boolean;
    options: string[];
  }[];
}

export interface PublicJobSearchResult {
  jobs: PublicJob[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CareerPage {
  id: string;
  companyId: string;
  slug: string;
  title: string;
  description: string;
  sections: any;
  theme: any;
  isPublished: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApplicationConfirmation {
  applicationId: string;
  jobTitle: string;
  candidateName: string;
  email: string;
  appliedAt: Date;
  nextSteps: string;
}

export interface JobViewMetadata {
  jobId: string;
  source?: string;
  referrer?: string;
  userAgent?: string;
  ipAddress?: string;
  timestamp: Date;
}
