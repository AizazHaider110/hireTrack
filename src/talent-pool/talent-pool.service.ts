import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import {
  AddToTalentPoolDto,
  UpdateTalentPoolEntryDto,
  TalentPoolSearchDto,
  RecordEngagementDto,
  BulkImportCandidateDto,
  SuggestCandidatesDto,
  TalentPoolEntry,
  CandidateMatch,
  TalentPoolSearchResult,
} from '../common/dto/talent-pool.dto';
import { TalentStatus, AvailabilityStatus, Role } from '@prisma/client';

@Injectable()
export class TalentPoolService {
  private readonly logger = new Logger(TalentPoolService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  /**
   * Add a candidate to the talent pool
   */
  async addCandidateToPool(
    userId: string,
    dto: AddToTalentPoolDto,
  ): Promise<TalentPoolEntry> {
    // Check if candidate exists
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: dto.candidateId },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
        talentPoolEntry: true,
      },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    // Check if already in talent pool
    if (candidate.talentPoolEntry) {
      throw new ConflictException('Candidate is already in the talent pool');
    }

    const entry = await this.prisma.talentPoolEntry.create({
      data: {
        candidateId: dto.candidateId,
        tags: dto.tags || [],
        status: dto.status,
        availability: dto.availability,
        notes: dto.notes,
        addedBy: userId,
      },
      include: {
        candidate: {
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true },
            },
          },
        },
      },
    });

    this.eventBus.publish('talent_pool.candidate_added', {
      entryId: entry.id,
      candidateId: dto.candidateId,
      addedBy: userId,
      tags: dto.tags,
      status: dto.status,
    });

    this.logger.log(
      `Candidate ${dto.candidateId} added to talent pool by ${userId}`,
    );

    return entry as TalentPoolEntry;
  }

  /**
   * Get a talent pool entry by ID
   */
  async getEntry(entryId: string): Promise<TalentPoolEntry> {
    const entry = await this.prisma.talentPoolEntry.findUnique({
      where: { id: entryId },
      include: {
        candidate: {
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true },
            },
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException('Talent pool entry not found');
    }

    return entry as TalentPoolEntry;
  }

  /**
   * Get a talent pool entry by candidate ID
   */
  async getEntryByCandidateId(candidateId: string): Promise<TalentPoolEntry> {
    const entry = await this.prisma.talentPoolEntry.findUnique({
      where: { candidateId },
      include: {
        candidate: {
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true },
            },
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException('Candidate not found in talent pool');
    }

    return entry as TalentPoolEntry;
  }

  /**
   * Update a talent pool entry
   */
  async updateEntry(
    entryId: string,
    userId: string,
    dto: UpdateTalentPoolEntryDto,
  ): Promise<TalentPoolEntry> {
    const existing = await this.prisma.talentPoolEntry.findUnique({
      where: { id: entryId },
    });

    if (!existing) {
      throw new NotFoundException('Talent pool entry not found');
    }

    const entry = await this.prisma.talentPoolEntry.update({
      where: { id: entryId },
      data: {
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.availability !== undefined && {
          availability: dto.availability,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: {
        candidate: {
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true },
            },
          },
        },
      },
    });

    this.eventBus.publish('talent_pool.entry_updated', {
      entryId: entry.id,
      candidateId: entry.candidateId,
      updatedBy: userId,
      changes: dto,
    });

    return entry as TalentPoolEntry;
  }

  /**
   * Update candidate status in talent pool
   */
  async updateCandidateStatus(
    entryId: string,
    status: TalentStatus,
    userId: string,
  ): Promise<TalentPoolEntry> {
    return this.updateEntry(entryId, userId, { status });
  }

  /**
   * Remove a candidate from the talent pool
   */
  async removeFromPool(entryId: string, userId: string): Promise<void> {
    const entry = await this.prisma.talentPoolEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      throw new NotFoundException('Talent pool entry not found');
    }

    await this.prisma.talentPoolEntry.delete({
      where: { id: entryId },
    });

    this.eventBus.publish('talent_pool.candidate_removed', {
      entryId,
      candidateId: entry.candidateId,
      removedBy: userId,
    });

    this.logger.log(
      `Candidate ${entry.candidateId} removed from talent pool by ${userId}`,
    );
  }

  /**
   * Search talent pool with advanced filtering
   */
  async searchTalentPool(
    dto: TalentPoolSearchDto,
  ): Promise<TalentPoolSearchResult> {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // Status filter
    if (dto.status) {
      where.status = dto.status;
    }

    // Availability filter
    if (dto.availability) {
      where.availability = dto.availability;
    }

    // Tags filter (any match)
    if (dto.tags && dto.tags.length > 0) {
      where.tags = {
        hasSome: dto.tags,
      };
    }

    // Skills filter (search in candidate skills)
    if (dto.skills && dto.skills.length > 0) {
      where.candidate = {
        ...where.candidate,
        skills: {
          hasSome: dto.skills,
        },
      };
    }

    // Text search (name, email, notes)
    if (dto.query) {
      const searchTerm = dto.query.toLowerCase();
      where.OR = [
        { notes: { contains: searchTerm, mode: 'insensitive' } },
        {
          candidate: {
            user: {
              OR: [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { email: { contains: searchTerm, mode: 'insensitive' } },
              ],
            },
          },
        },
        {
          candidate: {
            skills: { hasSome: [dto.query] },
          },
        },
      ];
    }

    // Build orderBy
    const orderBy: any = {};
    const sortBy = dto.sortBy || 'addedAt';
    const sortOrder = dto.sortOrder || 'desc';

    if (sortBy === 'name') {
      orderBy.candidate = { user: { name: sortOrder } };
    } else if (sortBy === 'lastContactedAt') {
      orderBy.lastContactedAt = sortOrder;
    } else {
      orderBy[sortBy] = sortOrder;
    }

    // Execute query
    const [entries, total] = await Promise.all([
      this.prisma.talentPoolEntry.findMany({
        where,
        include: {
          candidate: {
            include: {
              user: {
                select: { id: true, name: true, email: true, phone: true },
              },
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.talentPoolEntry.count({ where }),
    ]);

    return {
      entries: entries as TalentPoolEntry[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get all entries in the talent pool
   */
  async getAllEntries(
    page: number = 1,
    limit: number = 20,
  ): Promise<TalentPoolSearchResult> {
    return this.searchTalentPool({ page, limit });
  }

  /**
   * Suggest candidates from talent pool for a job
   */
  async suggestCandidates(
    dto: SuggestCandidatesDto,
  ): Promise<CandidateMatch[]> {
    const limit = dto.limit || 10;
    const minMatchScore = dto.minMatchScore || 0;

    // Get job requirements
    const job = await this.prisma.jobPosting.findUnique({
      where: { id: dto.jobId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // Get all active talent pool entries
    const entries = await this.prisma.talentPoolEntry.findMany({
      where: {
        status: { not: TalentStatus.NOT_INTERESTED },
      },
      include: {
        candidate: {
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true },
            },
            applications: {
              where: { jobId: dto.jobId },
              select: { id: true },
            },
          },
        },
      },
    });

    // Filter out candidates who already applied to this job
    const eligibleEntries = entries.filter(
      (entry) => entry.candidate.applications.length === 0,
    );

    // Calculate match scores
    const matches: CandidateMatch[] = eligibleEntries.map((entry) => {
      const matchDetails = this.calculateMatchScore(entry, job.requirements);
      return {
        entry: entry as unknown as TalentPoolEntry,
        matchScore: matchDetails.total,
        matchDetails: {
          skillsMatch: matchDetails.skillsMatch,
          experienceMatch: matchDetails.experienceMatch,
          availabilityBonus: matchDetails.availabilityBonus,
        },
      };
    });

    // Filter by minimum score and sort by match score
    const filteredMatches = matches
      .filter((m) => m.matchScore >= minMatchScore)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);

    return filteredMatches;
  }

  /**
   * Calculate match score between a talent pool entry and job requirements
   */
  private calculateMatchScore(
    entry: any,
    requirements: string[],
  ): {
    total: number;
    skillsMatch: number;
    experienceMatch: number;
    availabilityBonus: number;
  } {
    const candidateSkills = entry.candidate.skills || [];
    const normalizedRequirements = requirements.map((r) => r.toLowerCase());
    const normalizedSkills = candidateSkills.map((s: string) =>
      s.toLowerCase(),
    );

    // Skills match (0-60 points)
    let matchingSkills = 0;
    for (const req of normalizedRequirements) {
      if (
        normalizedSkills.some(
          (skill: string) => skill.includes(req) || req.includes(skill),
        )
      ) {
        matchingSkills++;
      }
    }
    const skillsMatch =
      requirements.length > 0
        ? Math.round((matchingSkills / requirements.length) * 60)
        : 30;

    // Experience match (0-25 points) - simplified scoring
    let experienceMatch = 15; // Default middle score
    if (entry.candidate.experience) {
      const expText = entry.candidate.experience.toLowerCase();
      if (
        expText.includes('senior') ||
        expText.includes('10+') ||
        expText.includes('lead')
      ) {
        experienceMatch = 25;
      } else if (expText.includes('mid') || expText.includes('5+')) {
        experienceMatch = 20;
      } else if (expText.includes('junior') || expText.includes('entry')) {
        experienceMatch = 10;
      }
    }

    // Availability bonus (0-15 points)
    let availabilityBonus = 0;
    switch (entry.availability) {
      case AvailabilityStatus.IMMEDIATELY:
        availabilityBonus = 15;
        break;
      case AvailabilityStatus.TWO_WEEKS:
        availabilityBonus = 12;
        break;
      case AvailabilityStatus.ONE_MONTH:
        availabilityBonus = 8;
        break;
      case AvailabilityStatus.NOT_AVAILABLE:
        availabilityBonus = 0;
        break;
    }

    const total = skillsMatch + experienceMatch + availabilityBonus;

    return {
      total,
      skillsMatch,
      experienceMatch,
      availabilityBonus,
    };
  }

  /**
   * Record engagement activity for a talent pool entry
   */
  async recordEngagement(
    entryId: string,
    userId: string,
    dto: RecordEngagementDto,
  ): Promise<TalentPoolEntry> {
    const entry = await this.prisma.talentPoolEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      throw new NotFoundException('Talent pool entry not found');
    }

    // Update last contacted timestamp
    const updatedEntry = await this.prisma.talentPoolEntry.update({
      where: { id: entryId },
      data: {
        lastContactedAt: new Date(),
        notes: entry.notes
          ? `${entry.notes}\n\n[${new Date().toISOString()}] ${dto.type}: ${dto.description}${dto.outcome ? ` - Outcome: ${dto.outcome}` : ''}`
          : `[${new Date().toISOString()}] ${dto.type}: ${dto.description}${dto.outcome ? ` - Outcome: ${dto.outcome}` : ''}`,
      },
      include: {
        candidate: {
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true },
            },
          },
        },
      },
    });

    this.eventBus.publish('talent_pool.engagement_recorded', {
      entryId,
      candidateId: entry.candidateId,
      type: dto.type,
      recordedBy: userId,
    });

    this.logger.log(`Engagement recorded for entry ${entryId} by ${userId}`);

    return updatedEntry as TalentPoolEntry;
  }

  /**
   * Bulk import candidates to talent pool
   */
  async bulkImportCandidates(
    userId: string,
    candidates: BulkImportCandidateDto[],
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const candidateData of candidates) {
      try {
        // Check if user with email already exists
        let user = await this.prisma.user.findUnique({
          where: { email: candidateData.email },
        });

        let candidate;

        if (user) {
          // Check if candidate profile exists
          candidate = await this.prisma.candidate.findUnique({
            where: { userId: user.id },
            include: { talentPoolEntry: true },
          });

          if (candidate?.talentPoolEntry) {
            results.skipped++;
            results.errors.push(
              `${candidateData.email}: Already in talent pool`,
            );
            continue;
          }
        } else {
          // Create new user and candidate
          user = await this.prisma.user.create({
            data: {
              email: candidateData.email,
              name: candidateData.name,
              phone: candidateData.phone,
              password: '', // No password for imported candidates
              role: Role.CANDIDATE,
            },
          });
        }

        // Create or update candidate profile
        if (!candidate) {
          candidate = await this.prisma.candidate.upsert({
            where: { userId: user.id },
            create: {
              userId: user.id,
              skills: candidateData.skills || [],
              experience: candidateData.experience,
              education: candidateData.education,
            },
            update: {
              skills: candidateData.skills || [],
              experience: candidateData.experience,
              education: candidateData.education,
            },
          });
        }

        // Add to talent pool
        await this.prisma.talentPoolEntry.create({
          data: {
            candidateId: candidate.id,
            tags: candidateData.tags || [],
            status: candidateData.status || TalentStatus.PASSIVE,
            availability:
              candidateData.availability || AvailabilityStatus.NOT_AVAILABLE,
            notes: candidateData.notes
              ? `Source: ${candidateData.source || 'Bulk Import'}\n${candidateData.notes}`
              : `Source: ${candidateData.source || 'Bulk Import'}`,
            addedBy: userId,
          },
        });

        results.imported++;
      } catch (error) {
        results.errors.push(
          `${candidateData.email}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    this.eventBus.publish('talent_pool.bulk_import_completed', {
      importedBy: userId,
      imported: results.imported,
      skipped: results.skipped,
      errorCount: results.errors.length,
    });

    this.logger.log(
      `Bulk import completed: ${results.imported} imported, ${results.skipped} skipped`,
    );

    return results;
  }

  /**
   * Get talent pool statistics
   */
  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<TalentStatus, number>;
    byAvailability: Record<AvailabilityStatus, number>;
    recentlyAdded: number;
    recentlyContacted: number;
  }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      total,
      activeCount,
      passiveCount,
      notInterestedCount,
      immediatelyCount,
      twoWeeksCount,
      oneMonthCount,
      notAvailableCount,
      recentlyAdded,
      recentlyContacted,
    ] = await Promise.all([
      this.prisma.talentPoolEntry.count(),
      this.prisma.talentPoolEntry.count({
        where: { status: TalentStatus.ACTIVE },
      }),
      this.prisma.talentPoolEntry.count({
        where: { status: TalentStatus.PASSIVE },
      }),
      this.prisma.talentPoolEntry.count({
        where: { status: TalentStatus.NOT_INTERESTED },
      }),
      this.prisma.talentPoolEntry.count({
        where: { availability: AvailabilityStatus.IMMEDIATELY },
      }),
      this.prisma.talentPoolEntry.count({
        where: { availability: AvailabilityStatus.TWO_WEEKS },
      }),
      this.prisma.talentPoolEntry.count({
        where: { availability: AvailabilityStatus.ONE_MONTH },
      }),
      this.prisma.talentPoolEntry.count({
        where: { availability: AvailabilityStatus.NOT_AVAILABLE },
      }),
      this.prisma.talentPoolEntry.count({
        where: { addedAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.talentPoolEntry.count({
        where: { lastContactedAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    return {
      total,
      byStatus: {
        [TalentStatus.ACTIVE]: activeCount,
        [TalentStatus.PASSIVE]: passiveCount,
        [TalentStatus.NOT_INTERESTED]: notInterestedCount,
      },
      byAvailability: {
        [AvailabilityStatus.IMMEDIATELY]: immediatelyCount,
        [AvailabilityStatus.TWO_WEEKS]: twoWeeksCount,
        [AvailabilityStatus.ONE_MONTH]: oneMonthCount,
        [AvailabilityStatus.NOT_AVAILABLE]: notAvailableCount,
      },
      recentlyAdded,
      recentlyContacted,
    };
  }

  /**
   * Get all unique tags used in the talent pool
   */
  async getAllTags(): Promise<string[]> {
    const entries = await this.prisma.talentPoolEntry.findMany({
      select: { tags: true },
    });

    const tagSet = new Set<string>();
    for (const entry of entries) {
      for (const tag of entry.tags) {
        tagSet.add(tag);
      }
    }

    return Array.from(tagSet).sort();
  }

  /**
   * Add tags to a talent pool entry
   */
  async addTags(
    entryId: string,
    tags: string[],
    userId: string,
  ): Promise<TalentPoolEntry> {
    const entry = await this.prisma.talentPoolEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      throw new NotFoundException('Talent pool entry not found');
    }

    const existingTags = entry.tags || [];
    const newTags = [...new Set([...existingTags, ...tags])];

    return this.updateEntry(entryId, userId, { tags: newTags });
  }

  /**
   * Remove tags from a talent pool entry
   */
  async removeTags(
    entryId: string,
    tags: string[],
    userId: string,
  ): Promise<TalentPoolEntry> {
    const entry = await this.prisma.talentPoolEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      throw new NotFoundException('Talent pool entry not found');
    }

    const existingTags = entry.tags || [];
    const newTags = existingTags.filter((t) => !tags.includes(t));

    return this.updateEntry(entryId, userId, { tags: newTags });
  }

  /**
   * Archive inactive candidates (data retention)
   */
  async archiveInactiveCandidates(
    inactiveDays: number = 365,
  ): Promise<{ archived: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

    const result = await this.prisma.talentPoolEntry.updateMany({
      where: {
        status: { not: TalentStatus.NOT_INTERESTED },
        lastContactedAt: { lt: cutoffDate },
        updatedAt: { lt: cutoffDate },
      },
      data: {
        status: TalentStatus.NOT_INTERESTED,
        notes: 'Auto-archived due to inactivity',
      },
    });

    this.logger.log(`Archived ${result.count} inactive talent pool entries`);

    return { archived: result.count };
  }
}
