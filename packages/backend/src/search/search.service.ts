import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import {
  SearchDto,
  AdvancedSearchDto,
  CreateSavedSearchDto,
  UpdateSavedSearchDto,
  SearchResults,
  SearchResultItem,
  SearchHighlight,
  SavedSearch,
  SearchEntityType,
  SearchSortField,
  SortOrder,
} from '../common/dto/search.dto';
import {
  SearchEntityType as PrismaSearchEntityType,
  AlertFrequency,
} from '@prisma/client';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  /**
   * Perform a full-text search across entities
   */
  async search(dto: SearchDto, userId: string): Promise<SearchResults> {
    const startTime = Date.now();
    const {
      query,
      entityType,
      page = 1,
      limit = 20,
      sortBy,
      sortOrder,
      highlightResults,
    } = dto;

    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Search query cannot be empty');
    }

    const skip = (page - 1) * limit;
    const searchTerms = this.parseSearchQuery(query);

    let items: SearchResultItem[] = [];
    let total = 0;

    switch (entityType) {
      case SearchEntityType.CANDIDATE:
        const candidateResults = await this.searchCandidates(
          searchTerms,
          skip,
          limit,
          sortBy,
          sortOrder,
        );
        items = candidateResults.items;
        total = candidateResults.total;
        break;
      case SearchEntityType.JOB:
        const jobResults = await this.searchJobs(
          searchTerms,
          skip,
          limit,
          sortBy,
          sortOrder,
        );
        items = jobResults.items;
        total = jobResults.total;
        break;
      case SearchEntityType.APPLICATION:
        const appResults = await this.searchApplications(
          searchTerms,
          skip,
          limit,
          sortBy,
          sortOrder,
        );
        items = appResults.items;
        total = appResults.total;
        break;
      case SearchEntityType.ALL:
      default:
        const allResults = await this.searchAll(
          searchTerms,
          skip,
          limit,
          sortBy,
          sortOrder,
        );
        items = allResults.items;
        total = allResults.total;
        break;
    }

    // Add highlights if requested
    if (highlightResults) {
      items = items.map((item) => ({
        ...item,
        highlights: this.generateHighlights(item, searchTerms),
      }));
    }

    // Sort by relevance score if requested
    if (sortBy === SearchSortField.RELEVANCE) {
      items.sort((a, b) =>
        sortOrder === SortOrder.DESC ? b.score - a.score : a.score - b.score,
      );
    }

    const executionTimeMs = Date.now() - startTime;

    this.eventBus.publish('search.executed', {
      query,
      entityType,
      resultCount: total,
      executionTimeMs,
      userId,
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      query,
      entityType: entityType || SearchEntityType.ALL,
      executionTimeMs,
    };
  }

  /**
   * Perform advanced search with filters
   */
  async advancedSearch(
    dto: AdvancedSearchDto,
    userId: string,
  ): Promise<SearchResults> {
    const startTime = Date.now();
    const {
      query,
      entityType,
      page = 1,
      limit = 20,
      sortBy,
      sortOrder,
      highlightResults,
    } = dto;

    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Search query cannot be empty');
    }

    const skip = (page - 1) * limit;
    const searchTerms = dto.useBooleanOperators
      ? this.parseBooleanQuery(query)
      : this.parseSearchQuery(query);

    let items: SearchResultItem[] = [];
    let total = 0;

    switch (entityType) {
      case SearchEntityType.CANDIDATE:
        const candidateResults = await this.searchCandidatesWithFilters(
          searchTerms,
          dto.candidateFilters,
          skip,
          limit,
          sortBy,
          sortOrder,
        );
        items = candidateResults.items;
        total = candidateResults.total;
        break;
      case SearchEntityType.JOB:
        const jobResults = await this.searchJobsWithFilters(
          searchTerms,
          dto.jobFilters,
          skip,
          limit,
          sortBy,
          sortOrder,
        );
        items = jobResults.items;
        total = jobResults.total;
        break;
      case SearchEntityType.APPLICATION:
        const appResults = await this.searchApplicationsWithFilters(
          searchTerms,
          dto.applicationFilters,
          skip,
          limit,
          sortBy,
          sortOrder,
        );
        items = appResults.items;
        total = appResults.total;
        break;
      default:
        const allResults = await this.searchAll(
          searchTerms,
          skip,
          limit,
          sortBy,
          sortOrder,
        );
        items = allResults.items;
        total = allResults.total;
        break;
    }

    if (highlightResults) {
      items = items.map((item) => ({
        ...item,
        highlights: this.generateHighlights(item, searchTerms),
      }));
    }

    if (sortBy === SearchSortField.RELEVANCE) {
      items.sort((a, b) =>
        sortOrder === SortOrder.DESC ? b.score - a.score : a.score - b.score,
      );
    }

    const executionTimeMs = Date.now() - startTime;

    this.eventBus.publish('search.advanced_executed', {
      query,
      entityType,
      filters: {
        candidateFilters: dto.candidateFilters,
        jobFilters: dto.jobFilters,
        applicationFilters: dto.applicationFilters,
      },
      resultCount: total,
      executionTimeMs,
      userId,
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      query,
      entityType: entityType || SearchEntityType.ALL,
      executionTimeMs,
    };
  }

  /**
   * Parse search query into terms
   */
  private parseSearchQuery(query: string): string[] {
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 0)
      .map((term) => term.trim());
  }

  /**
   * Parse boolean query (AND, OR, NOT operators)
   */
  private parseBooleanQuery(query: string): string[] {
    // Simple implementation - extract terms, ignoring operators for now
    return query
      .toLowerCase()
      .replace(/\b(and|or|not)\b/gi, ' ')
      .split(/\s+/)
      .filter((term) => term.length > 0)
      .map((term) => term.trim());
  }

  /**
   * Search candidates
   */
  private async searchCandidates(
    searchTerms: string[],
    skip: number,
    limit: number,
    sortBy?: SearchSortField,
    sortOrder?: SortOrder,
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const searchPattern = searchTerms.join(' | ');

    const where: any = {
      OR: [
        { user: { name: { contains: searchTerms[0], mode: 'insensitive' } } },
        { user: { email: { contains: searchTerms[0], mode: 'insensitive' } } },
        { skills: { hasSome: searchTerms } },
        { experience: { contains: searchTerms[0], mode: 'insensitive' } },
        { education: { contains: searchTerms[0], mode: 'insensitive' } },
      ],
    };

    const orderBy = this.buildCandidateOrderBy(sortBy, sortOrder);

    const [candidates, total] = await Promise.all([
      this.prisma.candidate.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          scores: { take: 1, orderBy: { calculatedAt: 'desc' } },
        },
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.candidate.count({ where }),
    ]);

    const items: SearchResultItem[] = candidates.map((candidate) => ({
      id: candidate.id,
      entityType: SearchEntityType.CANDIDATE,
      title: candidate.user.name,
      subtitle: candidate.user.email,
      description: candidate.skills?.join(', ') || '',
      score: this.calculateRelevanceScore(candidate, searchTerms),
      data: {
        userId: candidate.userId,
        skills: candidate.skills,
        experience: candidate.experience,
        education: candidate.education,
        phone: candidate.user.phone,
        latestScore: candidate.scores[0]?.overallScore,
      },
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    }));

    return { items, total };
  }

  /**
   * Search candidates with filters
   */
  private async searchCandidatesWithFilters(
    searchTerms: string[],
    filters: any,
    skip: number,
    limit: number,
    sortBy?: SearchSortField,
    sortOrder?: SortOrder,
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const where: any = {
      AND: [
        {
          OR: [
            {
              user: { name: { contains: searchTerms[0], mode: 'insensitive' } },
            },
            {
              user: {
                email: { contains: searchTerms[0], mode: 'insensitive' },
              },
            },
            { skills: { hasSome: searchTerms } },
            { experience: { contains: searchTerms[0], mode: 'insensitive' } },
          ],
        },
      ],
    };

    // Apply filters
    if (filters?.skills?.length > 0) {
      where.AND.push({ skills: { hasSome: filters.skills } });
    }
    if (filters?.talentStatus) {
      where.AND.push({ talentPoolEntry: { status: filters.talentStatus } });
    }
    if (filters?.availability) {
      where.AND.push({
        talentPoolEntry: { availability: filters.availability },
      });
    }
    if (filters?.minScore !== undefined || filters?.maxScore !== undefined) {
      where.AND.push({
        scores: {
          some: {
            overallScore: {
              ...(filters.minScore !== undefined && { gte: filters.minScore }),
              ...(filters.maxScore !== undefined && { lte: filters.maxScore }),
            },
          },
        },
      });
    }

    const orderBy = this.buildCandidateOrderBy(sortBy, sortOrder);

    const [candidates, total] = await Promise.all([
      this.prisma.candidate.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          scores: { take: 1, orderBy: { calculatedAt: 'desc' } },
          talentPoolEntry: true,
        },
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.candidate.count({ where }),
    ]);

    const items: SearchResultItem[] = candidates.map((candidate) => ({
      id: candidate.id,
      entityType: SearchEntityType.CANDIDATE,
      title: candidate.user.name,
      subtitle: candidate.user.email,
      description: candidate.skills?.join(', ') || '',
      score: this.calculateRelevanceScore(candidate, searchTerms),
      data: {
        userId: candidate.userId,
        skills: candidate.skills,
        experience: candidate.experience,
        education: candidate.education,
        phone: candidate.user.phone,
        latestScore: candidate.scores[0]?.overallScore,
        talentStatus: candidate.talentPoolEntry?.status,
        availability: candidate.talentPoolEntry?.availability,
      },
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    }));

    return { items, total };
  }

  private buildCandidateOrderBy(
    sortBy?: SearchSortField,
    sortOrder?: SortOrder,
  ): any {
    const order = sortOrder || SortOrder.DESC;
    switch (sortBy) {
      case SearchSortField.NAME:
        return { user: { name: order } };
      case SearchSortField.CREATED_AT:
        return { createdAt: order };
      case SearchSortField.UPDATED_AT:
        return { updatedAt: order };
      default:
        return { createdAt: order };
    }
  }

  /**
   * Search jobs
   */
  private async searchJobs(
    searchTerms: string[],
    skip: number,
    limit: number,
    sortBy?: SearchSortField,
    sortOrder?: SortOrder,
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const where: any = {
      OR: [
        { title: { contains: searchTerms[0], mode: 'insensitive' } },
        { description: { contains: searchTerms[0], mode: 'insensitive' } },
        { location: { contains: searchTerms[0], mode: 'insensitive' } },
        { requirements: { hasSome: searchTerms } },
      ],
    };

    const orderBy = this.buildJobOrderBy(sortBy, sortOrder);

    const [jobs, total] = await Promise.all([
      this.prisma.jobPosting.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          team: { select: { id: true, name: true } },
          _count: { select: { applications: true } },
        },
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.jobPosting.count({ where }),
    ]);

    const items: SearchResultItem[] = jobs.map((job) => ({
      id: job.id,
      entityType: SearchEntityType.JOB,
      title: job.title,
      subtitle: job.location,
      description:
        job.description.substring(0, 200) +
        (job.description.length > 200 ? '...' : ''),
      score: this.calculateJobRelevanceScore(job, searchTerms),
      data: {
        salary: job.salary,
        requirements: job.requirements,
        isActive: job.isActive,
        postedBy: job.user.name,
        teamName: job.team?.name,
        applicationCount: job._count.applications,
      },
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    }));

    return { items, total };
  }

  /**
   * Search jobs with filters
   */
  private async searchJobsWithFilters(
    searchTerms: string[],
    filters: any,
    skip: number,
    limit: number,
    sortBy?: SearchSortField,
    sortOrder?: SortOrder,
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const where: any = {
      AND: [
        {
          OR: [
            { title: { contains: searchTerms[0], mode: 'insensitive' } },
            { description: { contains: searchTerms[0], mode: 'insensitive' } },
            { location: { contains: searchTerms[0], mode: 'insensitive' } },
            { requirements: { hasSome: searchTerms } },
          ],
        },
      ],
    };

    // Apply filters
    if (filters?.location) {
      where.AND.push({
        location: { contains: filters.location, mode: 'insensitive' },
      });
    }
    if (filters?.isActive !== undefined) {
      where.AND.push({ isActive: filters.isActive });
    }
    if (filters?.requirements?.length > 0) {
      where.AND.push({ requirements: { hasSome: filters.requirements } });
    }
    if (filters?.teamId) {
      where.AND.push({ teamId: filters.teamId });
    }

    const orderBy = this.buildJobOrderBy(sortBy, sortOrder);

    const [jobs, total] = await Promise.all([
      this.prisma.jobPosting.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          team: { select: { id: true, name: true } },
          _count: { select: { applications: true } },
        },
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.jobPosting.count({ where }),
    ]);

    const items: SearchResultItem[] = jobs.map((job) => ({
      id: job.id,
      entityType: SearchEntityType.JOB,
      title: job.title,
      subtitle: job.location,
      description:
        job.description.substring(0, 200) +
        (job.description.length > 200 ? '...' : ''),
      score: this.calculateJobRelevanceScore(job, searchTerms),
      data: {
        salary: job.salary,
        requirements: job.requirements,
        isActive: job.isActive,
        postedBy: job.user.name,
        teamName: job.team?.name,
        applicationCount: job._count.applications,
      },
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    }));

    return { items, total };
  }

  private buildJobOrderBy(
    sortBy?: SearchSortField,
    sortOrder?: SortOrder,
  ): any {
    const order = sortOrder || SortOrder.DESC;
    switch (sortBy) {
      case SearchSortField.NAME:
        return { title: order };
      case SearchSortField.CREATED_AT:
        return { createdAt: order };
      case SearchSortField.UPDATED_AT:
        return { updatedAt: order };
      default:
        return { createdAt: order };
    }
  }

  /**
   * Search applications
   */
  private async searchApplications(
    searchTerms: string[],
    skip: number,
    limit: number,
    sortBy?: SearchSortField,
    sortOrder?: SortOrder,
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const where: any = {
      OR: [
        {
          candidate: {
            user: { name: { contains: searchTerms[0], mode: 'insensitive' } },
          },
        },
        {
          candidate: {
            user: { email: { contains: searchTerms[0], mode: 'insensitive' } },
          },
        },
        { job: { title: { contains: searchTerms[0], mode: 'insensitive' } } },
        { coverLetter: { contains: searchTerms[0], mode: 'insensitive' } },
      ],
    };

    const orderBy = this.buildApplicationOrderBy(sortBy, sortOrder);

    const [applications, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: {
          candidate: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          job: { select: { id: true, title: true, location: true } },
        },
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.application.count({ where }),
    ]);

    const items: SearchResultItem[] = applications.map((app) => ({
      id: app.id,
      entityType: SearchEntityType.APPLICATION,
      title: `${app.candidate.user.name} - ${app.job.title}`,
      subtitle: app.status,
      description: app.coverLetter?.substring(0, 200) || '',
      score: this.calculateApplicationRelevanceScore(app, searchTerms),
      data: {
        candidateId: app.candidateId,
        candidateName: app.candidate.user.name,
        candidateEmail: app.candidate.user.email,
        jobId: app.jobId,
        jobTitle: app.job.title,
        jobLocation: app.job.location,
        status: app.status,
        appliedAt: app.appliedAt,
      },
      createdAt: app.appliedAt,
      updatedAt: app.updatedAt,
    }));

    return { items, total };
  }

  /**
   * Search applications with filters
   */
  private async searchApplicationsWithFilters(
    searchTerms: string[],
    filters: any,
    skip: number,
    limit: number,
    sortBy?: SearchSortField,
    sortOrder?: SortOrder,
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const where: any = {
      AND: [
        {
          OR: [
            {
              candidate: {
                user: {
                  name: { contains: searchTerms[0], mode: 'insensitive' },
                },
              },
            },
            {
              candidate: {
                user: {
                  email: { contains: searchTerms[0], mode: 'insensitive' },
                },
              },
            },
            {
              job: { title: { contains: searchTerms[0], mode: 'insensitive' } },
            },
            { coverLetter: { contains: searchTerms[0], mode: 'insensitive' } },
          ],
        },
      ],
    };

    // Apply filters
    if (filters?.status) {
      where.AND.push({ status: filters.status });
    }
    if (filters?.jobId) {
      where.AND.push({ jobId: filters.jobId });
    }
    if (filters?.candidateId) {
      where.AND.push({ candidateId: filters.candidateId });
    }
    if (filters?.appliedAfter) {
      where.AND.push({ appliedAt: { gte: new Date(filters.appliedAfter) } });
    }
    if (filters?.appliedBefore) {
      where.AND.push({ appliedAt: { lte: new Date(filters.appliedBefore) } });
    }

    const orderBy = this.buildApplicationOrderBy(sortBy, sortOrder);

    const [applications, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: {
          candidate: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          job: { select: { id: true, title: true, location: true } },
        },
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.application.count({ where }),
    ]);

    const items: SearchResultItem[] = applications.map((app) => ({
      id: app.id,
      entityType: SearchEntityType.APPLICATION,
      title: `${app.candidate.user.name} - ${app.job.title}`,
      subtitle: app.status,
      description: app.coverLetter?.substring(0, 200) || '',
      score: this.calculateApplicationRelevanceScore(app, searchTerms),
      data: {
        candidateId: app.candidateId,
        candidateName: app.candidate.user.name,
        candidateEmail: app.candidate.user.email,
        jobId: app.jobId,
        jobTitle: app.job.title,
        jobLocation: app.job.location,
        status: app.status,
        appliedAt: app.appliedAt,
      },
      createdAt: app.appliedAt,
      updatedAt: app.updatedAt,
    }));

    return { items, total };
  }

  private buildApplicationOrderBy(
    sortBy?: SearchSortField,
    sortOrder?: SortOrder,
  ): any {
    const order = sortOrder || SortOrder.DESC;
    switch (sortBy) {
      case SearchSortField.NAME:
        return { candidate: { user: { name: order } } };
      case SearchSortField.CREATED_AT:
        return { appliedAt: order };
      case SearchSortField.UPDATED_AT:
        return { updatedAt: order };
      default:
        return { appliedAt: order };
    }
  }

  /**
   * Search all entity types
   */
  private async searchAll(
    searchTerms: string[],
    skip: number,
    limit: number,
    sortBy?: SearchSortField,
    sortOrder?: SortOrder,
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    // Calculate how many items to fetch from each entity type
    const perEntityLimit = Math.ceil(limit / 3);

    const [candidateResults, jobResults, applicationResults] =
      await Promise.all([
        this.searchCandidates(
          searchTerms,
          0,
          perEntityLimit,
          sortBy,
          sortOrder,
        ),
        this.searchJobs(searchTerms, 0, perEntityLimit, sortBy, sortOrder),
        this.searchApplications(
          searchTerms,
          0,
          perEntityLimit,
          sortBy,
          sortOrder,
        ),
      ]);

    // Combine and sort all results by relevance score
    const allItems = [
      ...candidateResults.items,
      ...jobResults.items,
      ...applicationResults.items,
    ].sort((a, b) => b.score - a.score);

    const total =
      candidateResults.total + jobResults.total + applicationResults.total;

    // Apply pagination to combined results
    const paginatedItems = allItems.slice(skip, skip + limit);

    return { items: paginatedItems, total };
  }

  /**
   * Calculate relevance score for a candidate
   */
  private calculateRelevanceScore(
    candidate: any,
    searchTerms: string[],
  ): number {
    let score = 0;
    const name = candidate.user?.name?.toLowerCase() || '';
    const email = candidate.user?.email?.toLowerCase() || '';
    const skills = candidate.skills?.map((s: string) => s.toLowerCase()) || [];
    const experience = candidate.experience?.toLowerCase() || '';
    const education = candidate.education?.toLowerCase() || '';

    for (const term of searchTerms) {
      // Name match (highest weight)
      if (name.includes(term)) score += 30;
      // Email match
      if (email.includes(term)) score += 20;
      // Skills match
      if (skills.some((s: string) => s.includes(term))) score += 25;
      // Experience match
      if (experience.includes(term)) score += 15;
      // Education match
      if (education.includes(term)) score += 10;
    }

    return Math.min(score, 100);
  }

  /**
   * Calculate relevance score for a job
   */
  private calculateJobRelevanceScore(job: any, searchTerms: string[]): number {
    let score = 0;
    const title = job.title?.toLowerCase() || '';
    const description = job.description?.toLowerCase() || '';
    const location = job.location?.toLowerCase() || '';
    const requirements =
      job.requirements?.map((r: string) => r.toLowerCase()) || [];

    for (const term of searchTerms) {
      // Title match (highest weight)
      if (title.includes(term)) score += 35;
      // Location match
      if (location.includes(term)) score += 20;
      // Requirements match
      if (requirements.some((r: string) => r.includes(term))) score += 25;
      // Description match
      if (description.includes(term)) score += 15;
    }

    return Math.min(score, 100);
  }

  /**
   * Calculate relevance score for an application
   */
  private calculateApplicationRelevanceScore(
    application: any,
    searchTerms: string[],
  ): number {
    let score = 0;
    const candidateName =
      application.candidate?.user?.name?.toLowerCase() || '';
    const candidateEmail =
      application.candidate?.user?.email?.toLowerCase() || '';
    const jobTitle = application.job?.title?.toLowerCase() || '';
    const coverLetter = application.coverLetter?.toLowerCase() || '';

    for (const term of searchTerms) {
      if (candidateName.includes(term)) score += 30;
      if (candidateEmail.includes(term)) score += 20;
      if (jobTitle.includes(term)) score += 30;
      if (coverLetter.includes(term)) score += 15;
    }

    return Math.min(score, 100);
  }

  /**
   * Generate highlights for search results
   */
  private generateHighlights(
    item: SearchResultItem,
    searchTerms: string[],
  ): SearchHighlight[] {
    const highlights: SearchHighlight[] = [];

    // Check title
    const titleMatches = this.findMatches(item.title, searchTerms);
    if (titleMatches.length > 0) {
      highlights.push({
        field: 'title',
        snippet: this.createHighlightSnippet(item.title, searchTerms),
        matchedTerms: titleMatches,
      });
    }

    // Check description
    if (item.description) {
      const descMatches = this.findMatches(item.description, searchTerms);
      if (descMatches.length > 0) {
        highlights.push({
          field: 'description',
          snippet: this.createHighlightSnippet(item.description, searchTerms),
          matchedTerms: descMatches,
        });
      }
    }

    // Check subtitle
    if (item.subtitle) {
      const subtitleMatches = this.findMatches(item.subtitle, searchTerms);
      if (subtitleMatches.length > 0) {
        highlights.push({
          field: 'subtitle',
          snippet: this.createHighlightSnippet(item.subtitle, searchTerms),
          matchedTerms: subtitleMatches,
        });
      }
    }

    return highlights;
  }

  private findMatches(text: string, searchTerms: string[]): string[] {
    const lowerText = text.toLowerCase();
    return searchTerms.filter((term) => lowerText.includes(term));
  }

  private createHighlightSnippet(text: string, searchTerms: string[]): string {
    let snippet = text;
    for (const term of searchTerms) {
      const regex = new RegExp(`(${term})`, 'gi');
      snippet = snippet.replace(regex, '<mark>$1</mark>');
    }
    return snippet;
  }

  /**
   * Create a saved search
   */
  async createSavedSearch(
    userId: string,
    dto: CreateSavedSearchDto,
  ): Promise<SavedSearch> {
    const savedSearch = await this.prisma.savedSearch.create({
      data: {
        name: dto.name,
        description: dto.description,
        query: dto.query,
        entityType: dto.entityType
          ? (dto.entityType as unknown as PrismaSearchEntityType)
          : PrismaSearchEntityType.ALL,
        filters: dto.filters || {},
        alertEnabled: dto.alertEnabled || false,
        alertFrequency: dto.alertFrequency
          ? (dto.alertFrequency.toUpperCase() as AlertFrequency)
          : null,
        isShared: dto.isShared || false,
        createdBy: userId,
      },
    });

    this.eventBus.publish('search.saved_search_created', {
      savedSearchId: savedSearch.id,
      name: savedSearch.name,
      createdBy: userId,
    });

    this.logger.log(`Saved search "${dto.name}" created by user ${userId}`);

    return this.mapSavedSearch(savedSearch);
  }

  /**
   * Get saved searches for a user
   */
  async getSavedSearches(
    userId: string,
    includeShared: boolean = true,
  ): Promise<SavedSearch[]> {
    const where: any = {
      OR: [{ createdBy: userId }],
    };

    if (includeShared) {
      where.OR.push({ isShared: true });
    }

    const savedSearches = await this.prisma.savedSearch.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });

    return savedSearches.map(this.mapSavedSearch);
  }

  /**
   * Get a saved search by ID
   */
  async getSavedSearchById(id: string, userId: string): Promise<SavedSearch> {
    const savedSearch = await this.prisma.savedSearch.findFirst({
      where: {
        id,
        OR: [{ createdBy: userId }, { isShared: true }],
      },
    });

    if (!savedSearch) {
      throw new NotFoundException('Saved search not found');
    }

    return this.mapSavedSearch(savedSearch);
  }

  /**
   * Update a saved search
   */
  async updateSavedSearch(
    id: string,
    userId: string,
    dto: UpdateSavedSearchDto,
  ): Promise<SavedSearch> {
    const existing = await this.prisma.savedSearch.findFirst({
      where: { id, createdBy: userId },
    });

    if (!existing) {
      throw new NotFoundException(
        'Saved search not found or you do not have permission to update it',
      );
    }

    const savedSearch = await this.prisma.savedSearch.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.query !== undefined && { query: dto.query }),
        ...(dto.entityType !== undefined && {
          entityType: dto.entityType as unknown as PrismaSearchEntityType,
        }),
        ...(dto.filters !== undefined && { filters: dto.filters }),
        ...(dto.alertEnabled !== undefined && {
          alertEnabled: dto.alertEnabled,
        }),
        ...(dto.alertFrequency !== undefined && {
          alertFrequency: dto.alertFrequency.toUpperCase() as AlertFrequency,
        }),
        ...(dto.isShared !== undefined && { isShared: dto.isShared }),
      },
    });

    this.eventBus.publish('search.saved_search_updated', {
      savedSearchId: savedSearch.id,
      updatedBy: userId,
    });

    return this.mapSavedSearch(savedSearch);
  }

  /**
   * Delete a saved search
   */
  async deleteSavedSearch(id: string, userId: string): Promise<void> {
    const existing = await this.prisma.savedSearch.findFirst({
      where: { id, createdBy: userId },
    });

    if (!existing) {
      throw new NotFoundException(
        'Saved search not found or you do not have permission to delete it',
      );
    }

    await this.prisma.savedSearch.delete({ where: { id } });

    this.eventBus.publish('search.saved_search_deleted', {
      savedSearchId: id,
      deletedBy: userId,
    });

    this.logger.log(`Saved search ${id} deleted by user ${userId}`);
  }

  /**
   * Execute a saved search
   */
  async executeSavedSearch(
    id: string,
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<SearchResults> {
    const savedSearch = await this.getSavedSearchById(id, userId);

    const searchDto: AdvancedSearchDto = {
      query: savedSearch.query,
      entityType: savedSearch.entityType,
      page,
      limit,
      highlightResults: true,
    };

    if (savedSearch.filters) {
      if (savedSearch.entityType === SearchEntityType.CANDIDATE) {
        searchDto.candidateFilters = savedSearch.filters as any;
      } else if (savedSearch.entityType === SearchEntityType.JOB) {
        searchDto.jobFilters = savedSearch.filters as any;
      } else if (savedSearch.entityType === SearchEntityType.APPLICATION) {
        searchDto.applicationFilters = savedSearch.filters as any;
      }
    }

    const results = await this.advancedSearch(searchDto, userId);

    // Update last executed timestamp and result count
    await this.prisma.savedSearch.update({
      where: { id },
      data: {
        lastExecutedAt: new Date(),
        resultCount: results.total,
      },
    });

    return results;
  }

  private mapSavedSearch(savedSearch: any): SavedSearch {
    return {
      id: savedSearch.id,
      name: savedSearch.name,
      description: savedSearch.description,
      query: savedSearch.query,
      entityType: savedSearch.entityType as SearchEntityType,
      filters: savedSearch.filters as Record<string, any>,
      alertEnabled: savedSearch.alertEnabled,
      alertFrequency: savedSearch.alertFrequency?.toLowerCase(),
      isShared: savedSearch.isShared,
      createdBy: savedSearch.createdBy,
      lastExecutedAt: savedSearch.lastExecutedAt,
      resultCount: savedSearch.resultCount,
      createdAt: savedSearch.createdAt,
      updatedAt: savedSearch.updatedAt,
    };
  }

  /**
   * Check for new results in saved searches with alerts enabled
   */
  async checkSearchAlerts(): Promise<void> {
    const alertSearches = await this.prisma.savedSearch.findMany({
      where: { alertEnabled: true },
      include: { creator: { select: { id: true, email: true, name: true } } },
    });

    for (const savedSearch of alertSearches) {
      try {
        const results = await this.executeSavedSearch(
          savedSearch.id,
          savedSearch.createdBy,
          1,
          10,
        );

        const previousCount = savedSearch.resultCount || 0;
        const newCount = results.total;

        if (newCount > previousCount) {
          this.eventBus.publish('search.alert_triggered', {
            savedSearchId: savedSearch.id,
            savedSearchName: savedSearch.name,
            userId: savedSearch.createdBy,
            userEmail: savedSearch.creator.email,
            newResultsCount: newCount - previousCount,
            totalResults: newCount,
          });

          this.logger.log(
            `Search alert triggered for "${savedSearch.name}": ${newCount - previousCount} new results`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Error checking alert for saved search ${savedSearch.id}:`,
          error,
        );
      }
    }
  }
}
