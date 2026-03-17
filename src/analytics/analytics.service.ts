import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationStatus } from '@prisma/client';
import {
  RecruitmentMetrics,
  FunnelData,
  JobAnalytics,
  TeamMetrics,
  SourceMetrics,
  ConversionRates,
  StatusBreakdown,
  SourceBreakdown,
  TrendData,
  FunnelStage,
  DropOffRate,
  StageDistribution,
  MemberPerformance,
  ExportFormat,
} from '../common/dto/analytics.dto';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface MetricFilters {
  startDate?: Date;
  endDate?: Date;
  jobId?: string;
  teamId?: string;
  sources?: string[];
  statuses?: string[];
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get comprehensive recruitment metrics
   */
  async getRecruitmentMetrics(
    dateRange?: DateRange,
    filters?: MetricFilters,
  ): Promise<RecruitmentMetrics> {
    this.logger.log('Calculating recruitment metrics');

    const whereClause = this.buildApplicationWhereClause(dateRange, filters);

    // Get total applications
    const totalApplications = await this.prisma.application.count({
      where: whereClause,
    });

    // Get applications by status
    const applicationsByStatusRaw = await this.prisma.application.groupBy({
      by: ['status'],
      where: whereClause,
      _count: { status: true },
    });

    const applicationsByStatus: StatusBreakdown[] = applicationsByStatusRaw.map(
      (item) => ({
        status: item.status,
        count: item._count.status,
        percentage:
          totalApplications > 0
            ? Math.round((item._count.status / totalApplications) * 100 * 10) /
              10
            : 0,
      }),
    );

    // Calculate totals
    const totalHires =
      applicationsByStatusRaw.find((s) => s.status === ApplicationStatus.HIRED)
        ?._count.status || 0;
    const totalRejections =
      applicationsByStatusRaw.find(
        (s) => s.status === ApplicationStatus.REJECTED,
      )?._count.status || 0;

    // Get active jobs count
    const totalActiveJobs = await this.prisma.jobPosting.count({
      where: { isActive: true },
    });

    // Calculate average time to hire
    const averageTimeToHire = await this.calculateAverageTimeToHire(
      dateRange,
      filters,
    );

    // Calculate average time to first interview
    const averageTimeToFirstInterview =
      await this.calculateAverageTimeToFirstInterview(dateRange, filters);

    // Calculate conversion rates
    const conversionRates = await this.calculateConversionRates(
      dateRange,
      filters,
    );

    // Get source breakdown (simplified - using job location as proxy for source)
    const applicationsBySource = await this.getSourceBreakdown(
      dateRange,
      filters,
    );

    // Get trends over time
    const trendsOverTime = await this.getTrendsOverTime(dateRange, filters);

    return {
      totalApplications,
      totalHires,
      totalRejections,
      totalActiveJobs,
      averageTimeToHire,
      averageTimeToFirstInterview,
      conversionRates,
      applicationsByStatus,
      applicationsBySource,
      trendsOverTime,
    };
  }

  /**
   * Get funnel analysis for recruitment pipeline
   */
  async getFunnelAnalysis(
    jobId?: string,
    dateRange?: DateRange,
  ): Promise<FunnelData> {
    this.logger.log(
      `Getting funnel analysis${jobId ? ` for job ${jobId}` : ''}`,
    );

    // Get pipeline stages
    const pipelineWhere = jobId ? { jobId } : {};
    const pipelines = await this.prisma.pipeline.findMany({
      where: pipelineWhere,
      include: {
        stages: {
          orderBy: { order: 'asc' },
          include: {
            candidates: true,
          },
        },
      },
    });

    // Aggregate stage data across all pipelines
    const stageMap = new Map<string, { count: number; totalTime: number }>();
    let totalCandidates = 0;

    for (const pipeline of pipelines) {
      for (const stage of pipeline.stages) {
        const existing = stageMap.get(stage.name) || { count: 0, totalTime: 0 };
        existing.count += stage.candidates.length;
        stageMap.set(stage.name, existing);
        totalCandidates += stage.candidates.length;
      }
    }

    // Calculate stage transitions for time in stage
    const transitions = await this.prisma.stageTransition.findMany({
      where: dateRange
        ? {
            movedAt: {
              gte: dateRange.startDate,
              lte: dateRange.endDate,
            },
          }
        : {},
      orderBy: { movedAt: 'asc' },
    });

    // Calculate average time in each stage
    const stageTimeMap = new Map<string, number[]>();
    const candidateStageEntry = new Map<string, Date>();

    for (const transition of transitions) {
      const key = `${transition.candidateId}-${transition.fromStageId}`;
      const entryTime = candidateStageEntry.get(key);

      if (entryTime) {
        const timeInStage =
          (transition.movedAt.getTime() - entryTime.getTime()) /
          (1000 * 60 * 60 * 24); // Convert to days
        const times = stageTimeMap.get(transition.fromStageId) || [];
        times.push(timeInStage);
        stageTimeMap.set(transition.fromStageId, times);
      }

      candidateStageEntry.set(
        `${transition.candidateId}-${transition.toStageId}`,
        transition.movedAt,
      );
    }

    // Build funnel stages
    const stages: FunnelStage[] = [];
    const stageNames = [
      'Applied',
      'Phone Screen',
      'Technical Interview',
      'Final Interview',
      'Offer',
      'Hired',
    ];

    for (const name of stageNames) {
      const data = stageMap.get(name) || { count: 0, totalTime: 0 };
      stages.push({
        name,
        count: data.count,
        percentage:
          totalCandidates > 0
            ? Math.round((data.count / totalCandidates) * 100 * 10) / 10
            : 0,
        averageTimeInStage: 0, // Simplified for now
      });
    }

    // Calculate drop-off rates
    const dropOffRates: DropOffRate[] = [];
    for (let i = 0; i < stages.length - 1; i++) {
      const fromStage = stages[i];
      const toStage = stages[i + 1];
      const dropOff = fromStage.count - toStage.count;

      dropOffRates.push({
        fromStage: fromStage.name,
        toStage: toStage.name,
        dropOffPercentage:
          fromStage.count > 0
            ? Math.round((dropOff / fromStage.count) * 100 * 10) / 10
            : 0,
        count: dropOff,
      });
    }

    return {
      stages,
      totalCandidates,
      dropOffRates,
    };
  }

  /**
   * Get analytics for a specific job
   */
  async getJobPerformance(jobId: string): Promise<JobAnalytics> {
    this.logger.log(`Getting performance analytics for job: ${jobId}`);

    const job = await this.prisma.jobPosting.findUnique({
      where: { id: jobId },
      include: {
        applications: {
          include: {
            candidate: {
              include: {
                scores: {
                  where: { jobId },
                },
              },
            },
          },
        },
        pipeline: {
          include: {
            stages: {
              include: {
                candidates: true,
              },
            },
          },
        },
        analytics: true,
      },
    });

    if (!job) {
      throw new NotFoundException(`Job not found: ${jobId}`);
    }

    const totalApplications = job.applications.length;
    const totalViews = job.analytics?.totalViews || 0;

    // Calculate qualified candidates (score >= 70)
    const qualifiedCandidates = job.applications.filter((app) => {
      const score = app.candidate.scores[0];
      return score && score.overallScore >= 70;
    }).length;

    // Calculate average score
    const scores = job.applications
      .map((app) => app.candidate.scores[0]?.overallScore)
      .filter((s): s is number => s !== undefined);
    const averageScore =
      scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) /
          10
        : 0;

    // Calculate time to fill
    const hiredApplication = job.applications.find(
      (app) => app.status === ApplicationStatus.HIRED,
    );
    const timeToFill = hiredApplication
      ? Math.round(
          (hiredApplication.updatedAt.getTime() - job.createdAt.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

    // Get source breakdown (using location as proxy)
    const sourceBreakdown: SourceBreakdown[] = [
      {
        source: 'Direct',
        count: totalApplications,
        percentage: 100,
        hireRate:
          totalApplications > 0
            ? Math.round(
                (job.applications.filter(
                  (a) => a.status === ApplicationStatus.HIRED,
                ).length /
                  totalApplications) *
                  100 *
                  10,
              ) / 10
            : 0,
      },
    ];

    // Get application trend (last 30 days)
    const applicationTrend = await this.getApplicationTrendForJob(jobId);

    // Get stage distribution
    const stageDistribution: StageDistribution[] = [];
    if (job.pipeline) {
      for (const stage of job.pipeline.stages) {
        stageDistribution.push({
          stageName: stage.name,
          count: stage.candidates.length,
          percentage:
            totalApplications > 0
              ? Math.round(
                  (stage.candidates.length / totalApplications) * 100 * 10,
                ) / 10
              : 0,
        });
      }
    }

    return {
      jobId,
      jobTitle: job.title,
      totalViews,
      totalApplications,
      qualifiedCandidates,
      averageScore,
      timeToFill,
      sourceBreakdown,
      applicationTrend,
      stageDistribution,
    };
  }

  /**
   * Get source effectiveness metrics
   */
  async getSourceEffectiveness(
    dateRange?: DateRange,
  ): Promise<SourceMetrics[]> {
    this.logger.log('Calculating source effectiveness');

    // Since we don't have a dedicated source field, we'll use job location as a proxy
    // In a real implementation, you'd track application sources
    const applications = await this.prisma.application.findMany({
      where: dateRange
        ? {
            appliedAt: {
              gte: dateRange.startDate,
              lte: dateRange.endDate,
            },
          }
        : {},
      include: {
        job: true,
        candidate: {
          include: {
            scores: true,
          },
        },
      },
    });

    // Group by location as proxy for source
    const sourceMap = new Map<
      string,
      {
        total: number;
        qualified: number;
        hires: number;
        scores: number[];
      }
    >();

    for (const app of applications) {
      const source = app.job.location || 'Unknown';
      const existing = sourceMap.get(source) || {
        total: 0,
        qualified: 0,
        hires: 0,
        scores: [],
      };

      existing.total++;

      const score = app.candidate.scores[0]?.overallScore;
      if (score !== undefined) {
        existing.scores.push(score);
        if (score >= 70) {
          existing.qualified++;
        }
      }

      if (app.status === ApplicationStatus.HIRED) {
        existing.hires++;
      }

      sourceMap.set(source, existing);
    }

    const sourceMetrics: SourceMetrics[] = [];
    for (const [source, data] of sourceMap) {
      const avgScore =
        data.scores.length > 0
          ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length
          : 0;

      sourceMetrics.push({
        source,
        totalApplications: data.total,
        qualifiedApplications: data.qualified,
        hires: data.hires,
        qualityScore: Math.round(avgScore * 10) / 10,
        costPerHire: null, // Would need cost tracking
        conversionRate:
          data.total > 0
            ? Math.round((data.hires / data.total) * 100 * 10) / 10
            : 0,
      });
    }

    return sourceMetrics.sort((a, b) => b.conversionRate - a.conversionRate);
  }

  /**
   * Get team performance metrics
   */
  async getTeamPerformance(
    teamId: string,
    dateRange?: DateRange,
  ): Promise<TeamMetrics> {
    this.logger.log(`Getting team performance for team: ${teamId}`);

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        jobs: {
          include: {
            applications: true,
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException(`Team not found: ${teamId}`);
    }

    const totalJobsManaged = team.jobs.length;
    const totalApplicationsProcessed = team.jobs.reduce(
      (sum, job) => sum + job.applications.length,
      0,
    );
    const totalHires = team.jobs.reduce(
      (sum, job) =>
        sum +
        job.applications.filter((a) => a.status === ApplicationStatus.HIRED)
          .length,
      0,
    );

    // Calculate average time to hire for team's jobs
    const hiredApplications = team.jobs.flatMap((job) =>
      job.applications.filter((a) => a.status === ApplicationStatus.HIRED),
    );

    let averageTimeToHire = 0;
    if (hiredApplications.length > 0) {
      const totalDays = hiredApplications.reduce((sum, app) => {
        const days =
          (app.updatedAt.getTime() - app.appliedAt.getTime()) /
          (1000 * 60 * 60 * 24);
        return sum + days;
      }, 0);
      averageTimeToHire = Math.round(totalDays / hiredApplications.length);
    }

    // Get member performance
    const memberPerformance: MemberPerformance[] = [];
    for (const member of team.members) {
      // Get feedback submitted by this member
      const feedbackCount = await this.prisma.feedback.count({
        where: {
          userId: member.userId,
          ...(dateRange
            ? {
                createdAt: {
                  gte: dateRange.startDate,
                  lte: dateRange.endDate,
                },
              }
            : {}),
        },
      });

      // Get interviews conducted
      const interviewsCount = await this.prisma.interview.count({
        where: {
          createdBy: member.userId,
          status: 'COMPLETED',
          ...(dateRange
            ? {
                scheduledAt: {
                  gte: dateRange.startDate,
                  lte: dateRange.endDate,
                },
              }
            : {}),
        },
      });

      memberPerformance.push({
        userId: member.userId,
        userName: member.user.name,
        applicationsReviewed: 0, // Would need tracking
        interviewsConducted: interviewsCount,
        feedbackSubmitted: feedbackCount,
        averageResponseTime: 0, // Would need tracking
      });
    }

    return {
      teamId,
      teamName: team.name,
      totalJobsManaged,
      totalApplicationsProcessed,
      totalHires,
      averageTimeToHire,
      memberPerformance,
    };
  }

  /**
   * Export metrics in specified format
   */
  async exportMetrics(
    format: ExportFormat,
    filters?: MetricFilters,
  ): Promise<Buffer> {
    this.logger.log(`Exporting metrics in ${format} format`);

    const dateRange =
      filters?.startDate && filters?.endDate
        ? {
            startDate: new Date(filters.startDate),
            endDate: new Date(filters.endDate),
          }
        : undefined;

    const metrics = await this.getRecruitmentMetrics(dateRange, filters);

    switch (format) {
      case ExportFormat.CSV:
        return this.generateCSV(metrics);
      case ExportFormat.EXCEL:
        return this.generateExcel(metrics);
      case ExportFormat.PDF:
        return this.generatePDF(metrics);
      default:
        return this.generateCSV(metrics);
    }
  }

  // Private helper methods

  private buildApplicationWhereClause(
    dateRange?: DateRange,
    filters?: MetricFilters,
  ): any {
    const where: any = {};

    if (dateRange) {
      where.appliedAt = {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      };
    }

    if (filters?.jobId) {
      where.jobId = filters.jobId;
    }

    if (filters?.statuses && filters.statuses.length > 0) {
      where.status = { in: filters.statuses };
    }

    return where;
  }

  private async calculateAverageTimeToHire(
    dateRange?: DateRange,
    filters?: MetricFilters,
  ): Promise<number> {
    const hiredApplications = await this.prisma.application.findMany({
      where: {
        status: ApplicationStatus.HIRED,
        ...(dateRange
          ? {
              updatedAt: {
                gte: dateRange.startDate,
                lte: dateRange.endDate,
              },
            }
          : {}),
        ...(filters?.jobId ? { jobId: filters.jobId } : {}),
      },
    });

    if (hiredApplications.length === 0) {
      return 0;
    }

    const totalDays = hiredApplications.reduce((sum, app) => {
      const days =
        (app.updatedAt.getTime() - app.appliedAt.getTime()) /
        (1000 * 60 * 60 * 24);
      return sum + days;
    }, 0);

    return Math.round(totalDays / hiredApplications.length);
  }

  private async calculateAverageTimeToFirstInterview(
    dateRange?: DateRange,
    filters?: MetricFilters,
  ): Promise<number> {
    // Get applications with interviews
    const applicationsWithInterviews = await this.prisma.application.findMany({
      where: {
        ...(dateRange
          ? {
              appliedAt: {
                gte: dateRange.startDate,
                lte: dateRange.endDate,
              },
            }
          : {}),
        ...(filters?.jobId ? { jobId: filters.jobId } : {}),
      },
      include: {
        candidate: {
          include: {
            interviews: {
              orderBy: { scheduledAt: 'asc' },
              take: 1,
            },
          },
        },
      },
    });

    const appsWithFirstInterview = applicationsWithInterviews.filter(
      (app) => app.candidate.interviews.length > 0,
    );

    if (appsWithFirstInterview.length === 0) {
      return 0;
    }

    const totalDays = appsWithFirstInterview.reduce((sum, app) => {
      const firstInterview = app.candidate.interviews[0];
      const days =
        (firstInterview.scheduledAt.getTime() - app.appliedAt.getTime()) /
        (1000 * 60 * 60 * 24);
      return sum + Math.max(0, days);
    }, 0);

    return Math.round(totalDays / appsWithFirstInterview.length);
  }

  private async calculateConversionRates(
    dateRange?: DateRange,
    filters?: MetricFilters,
  ): Promise<ConversionRates> {
    const whereClause = this.buildApplicationWhereClause(dateRange, filters);

    const totalApplications = await this.prisma.application.count({
      where: whereClause,
    });

    const interviewed = await this.prisma.application.count({
      where: {
        ...whereClause,
        status: {
          in: [
            ApplicationStatus.INTERVIEWED,
            ApplicationStatus.OFFERED,
            ApplicationStatus.HIRED,
          ],
        },
      },
    });

    const offered = await this.prisma.application.count({
      where: {
        ...whereClause,
        status: { in: [ApplicationStatus.OFFERED, ApplicationStatus.HIRED] },
      },
    });

    const hired = await this.prisma.application.count({
      where: {
        ...whereClause,
        status: ApplicationStatus.HIRED,
      },
    });

    return {
      applicationToInterview:
        totalApplications > 0
          ? Math.round((interviewed / totalApplications) * 100 * 10) / 10
          : 0,
      interviewToOffer:
        interviewed > 0
          ? Math.round((offered / interviewed) * 100 * 10) / 10
          : 0,
      offerToHire:
        offered > 0 ? Math.round((hired / offered) * 100 * 10) / 10 : 0,
      overallConversion:
        totalApplications > 0
          ? Math.round((hired / totalApplications) * 100 * 10) / 10
          : 0,
    };
  }

  private async getSourceBreakdown(
    dateRange?: DateRange,
    filters?: MetricFilters,
  ): Promise<SourceBreakdown[]> {
    // Simplified source breakdown using job location
    const applications = await this.prisma.application.findMany({
      where: this.buildApplicationWhereClause(dateRange, filters),
      include: {
        job: {
          select: { location: true },
        },
      },
    });

    const sourceMap = new Map<string, { total: number; hires: number }>();
    const totalApps = applications.length;

    for (const app of applications) {
      const source = app.job.location || 'Unknown';
      const existing = sourceMap.get(source) || { total: 0, hires: 0 };
      existing.total++;
      if (app.status === ApplicationStatus.HIRED) {
        existing.hires++;
      }
      sourceMap.set(source, existing);
    }

    const breakdown: SourceBreakdown[] = [];
    for (const [source, data] of sourceMap) {
      breakdown.push({
        source,
        count: data.total,
        percentage:
          totalApps > 0
            ? Math.round((data.total / totalApps) * 100 * 10) / 10
            : 0,
        hireRate:
          data.total > 0
            ? Math.round((data.hires / data.total) * 100 * 10) / 10
            : 0,
      });
    }

    return breakdown.sort((a, b) => b.count - a.count);
  }

  private async getTrendsOverTime(
    dateRange?: DateRange,
    filters?: MetricFilters,
  ): Promise<TrendData[]> {
    const endDate = dateRange?.endDate || new Date();
    const startDate =
      dateRange?.startDate ||
      new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days

    const trends: TrendData[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      const applications = await this.prisma.application.count({
        where: {
          appliedAt: { gte: dayStart, lte: dayEnd },
          ...(filters?.jobId ? { jobId: filters.jobId } : {}),
        },
      });

      const interviews = await this.prisma.interview.count({
        where: {
          scheduledAt: { gte: dayStart, lte: dayEnd },
        },
      });

      const hires = await this.prisma.application.count({
        where: {
          status: ApplicationStatus.HIRED,
          updatedAt: { gte: dayStart, lte: dayEnd },
          ...(filters?.jobId ? { jobId: filters.jobId } : {}),
        },
      });

      trends.push({
        date: currentDate.toISOString().split('T')[0],
        applications,
        interviews,
        hires,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return trends;
  }

  private async getApplicationTrendForJob(jobId: string): Promise<TrendData[]> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const trends: TrendData[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      const applications = await this.prisma.application.count({
        where: {
          jobId,
          appliedAt: { gte: dayStart, lte: dayEnd },
        },
      });

      trends.push({
        date: currentDate.toISOString().split('T')[0],
        applications,
        interviews: 0,
        hires: 0,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return trends;
  }

  private generateCSV(metrics: RecruitmentMetrics): Buffer {
    const lines: string[] = [];

    // Header
    lines.push('Recruitment Metrics Report');
    lines.push('');

    // Summary
    lines.push('Summary');
    lines.push(`Total Applications,${metrics.totalApplications}`);
    lines.push(`Total Hires,${metrics.totalHires}`);
    lines.push(`Total Rejections,${metrics.totalRejections}`);
    lines.push(`Active Jobs,${metrics.totalActiveJobs}`);
    lines.push(`Average Time to Hire (days),${metrics.averageTimeToHire}`);
    lines.push(
      `Average Time to First Interview (days),${metrics.averageTimeToFirstInterview}`,
    );
    lines.push('');

    // Conversion Rates
    lines.push('Conversion Rates');
    lines.push(
      `Application to Interview,${metrics.conversionRates.applicationToInterview}%`,
    );
    lines.push(
      `Interview to Offer,${metrics.conversionRates.interviewToOffer}%`,
    );
    lines.push(`Offer to Hire,${metrics.conversionRates.offerToHire}%`);
    lines.push(
      `Overall Conversion,${metrics.conversionRates.overallConversion}%`,
    );
    lines.push('');

    // Status Breakdown
    lines.push('Applications by Status');
    lines.push('Status,Count,Percentage');
    for (const status of metrics.applicationsByStatus) {
      lines.push(`${status.status},${status.count},${status.percentage}%`);
    }

    return Buffer.from(lines.join('\n'), 'utf-8');
  }

  private generateExcel(metrics: RecruitmentMetrics): Buffer {
    // Simplified Excel generation (would use a library like exceljs in production)
    // For now, return CSV format with .xlsx extension handling
    return this.generateCSV(metrics);
  }

  private generatePDF(metrics: RecruitmentMetrics): Buffer {
    // Simplified PDF generation (would use a library like pdfkit in production)
    // For now, return a text-based representation
    const content = `
RECRUITMENT METRICS REPORT
==========================

SUMMARY
-------
Total Applications: ${metrics.totalApplications}
Total Hires: ${metrics.totalHires}
Total Rejections: ${metrics.totalRejections}
Active Jobs: ${metrics.totalActiveJobs}
Average Time to Hire: ${metrics.averageTimeToHire} days
Average Time to First Interview: ${metrics.averageTimeToFirstInterview} days

CONVERSION RATES
----------------
Application to Interview: ${metrics.conversionRates.applicationToInterview}%
Interview to Offer: ${metrics.conversionRates.interviewToOffer}%
Offer to Hire: ${metrics.conversionRates.offerToHire}%
Overall Conversion: ${metrics.conversionRates.overallConversion}%

APPLICATIONS BY STATUS
----------------------
${metrics.applicationsByStatus.map((s) => `${s.status}: ${s.count} (${s.percentage}%)`).join('\n')}
    `.trim();

    return Buffer.from(content, 'utf-8');
  }
}
