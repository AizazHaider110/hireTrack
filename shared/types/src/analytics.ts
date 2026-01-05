// Analytics Types

export interface MetricValue {
  value: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'neutral';
}

export interface DashboardSummary {
  totalApplications: number;
  totalHires: number;
  totalActiveJobs: number;
  averageTimeToHire: number;
  overallConversion: number;
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

export interface SourceMetricSummary {
  source: string;
  totalApplications: number;
  qualifiedApplications: number;
  hires: number;
  qualityScore: number;
  costPerHire: number | null;
  conversionRate: number;
}

export interface TrendDataPoint {
  date: string;
  applications: number;
  interviews: number;
  hires: number;
}

export interface DashboardMetrics {
  summary: DashboardSummary;
  conversionRates: ConversionRates;
  applicationsByStatus: StatusBreakdown[];
  funnel: FunnelStage[];
  topSources: SourceMetricSummary[];
  trends: TrendDataPoint[];
}

export interface FunnelStage {
  name: string;
  count: number;
  percentage: number;
  averageTimeInStage: number;
  dropOffRate?: number;
}

export interface FunnelData {
  stages: FunnelStage[];
  totalCandidates: number;
  overallConversion: number;
}

export interface SourceMetric {
  source: string;
  candidates: number;
  hires: number;
  conversionRate: number;
  costPerHire?: number;
}

export interface RecruitmentMetrics {
  timeToHire: MetricValue;
  costPerHire: MetricValue;
  sourceEffectiveness: SourceMetric[];
  pipelineVelocity: number;
}

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
}

export interface DateRange {
  start: string;
  end: string;
}

export type ActivityType = 
  | 'APPLICATION_RECEIVED'
  | 'STAGE_CHANGED'
  | 'INTERVIEW_SCHEDULED'
  | 'FEEDBACK_SUBMITTED'
  | 'OFFER_EXTENDED'
  | 'CANDIDATE_HIRED'
  | 'CANDIDATE_REJECTED';

export interface ActivityFeedItem {
  id: string;
  type: ActivityType;
  actor: {
    id: string;
    name: string;
    avatar?: string;
  };
  target: string;
  description: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}
