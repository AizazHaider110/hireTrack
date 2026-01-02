import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { SystemEventType } from '../events/event-types';
import { ResumeParsingService, ParsedResumeData } from '../resume/resume-parsing.service';

export interface ScoreBreakdown {
  skillsScore: number;
  skillsMatched: string[];
  skillsMissing: string[];
  experienceScore: number;
  experienceYears: number;
  requiredYears: number;
  educationScore: number;
  educationMatch: string;
  bonusPoints: number;
  bonusReasons: string[];
}

export interface CandidateScore {
  candidateId: string;
  jobId: string;
  overallScore: number;
  skillsScore: number;
  experienceScore: number;
  educationScore: number;
  breakdown: ScoreBreakdown;
  calculatedAt: Date;
}

export interface CandidateRanking {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  overallScore: number;
  skillsScore: number;
  experienceScore: number;
  educationScore: number;
  rank: number;
  applicationId: string;
  appliedAt: Date;
}

export interface JobRequirements {
  requiredSkills: string[];
  preferredSkills?: string[];
  minimumExperienceYears: number;
  preferredExperienceYears?: number;
  requiredEducation?: string;
  preferredEducation?: string;
  keywords?: string[];
}

// Scoring weights configuration
const SCORING_WEIGHTS = {
  skills: 0.45,        // 45% weight for skills match
  experience: 0.35,    // 35% weight for experience
  education: 0.15,     // 15% weight for education
  bonus: 0.05,         // 5% for bonus points (certifications, keywords, etc.)
};

// Education level hierarchy for scoring
const EDUCATION_LEVELS: Record<string, number> = {
  'high school': 1,
  'associate': 2,
  'bachelor': 3,
  'master': 4,
  'phd': 5,
  'doctorate': 5,
};

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly resumeParsingService: ResumeParsingService,
  ) {
    // Subscribe to events that should trigger score recalculation
    this.subscribeToEvents();
  }

  /**
   * Subscribe to events that trigger score recalculation
   */
  private subscribeToEvents(): void {
    // Recalculate scores when job requirements change
    this.eventBus.subscribe(SystemEventType.JOB_UPDATED, async (event) => {
      const { jobId } = event.payload;
      this.logger.log(`Job updated, recalculating scores for job: ${jobId}`);
      await this.recalculateScoresForJob(jobId);
    });

    // Calculate score when new application is received
    this.eventBus.subscribe(SystemEventType.CANDIDATE_APPLIED, async (event) => {
      const { candidateId, jobId } = event.payload;
      this.logger.log(`New application, calculating score for candidate: ${candidateId}`);
      await this.calculateCandidateScore(candidateId, jobId);
    });
  }

  /**
   * Calculate score for a candidate-job pair
   */
  async calculateCandidateScore(candidateId: string, jobId: string): Promise<CandidateScore> {
    this.logger.log(`Calculating score for candidate ${candidateId} and job ${jobId}`);

    // Get candidate data
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        resumeParse: true,
        user: true,
      },
    });

    if (!candidate) {
      throw new NotFoundException(`Candidate not found: ${candidateId}`);
    }

    // Get job data
    const job = await this.prisma.jobPosting.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Job not found: ${jobId}`);
    }

    // Extract job requirements
    const requirements = this.extractJobRequirements(job);

    // Get parsed resume data
    let parsedResume: ParsedResumeData | null = null;
    if (candidate.resumeUrl) {
      try {
        parsedResume = await this.resumeParsingService.parseResume(candidate.resumeUrl);
      } catch (error) {
        this.logger.warn(`Failed to parse resume for candidate ${candidateId}`, error);
      }
    }

    // Calculate individual scores
    const skillsResult = this.calculateSkillsScore(
      candidate.skills || [],
      requirements.requiredSkills,
      requirements.preferredSkills || [],
    );

    const experienceResult = this.calculateExperienceScore(
      parsedResume?.totalYearsExperience || this.estimateExperience(candidate.experience),
      requirements.minimumExperienceYears,
      requirements.preferredExperienceYears,
    );

    const educationResult = this.calculateEducationScore(
      candidate.education || '',
      parsedResume?.education || [],
      requirements.requiredEducation,
      requirements.preferredEducation,
    );

    const bonusResult = this.calculateBonusPoints(
      parsedResume,
      requirements.keywords || [],
    );

    // Calculate weighted overall score
    const overallScore = Math.round(
      skillsResult.score * SCORING_WEIGHTS.skills +
      experienceResult.score * SCORING_WEIGHTS.experience +
      educationResult.score * SCORING_WEIGHTS.education +
      bonusResult.score * SCORING_WEIGHTS.bonus
    );

    const breakdown: ScoreBreakdown = {
      skillsScore: skillsResult.score,
      skillsMatched: skillsResult.matched,
      skillsMissing: skillsResult.missing,
      experienceScore: experienceResult.score,
      experienceYears: experienceResult.years,
      requiredYears: requirements.minimumExperienceYears,
      educationScore: educationResult.score,
      educationMatch: educationResult.match,
      bonusPoints: bonusResult.score,
      bonusReasons: bonusResult.reasons,
    };

    // Store score in database
    const storedScore = await this.prisma.candidateScore.upsert({
      where: {
        candidateId_jobId: {
          candidateId,
          jobId,
        },
      },
      update: {
        overallScore,
        skillsScore: skillsResult.score,
        experienceScore: experienceResult.score,
        educationScore: educationResult.score,
        breakdown: breakdown as any,
        calculatedAt: new Date(),
      },
      create: {
        candidateId,
        jobId,
        overallScore,
        skillsScore: skillsResult.score,
        experienceScore: experienceResult.score,
        educationScore: educationResult.score,
        breakdown: breakdown as any,
      },
    });

    // Publish score calculated event
    this.eventBus.publish(SystemEventType.SCORE_CALCULATED, {
      candidateId,
      jobId,
      overallScore,
    });

    this.logger.log(`Score calculated for candidate ${candidateId}: ${overallScore}`);

    return {
      candidateId,
      jobId,
      overallScore,
      skillsScore: skillsResult.score,
      experienceScore: experienceResult.score,
      educationScore: educationResult.score,
      breakdown,
      calculatedAt: storedScore.calculatedAt,
    };
  }

  /**
   * Get score breakdown for a candidate-job pair
   */
  async getScoreBreakdown(candidateId: string, jobId: string): Promise<CandidateScore | null> {
    const score = await this.prisma.candidateScore.findUnique({
      where: {
        candidateId_jobId: {
          candidateId,
          jobId,
        },
      },
    });

    if (!score) {
      return null;
    }

    return {
      candidateId: score.candidateId,
      jobId: score.jobId,
      overallScore: score.overallScore,
      skillsScore: score.skillsScore,
      experienceScore: score.experienceScore,
      educationScore: score.educationScore,
      breakdown: score.breakdown as unknown as ScoreBreakdown,
      calculatedAt: score.calculatedAt,
    };
  }

  /**
   * Rank all candidates for a job by score
   */
  async rankCandidates(jobId: string): Promise<CandidateRanking[]> {
    this.logger.log(`Ranking candidates for job: ${jobId}`);

    // Get all applications for the job with scores
    const applications = await this.prisma.application.findMany({
      where: { jobId },
      include: {
        candidate: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
            scores: {
              where: { jobId },
            },
          },
        },
      },
      orderBy: {
        appliedAt: 'desc',
      },
    });

    // Calculate scores for candidates without scores
    for (const app of applications) {
      if (app.candidate.scores.length === 0) {
        await this.calculateCandidateScore(app.candidateId, jobId);
      }
    }

    // Re-fetch with updated scores
    const updatedApplications = await this.prisma.application.findMany({
      where: { jobId },
      include: {
        candidate: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
            scores: {
              where: { jobId },
            },
          },
        },
      },
    });

    // Sort by score and create rankings
    const rankings: CandidateRanking[] = updatedApplications
      .map((app) => {
        const score = app.candidate.scores[0];
        return {
          candidateId: app.candidateId,
          candidateName: app.candidate.user.name,
          candidateEmail: app.candidate.user.email,
          overallScore: score?.overallScore || 0,
          skillsScore: score?.skillsScore || 0,
          experienceScore: score?.experienceScore || 0,
          educationScore: score?.educationScore || 0,
          rank: 0, // Will be set after sorting
          applicationId: app.id,
          appliedAt: app.appliedAt,
        };
      })
      .sort((a, b) => b.overallScore - a.overallScore)
      .map((ranking, index) => ({
        ...ranking,
        rank: index + 1,
      }));

    this.logger.log(`Ranked ${rankings.length} candidates for job ${jobId}`);

    return rankings;
  }


  /**
   * Recalculate scores for all candidates of a job
   */
  async recalculateScoresForJob(jobId: string): Promise<void> {
    this.logger.log(`Recalculating scores for all candidates of job: ${jobId}`);

    const applications = await this.prisma.application.findMany({
      where: { jobId },
      select: { candidateId: true },
    });

    for (const app of applications) {
      try {
        await this.calculateCandidateScore(app.candidateId, jobId);
      } catch (error) {
        this.logger.error(`Failed to recalculate score for candidate ${app.candidateId}`, error);
      }
    }

    this.logger.log(`Recalculated scores for ${applications.length} candidates`);
  }

  /**
   * Update job requirements and trigger score recalculation
   */
  async updateJobRequirements(jobId: string, requirements: Partial<JobRequirements>): Promise<void> {
    const job = await this.prisma.jobPosting.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Job not found: ${jobId}`);
    }

    // Update job with new requirements
    await this.prisma.jobPosting.update({
      where: { id: jobId },
      data: {
        requirements: requirements.requiredSkills || job.requirements,
        // Additional fields could be stored in a JSON column or separate table
      },
    });

    // Trigger score recalculation
    await this.recalculateScoresForJob(jobId);
  }

  /**
   * Calculate skills match score
   */
  private calculateSkillsScore(
    candidateSkills: string[],
    requiredSkills: string[],
    preferredSkills: string[],
  ): { score: number; matched: string[]; missing: string[] } {
    const normalizedCandidateSkills = candidateSkills.map(s => s.toLowerCase().trim());
    const normalizedRequired = requiredSkills.map(s => s.toLowerCase().trim());
    const normalizedPreferred = preferredSkills.map(s => s.toLowerCase().trim());

    // Find matched and missing required skills
    const matchedRequired: string[] = [];
    const missingRequired: string[] = [];

    for (const skill of normalizedRequired) {
      if (this.skillMatches(skill, normalizedCandidateSkills)) {
        matchedRequired.push(skill);
      } else {
        missingRequired.push(skill);
      }
    }

    // Find matched preferred skills
    const matchedPreferred: string[] = [];
    for (const skill of normalizedPreferred) {
      if (this.skillMatches(skill, normalizedCandidateSkills)) {
        matchedPreferred.push(skill);
      }
    }

    // Calculate score
    // Required skills: 80% of skills score
    // Preferred skills: 20% of skills score
    let score = 0;

    if (normalizedRequired.length > 0) {
      const requiredScore = (matchedRequired.length / normalizedRequired.length) * 80;
      score += requiredScore;
    } else {
      score += 80; // Full score if no required skills specified
    }

    if (normalizedPreferred.length > 0) {
      const preferredScore = (matchedPreferred.length / normalizedPreferred.length) * 20;
      score += preferredScore;
    } else {
      score += 20; // Full score if no preferred skills specified
    }

    return {
      score: Math.round(score),
      matched: [...matchedRequired, ...matchedPreferred],
      missing: missingRequired,
    };
  }

  /**
   * Check if a skill matches any candidate skill (with fuzzy matching)
   */
  private skillMatches(skill: string, candidateSkills: string[]): boolean {
    // Direct match
    if (candidateSkills.includes(skill)) {
      return true;
    }

    // Fuzzy matching for common variations
    const skillVariations: Record<string, string[]> = {
      'javascript': ['js', 'ecmascript'],
      'typescript': ['ts'],
      'python': ['py'],
      'postgresql': ['postgres', 'psql'],
      'mongodb': ['mongo'],
      'kubernetes': ['k8s'],
      'react': ['reactjs', 'react.js'],
      'node': ['nodejs', 'node.js'],
      'vue': ['vuejs', 'vue.js'],
      'angular': ['angularjs'],
      'aws': ['amazon web services'],
      'gcp': ['google cloud', 'google cloud platform'],
      'azure': ['microsoft azure'],
    };

    // Check variations
    const variations = skillVariations[skill] || [];
    for (const variation of variations) {
      if (candidateSkills.includes(variation)) {
        return true;
      }
    }

    // Check if skill is contained in any candidate skill
    for (const candidateSkill of candidateSkills) {
      if (candidateSkill.includes(skill) || skill.includes(candidateSkill)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate experience score
   */
  private calculateExperienceScore(
    candidateYears: number,
    minimumYears: number,
    preferredYears?: number,
  ): { score: number; years: number } {
    if (minimumYears === 0) {
      return { score: 100, years: candidateYears };
    }

    // If candidate meets or exceeds preferred years, full score
    if (preferredYears && candidateYears >= preferredYears) {
      return { score: 100, years: candidateYears };
    }

    // If candidate meets minimum years
    if (candidateYears >= minimumYears) {
      // Score between 70-100 based on how close to preferred
      const baseScore = 70;
      if (preferredYears && preferredYears > minimumYears) {
        const additionalScore = ((candidateYears - minimumYears) / (preferredYears - minimumYears)) * 30;
        return { score: Math.round(baseScore + additionalScore), years: candidateYears };
      }
      return { score: 85, years: candidateYears };
    }

    // Below minimum - score proportionally
    const score = Math.round((candidateYears / minimumYears) * 70);
    return { score: Math.max(0, score), years: candidateYears };
  }

  /**
   * Calculate education score
   */
  private calculateEducationScore(
    candidateEducation: string,
    parsedEducation: { degree: string; institution: string; field?: string }[],
    requiredEducation?: string,
    preferredEducation?: string,
  ): { score: number; match: string } {
    // Get highest education level from candidate
    const candidateLevel = this.getHighestEducationLevel(candidateEducation, parsedEducation);
    
    // If no education requirement, give full score
    if (!requiredEducation && !preferredEducation) {
      return { score: 100, match: candidateLevel.degree || 'Not specified' };
    }

    const requiredLevel = requiredEducation ? this.parseEducationLevel(requiredEducation) : 0;
    const preferredLevel = preferredEducation ? this.parseEducationLevel(preferredEducation) : requiredLevel;

    // If candidate meets or exceeds preferred level
    if (candidateLevel.level >= preferredLevel) {
      return { score: 100, match: candidateLevel.degree || 'Exceeds requirements' };
    }

    // If candidate meets required level
    if (candidateLevel.level >= requiredLevel) {
      const score = 70 + ((candidateLevel.level - requiredLevel) / (preferredLevel - requiredLevel)) * 30;
      return { score: Math.round(score), match: candidateLevel.degree || 'Meets requirements' };
    }

    // Below required level
    if (requiredLevel > 0) {
      const score = (candidateLevel.level / requiredLevel) * 70;
      return { score: Math.round(score), match: candidateLevel.degree || 'Below requirements' };
    }

    return { score: 50, match: candidateLevel.degree || 'Unknown' };
  }

  /**
   * Get highest education level from candidate data
   */
  private getHighestEducationLevel(
    educationString: string,
    parsedEducation: { degree: string; institution: string; field?: string }[],
  ): { level: number; degree: string } {
    let highestLevel = 0;
    let highestDegree = '';

    // Check parsed education entries
    for (const edu of parsedEducation) {
      const level = this.parseEducationLevel(edu.degree);
      if (level > highestLevel) {
        highestLevel = level;
        highestDegree = edu.degree;
      }
    }

    // Also check education string
    const stringLevel = this.parseEducationLevel(educationString);
    if (stringLevel > highestLevel) {
      highestLevel = stringLevel;
      highestDegree = educationString;
    }

    return { level: highestLevel, degree: highestDegree };
  }

  /**
   * Parse education level from string
   */
  private parseEducationLevel(education: string): number {
    const lowerEdu = education.toLowerCase();

    if (lowerEdu.includes('phd') || lowerEdu.includes('doctorate') || lowerEdu.includes('ph.d')) {
      return EDUCATION_LEVELS['phd'];
    }
    if (lowerEdu.includes('master') || lowerEdu.includes('m.s') || lowerEdu.includes('m.a') || lowerEdu.includes('mba')) {
      return EDUCATION_LEVELS['master'];
    }
    if (lowerEdu.includes('bachelor') || lowerEdu.includes('b.s') || lowerEdu.includes('b.a')) {
      return EDUCATION_LEVELS['bachelor'];
    }
    if (lowerEdu.includes('associate')) {
      return EDUCATION_LEVELS['associate'];
    }
    if (lowerEdu.includes('high school') || lowerEdu.includes('diploma')) {
      return EDUCATION_LEVELS['high school'];
    }

    return 0;
  }

  /**
   * Calculate bonus points for additional qualifications
   */
  private calculateBonusPoints(
    parsedResume: ParsedResumeData | null,
    keywords: string[],
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    if (!parsedResume) {
      return { score: 0, reasons: [] };
    }

    // Bonus for certifications
    if (parsedResume.certifications && parsedResume.certifications.length > 0) {
      const certBonus = Math.min(parsedResume.certifications.length * 10, 30);
      score += certBonus;
      reasons.push(`${parsedResume.certifications.length} certification(s)`);
    }

    // Bonus for keyword matches
    if (keywords.length > 0 && parsedResume.rawText) {
      const lowerText = parsedResume.rawText.toLowerCase();
      const matchedKeywords = keywords.filter(k => lowerText.includes(k.toLowerCase()));
      if (matchedKeywords.length > 0) {
        const keywordBonus = Math.min((matchedKeywords.length / keywords.length) * 30, 30);
        score += keywordBonus;
        reasons.push(`${matchedKeywords.length} keyword match(es)`);
      }
    }

    // Bonus for multiple languages
    if (parsedResume.languages && parsedResume.languages.length > 1) {
      score += 10;
      reasons.push('Multilingual');
    }

    // Bonus for extensive experience
    if (parsedResume.totalYearsExperience && parsedResume.totalYearsExperience >= 10) {
      score += 20;
      reasons.push('Senior-level experience');
    }

    // Cap at 100
    return { score: Math.min(score, 100), reasons };
  }

  /**
   * Extract job requirements from job posting
   */
  private extractJobRequirements(job: { requirements: string[]; description: string }): JobRequirements {
    // Parse requirements from job posting
    const requiredSkills = job.requirements || [];
    
    // Extract additional requirements from description
    const description = job.description.toLowerCase();
    
    // Try to extract experience requirement
    let minimumExperienceYears = 0;
    const expMatch = description.match(/(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)/i);
    if (expMatch) {
      minimumExperienceYears = parseInt(expMatch[1], 10);
    }

    // Try to extract education requirement
    let requiredEducation: string | undefined;
    if (description.includes('phd') || description.includes('doctorate')) {
      requiredEducation = 'PhD';
    } else if (description.includes('master')) {
      requiredEducation = 'Master';
    } else if (description.includes('bachelor') || description.includes('degree')) {
      requiredEducation = 'Bachelor';
    }

    // Extract keywords from description
    const keywords = this.extractKeywords(job.description);

    return {
      requiredSkills,
      preferredSkills: [],
      minimumExperienceYears,
      requiredEducation,
      keywords,
    };
  }

  /**
   * Extract keywords from job description
   */
  private extractKeywords(description: string): string[] {
    const keywords: string[] = [];
    
    // Common important keywords
    const importantTerms = [
      'leadership', 'management', 'agile', 'scrum', 'remote', 'hybrid',
      'startup', 'enterprise', 'scale', 'growth', 'innovation',
      'collaboration', 'communication', 'problem-solving',
    ];

    const lowerDesc = description.toLowerCase();
    for (const term of importantTerms) {
      if (lowerDesc.includes(term)) {
        keywords.push(term);
      }
    }

    return keywords;
  }

  /**
   * Estimate years of experience from experience string
   */
  private estimateExperience(experience: string | null): number {
    if (!experience) return 0;

    // Try to extract years from experience string
    const yearsMatch = experience.match(/(\d+)\s*(?:years?|yrs?)/i);
    if (yearsMatch) {
      return parseInt(yearsMatch[1], 10);
    }

    // Count job entries as rough estimate
    const jobCount = (experience.match(/at\s+/gi) || []).length;
    return jobCount * 2; // Assume ~2 years per job
  }
}
