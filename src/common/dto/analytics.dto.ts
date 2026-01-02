import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsArray,
} from 'class-validator';

export enum ExportFormat {
  CSV = 'CSV',
  PDF = 'PDF',
  EXCEL = 'EXCEL',
}

export class DateRangeDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}

export class MetricFiltersDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  jobId?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sources?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  statuses?: string[];
}

export class ExportMetricsDto {
  @IsEnum(ExportFormat)
  format: ExportFormat;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  jobId?: string;

  @IsOptional()
  @IsString()
  teamId?: string;
}

// Response interfaces
export interface RecruitmentMetrics {
  totalApplications: number;
  totalHires: number;
  totalRejections: number;
  totalActiveJobs: number;
  averageTimeToHire: number; // in days
  averageTimeToFirstInterview: number; // in days
  conversionRates: ConversionRates;
  applicationsByStatus: StatusBreakdown[];
  applicationsBySource: SourceBreakdown[];
  trendsOverTime: TrendData[];
}

export interface ConversionRates {
  applicationToInterview: number;
  interviewToOffer: number;
  offerToHire: number;
  overallConversion: number;
}

export interface StatusBreakdown {
  status: string;
  count: number;
  percentage: number;
}

export interface SourceBreakdown {
  source: string;
  count: number;
  percentage: number;
  hireRate: number;
}

export interface TrendData {
  date: string;
  applications: number;
  interviews: number;
  hires: number;
}

export interface FunnelData {
  stages: FunnelStage[];
  totalCandidates: number;
  dropOffRates: DropOffRate[];
}

export interface FunnelStage {
  name: string;
  count: number;
  percentage: number;
  averageTimeInStage: number; // in days
}

export interface DropOffRate {
  fromStage: string;
  toStage: string;
  dropOffPercentage: number;
  count: number;
}

export interface JobAnalytics {
  jobId: string;
  jobTitle: string;
  totalViews: number;
  totalApplications: number;
  qualifiedCandidates: number;
  averageScore: number;
  timeToFill: number | null; // in days, null if not filled
  sourceBreakdown: SourceBreakdown[];
  applicationTrend: TrendData[];
  stageDistribution: StageDistribution[];
}

export interface StageDistribution {
  stageName: string;
  count: number;
  percentage: number;
}

export interface TeamMetrics {
  teamId: string;
  teamName: string;
  totalJobsManaged: number;
  totalApplicationsProcessed: number;
  totalHires: number;
  averageTimeToHire: number;
  memberPerformance: MemberPerformance[];
}

export interface MemberPerformance {
  userId: string;
  userName: string;
  applicationsReviewed: number;
  interviewsConducted: number;
  feedbackSubmitted: number;
  averageResponseTime: number; // in hours
}

export interface SourceMetrics {
  source: string;
  totalApplications: number;
  qualifiedApplications: number;
  hires: number;
  qualityScore: number;
  costPerHire: number | null;
  conversionRate: number;
}
