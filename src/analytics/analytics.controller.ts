import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  Res,
  UseGuards,
  Req,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import {
  AnalyticsService,
  DateRange,
  MetricFilters,
} from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  MetricFiltersDto,
  ExportMetricsDto,
  ExportFormat,
  RecruitmentMetrics,
  FunnelData,
  JobAnalytics,
  TeamMetrics,
  SourceMetrics,
} from '../common/dto/analytics.dto';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get comprehensive recruitment metrics
   */
  @Get('metrics')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async getRecruitmentMetrics(
    @Query() filters: MetricFiltersDto,
    @Req() req: any,
  ): Promise<RecruitmentMetrics> {
    const dateRange = this.buildDateRange(filters.startDate, filters.endDate);
    const metricFilters = this.buildMetricFilters(filters, req.user);

    return this.analyticsService.getRecruitmentMetrics(
      dateRange,
      metricFilters,
    );
  }

  /**
   * Get funnel analysis for recruitment pipeline
   */
  @Get('funnel')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async getFunnelAnalysis(
    @Query('jobId') jobId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Req() req?: any,
  ): Promise<FunnelData> {
    // Verify job access if jobId provided
    if (jobId) {
      await this.verifyJobAccess(jobId, req.user.id, req.user.role);
    }

    const dateRange = this.buildDateRange(startDate, endDate);
    return this.analyticsService.getFunnelAnalysis(jobId, dateRange);
  }

  /**
   * Get analytics for a specific job
   */
  @Get('job/:jobId')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER, Role.INTERVIEWER)
  async getJobPerformance(
    @Param('jobId') jobId: string,
    @Req() req: any,
  ): Promise<JobAnalytics> {
    await this.verifyJobAccess(jobId, req.user.id, req.user.role);
    return this.analyticsService.getJobPerformance(jobId);
  }

  /**
   * Get source effectiveness metrics
   */
  @Get('sources')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async getSourceEffectiveness(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<SourceMetrics[]> {
    const dateRange = this.buildDateRange(startDate, endDate);
    return this.analyticsService.getSourceEffectiveness(dateRange);
  }

  /**
   * Get team performance metrics
   */
  @Get('team/:teamId')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async getTeamPerformance(
    @Param('teamId') teamId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Req() req?: any,
  ): Promise<TeamMetrics> {
    await this.verifyTeamAccess(teamId, req.user.id, req.user.role);
    const dateRange = this.buildDateRange(startDate, endDate);
    return this.analyticsService.getTeamPerformance(teamId, dateRange);
  }

  /**
   * Get real-time dashboard metrics
   */
  @Get('dashboard')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async getDashboardMetrics(@Req() req: any): Promise<any> {
    // Get metrics for last 30 days
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dateRange = { startDate, endDate };

    const [metrics, funnel, sources] = await Promise.all([
      this.analyticsService.getRecruitmentMetrics(dateRange),
      this.analyticsService.getFunnelAnalysis(undefined, dateRange),
      this.analyticsService.getSourceEffectiveness(dateRange),
    ]);

    return {
      summary: {
        totalApplications: metrics.totalApplications,
        totalHires: metrics.totalHires,
        totalActiveJobs: metrics.totalActiveJobs,
        averageTimeToHire: metrics.averageTimeToHire,
        overallConversion: metrics.conversionRates.overallConversion,
      },
      conversionRates: metrics.conversionRates,
      applicationsByStatus: metrics.applicationsByStatus,
      funnel: funnel.stages,
      topSources: sources.slice(0, 5),
      trends: metrics.trendsOverTime.slice(-7), // Last 7 days
    };
  }

  /**
   * Get historical comparison metrics
   */
  @Get('comparison')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async getHistoricalComparison(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('compareStartDate') compareStartDate: string,
    @Query('compareEndDate') compareEndDate: string,
  ): Promise<any> {
    const currentRange = this.buildDateRange(startDate, endDate);
    const compareRange = this.buildDateRange(compareStartDate, compareEndDate);

    if (!currentRange || !compareRange) {
      throw new ForbiddenException(
        'All date parameters are required for comparison',
      );
    }

    const [currentMetrics, compareMetrics] = await Promise.all([
      this.analyticsService.getRecruitmentMetrics(currentRange),
      this.analyticsService.getRecruitmentMetrics(compareRange),
    ]);

    return {
      current: {
        period: { startDate, endDate },
        metrics: currentMetrics,
      },
      previous: {
        period: { startDate: compareStartDate, endDate: compareEndDate },
        metrics: compareMetrics,
      },
      changes: {
        applications: this.calculateChange(
          currentMetrics.totalApplications,
          compareMetrics.totalApplications,
        ),
        hires: this.calculateChange(
          currentMetrics.totalHires,
          compareMetrics.totalHires,
        ),
        timeToHire: this.calculateChange(
          currentMetrics.averageTimeToHire,
          compareMetrics.averageTimeToHire,
        ),
        conversionRate: this.calculateChange(
          currentMetrics.conversionRates.overallConversion,
          compareMetrics.conversionRates.overallConversion,
        ),
      },
    };
  }

  /**
   * Export metrics in specified format
   */
  @Post('export')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async exportMetrics(
    @Body() exportDto: ExportMetricsDto,
    @Res() res: Response,
  ): Promise<void> {
    const filters: MetricFilters = {
      startDate: exportDto.startDate
        ? new Date(exportDto.startDate)
        : undefined,
      endDate: exportDto.endDate ? new Date(exportDto.endDate) : undefined,
      jobId: exportDto.jobId,
      teamId: exportDto.teamId,
    };

    const buffer = await this.analyticsService.exportMetrics(
      exportDto.format,
      filters,
    );

    const contentTypes: Record<ExportFormat, string> = {
      [ExportFormat.CSV]: 'text/csv',
      [ExportFormat.EXCEL]:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      [ExportFormat.PDF]: 'application/pdf',
    };

    const extensions: Record<ExportFormat, string> = {
      [ExportFormat.CSV]: 'csv',
      [ExportFormat.EXCEL]: 'xlsx',
      [ExportFormat.PDF]: 'pdf',
    };

    const filename = `recruitment-metrics-${new Date().toISOString().split('T')[0]}.${extensions[exportDto.format]}`;

    res.setHeader('Content-Type', contentTypes[exportDto.format]);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  /**
   * Get metrics for all jobs (paginated)
   */
  @Get('jobs')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async getAllJobsAnalytics(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Req() req?: any,
  ): Promise<any> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const skip = (pageNum - 1) * limitNum;

    // Get jobs based on user role
    const whereClause =
      req.user.role === Role.ADMIN ? {} : { userId: req.user.id };

    const [jobs, total] = await Promise.all([
      this.prisma.jobPosting.findMany({
        where: whereClause,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true },
      }),
      this.prisma.jobPosting.count({ where: whereClause }),
    ]);

    const jobAnalytics = await Promise.all(
      jobs.map((job) => this.analyticsService.getJobPerformance(job.id)),
    );

    return {
      data: jobAnalytics,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  // Private helper methods

  private buildDateRange(
    startDate?: string,
    endDate?: string,
  ): DateRange | undefined {
    if (!startDate || !endDate) {
      return undefined;
    }

    return {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };
  }

  private buildMetricFilters(
    filters: MetricFiltersDto,
    user: any,
  ): MetricFilters {
    return {
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
      jobId: filters.jobId,
      teamId: filters.teamId,
      sources: filters.sources,
      statuses: filters.statuses,
    };
  }

  private calculateChange(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Math.round(((current - previous) / previous) * 100 * 10) / 10;
  }

  private async verifyJobAccess(
    jobId: string,
    userId: string,
    userRole: Role,
  ): Promise<void> {
    if (userRole === Role.ADMIN) {
      return;
    }

    const job = await this.prisma.jobPosting.findUnique({
      where: { id: jobId },
      include: {
        team: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.userId === userId) {
      return;
    }

    if (job.team) {
      const isMember = job.team.members.some((m) => m.userId === userId);
      if (isMember) {
        return;
      }
    }

    throw new ForbiddenException('You do not have access to this job');
  }

  private async verifyTeamAccess(
    teamId: string,
    userId: string,
    userRole: Role,
  ): Promise<void> {
    if (userRole === Role.ADMIN) {
      return;
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: true,
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const isMember = team.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('You do not have access to this team');
    }
  }
}
