import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Req,
  Query,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ScoringService, JobRequirements, CandidateScore, CandidateRanking } from './scoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export class UpdateJobRequirementsDto {
  requiredSkills?: string[];
  preferredSkills?: string[];
  minimumExperienceYears?: number;
  preferredExperienceYears?: number;
  requiredEducation?: string;
  preferredEducation?: string;
  keywords?: string[];
}

@Controller('scoring')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScoringController {
  constructor(
    private readonly scoringService: ScoringService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Calculate score for a specific candidate-job pair
   */
  @Post('calculate/:candidateId/:jobId')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async calculateScore(
    @Param('candidateId') candidateId: string,
    @Param('jobId') jobId: string,
    @Req() req: any,
  ): Promise<CandidateScore> {
    // Verify user has access to this job
    await this.verifyJobAccess(jobId, req.user.id, req.user.role);
    
    return this.scoringService.calculateCandidateScore(candidateId, jobId);
  }

  /**
   * Get score breakdown for a candidate-job pair
   */
  @Get('breakdown/:candidateId/:jobId')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER, Role.INTERVIEWER)
  async getScoreBreakdown(
    @Param('candidateId') candidateId: string,
    @Param('jobId') jobId: string,
    @Req() req: any,
  ): Promise<CandidateScore> {
    // Verify user has access to this job
    await this.verifyJobAccess(jobId, req.user.id, req.user.role);

    const score = await this.scoringService.getScoreBreakdown(candidateId, jobId);
    
    if (!score) {
      // Calculate score if not exists
      return this.scoringService.calculateCandidateScore(candidateId, jobId);
    }

    return score;
  }

  /**
   * Get ranked candidates for a job
   */
  @Get('rankings/:jobId')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async getRankings(
    @Param('jobId') jobId: string,
    @Req() req: any,
    @Query('limit') limit?: string,
  ): Promise<CandidateRanking[]> {
    // Verify user has access to this job
    await this.verifyJobAccess(jobId, req.user.id, req.user.role);

    const rankings = await this.scoringService.rankCandidates(jobId);
    
    // Apply limit if specified
    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        return rankings.slice(0, limitNum);
      }
    }

    return rankings;
  }

  /**
   * Recalculate scores for all candidates of a job
   */
  @Post('recalculate/:jobId')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async recalculateScores(
    @Param('jobId') jobId: string,
    @Req() req: any,
  ): Promise<{ message: string }> {
    // Verify user has access to this job
    await this.verifyJobAccess(jobId, req.user.id, req.user.role);

    await this.scoringService.recalculateScoresForJob(jobId);

    return { message: 'Scores recalculated successfully' };
  }

  /**
   * Update job requirements and trigger score recalculation
   */
  @Put('requirements/:jobId')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async updateJobRequirements(
    @Param('jobId') jobId: string,
    @Body() requirements: UpdateJobRequirementsDto,
    @Req() req: any,
  ): Promise<{ message: string }> {
    // Verify user has access to this job
    await this.verifyJobAccess(jobId, req.user.id, req.user.role);

    await this.scoringService.updateJobRequirements(jobId, requirements);

    return { message: 'Requirements updated and scores recalculated' };
  }

  /**
   * Get top candidates across all jobs (admin only)
   */
  @Get('top-candidates')
  @Roles(Role.ADMIN)
  async getTopCandidates(
    @Query('limit') limit?: string,
  ): Promise<any[]> {
    const limitNum = limit ? parseInt(limit, 10) : 10;

    const topScores = await this.prisma.candidateScore.findMany({
      orderBy: { overallScore: 'desc' },
      take: limitNum,
      include: {
        candidate: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return topScores.map((score) => ({
      candidateId: score.candidateId,
      candidateName: score.candidate.user.name,
      candidateEmail: score.candidate.user.email,
      jobId: score.jobId,
      overallScore: score.overallScore,
      skillsScore: score.skillsScore,
      experienceScore: score.experienceScore,
      educationScore: score.educationScore,
      calculatedAt: score.calculatedAt,
    }));
  }

  /**
   * Get candidate's scores across all jobs they applied to
   */
  @Get('candidate/:candidateId')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER, Role.CANDIDATE)
  async getCandidateScores(
    @Param('candidateId') candidateId: string,
    @Req() req: any,
  ): Promise<CandidateScore[]> {
    // Candidates can only view their own scores
    if (req.user.role === Role.CANDIDATE) {
      const candidate = await this.prisma.candidate.findUnique({
        where: { userId: req.user.id },
      });
      
      if (!candidate || candidate.id !== candidateId) {
        throw new ForbiddenException('You can only view your own scores');
      }
    }

    const scores = await this.prisma.candidateScore.findMany({
      where: { candidateId },
      include: {
        candidate: true,
      },
    });

    return scores.map((score) => ({
      candidateId: score.candidateId,
      jobId: score.jobId,
      overallScore: score.overallScore,
      skillsScore: score.skillsScore,
      experienceScore: score.experienceScore,
      educationScore: score.educationScore,
      breakdown: score.breakdown as any,
      calculatedAt: score.calculatedAt,
    }));
  }

  /**
   * Verify user has access to a job
   */
  private async verifyJobAccess(jobId: string, userId: string, userRole: Role): Promise<void> {
    // Admins have access to all jobs
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

    // Job owner has access
    if (job.userId === userId) {
      return;
    }

    // Team members have access
    if (job.team) {
      const isMember = job.team.members.some((m) => m.userId === userId);
      if (isMember) {
        return;
      }
    }

    throw new ForbiddenException('You do not have access to this job');
  }
}
