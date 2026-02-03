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
  PublicJobSearchDto,
  PublicApplicationDto,
  CreateCareerPageDto,
  UpdateCareerPageDto,
  PublicJob,
  PublicJobDetails,
  PublicJobSearchResult,
  CareerPage,
  ApplicationConfirmation,
  JobViewMetadata,
} from '../common/dto/career-portal.dto';
import { Role, ApplicationStatus } from '@prisma/client';

@Injectable()
export class CareerPortalService {
  private readonly logger = new Logger(CareerPortalService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  /**
   * Get public job listings with search and filtering
   * Requirements: 8.1, 8.2
   */
  async getPublicJobs(dto: PublicJobSearchDto): Promise<PublicJobSearchResult> {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    // Build where clause - only active jobs
    const where: any = {
      isActive: true,
    };

    // Text search in title and description
    if (dto.query) {
      where.OR = [
        { title: { contains: dto.query, mode: 'insensitive' } },
        { description: { contains: dto.query, mode: 'insensitive' } },
      ];
    }

    // Location filter
    if (dto.location) {
      where.location = { contains: dto.location, mode: 'insensitive' };
    }

    // Skills filter (search in requirements)
    if (dto.skills && dto.skills.length > 0) {
      where.requirements = {
        hasSome: dto.skills,
      };
    }

    // Build orderBy
    const sortBy = dto.sortBy || 'createdAt';
    const sortOrder = dto.sortOrder || 'desc';
    const orderBy: any = { [sortBy]: sortOrder };

    // Execute query
    const [jobs, total] = await Promise.all([
      this.prisma.jobPosting.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          salary: true,
          requirements: true,
          createdAt: true,
          user: {
            select: {
              name: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.jobPosting.count({ where }),
    ]);

    // Transform to public format
    const publicJobs: PublicJob[] = jobs.map((job) => ({
      id: job.id,
      title: job.title,
      description: job.description,
      location: job.location,
      salary: job.salary || undefined,
      requirements: job.requirements,
      createdAt: job.createdAt,
      companyName: job.user.name,
    }));

    return {
      jobs: publicJobs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get public job details by ID
   * Requirements: 8.1, 8.4
   */
  async getJobDetails(jobId: string): Promise<PublicJobDetails> {
    const job = await this.prisma.jobPosting.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        salary: true,
        requirements: true,
        isActive: true,
        createdAt: true,
        user: {
          select: {
            name: true,
          },
        },
        customFields: {
          select: {
            id: true,
            fieldName: true,
            fieldType: true,
            isRequired: true,
            options: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // Only return active jobs publicly
    if (!job.isActive) {
      throw new NotFoundException('Job not found');
    }

    return {
      id: job.id,
      title: job.title,
      description: job.description,
      location: job.location,
      salary: job.salary || undefined,
      requirements: job.requirements,
      createdAt: job.createdAt,
      companyName: job.user.name,
      customFields: job.customFields.map((field) => ({
        id: field.id,
        fieldName: field.fieldName,
        fieldType: field.fieldType,
        isRequired: field.isRequired,
        options: field.options,
      })),
    };
  }

  /**
   * Submit a public application
   * Requirements: 8.2, 8.5
   */
  async submitApplication(
    jobId: string,
    dto: PublicApplicationDto,
  ): Promise<ApplicationConfirmation> {
    // Check if job exists and is active
    const job = await this.prisma.jobPosting.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        isActive: true,
        customFields: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (!job.isActive) {
      throw new BadRequestException(
        'This job is no longer accepting applications',
      );
    }

    // Validate required custom fields
    if (job.customFields && job.customFields.length > 0) {
      for (const field of job.customFields) {
        if (
          field.isRequired &&
          (!dto.customFields || !dto.customFields[field.fieldName])
        ) {
          throw new BadRequestException(`${field.fieldName} is required`);
        }
      }
    }

    // Check if user already exists
    let user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    let candidate;
    let isNewUser = false;

    if (user) {
      // Get existing candidate profile
      candidate = await this.prisma.candidate.findUnique({
        where: { userId: user.id },
      });

      // Check if already applied to this job
      if (candidate) {
        const existingApplication = await this.prisma.application.findUnique({
          where: {
            candidateId_jobId: {
              candidateId: candidate.id,
              jobId,
            },
          },
        });

        if (existingApplication) {
          throw new ConflictException('You have already applied to this job');
        }
      }
    } else {
      // Create new user
      isNewUser = true;
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          name: `${dto.firstName} ${dto.lastName}`,
          phone: dto.phone,
          password: '', // No password for public applicants
          role: Role.CANDIDATE,
        },
      });
    }

    // Create or update candidate profile
    if (!candidate) {
      candidate = await this.prisma.candidate.create({
        data: {
          userId: user.id,
          resumeUrl: dto.resumeUrl,
          skills: [],
        },
      });
    } else if (dto.resumeUrl && !candidate.resumeUrl) {
      // Update resume if provided and not already set
      candidate = await this.prisma.candidate.update({
        where: { id: candidate.id },
        data: { resumeUrl: dto.resumeUrl },
      });
    }

    // Create application
    const application = await this.prisma.application.create({
      data: {
        candidateId: candidate.id,
        jobId,
        userId: user.id,
        coverLetter: dto.coverLetter,
        resumeUrl: dto.resumeUrl,
        status: ApplicationStatus.APPLIED,
      },
    });

    // Update job analytics
    await this.updateJobAnalytics(jobId, 'application');

    // Publish event
    this.eventBus.publish('candidate.applied', {
      applicationId: application.id,
      candidateId: candidate.id,
      jobId,
      source: dto.source || 'career_portal',
      isNewUser,
    });

    this.logger.log(
      `New application submitted for job ${jobId} by ${dto.email}`,
    );

    return {
      applicationId: application.id,
      jobTitle: job.title,
      candidateName: `${dto.firstName} ${dto.lastName}`,
      email: dto.email,
      appliedAt: application.appliedAt,
      nextSteps:
        'Thank you for your application! Our team will review your profile and get back to you soon.',
    };
  }

  /**
   * Get career page by company slug
   * Requirements: 8.3, 8.4
   */
  async getCareerPage(slug: string): Promise<CareerPage> {
    const page = await this.prisma.careerPage.findUnique({
      where: { slug },
    });

    if (!page) {
      throw new NotFoundException('Career page not found');
    }

    // Only return published pages publicly
    if (!page.isPublished) {
      throw new NotFoundException('Career page not found');
    }

    return page as CareerPage;
  }

  /**
   * Get career page by ID (for admin)
   */
  async getCareerPageById(id: string): Promise<CareerPage> {
    const page = await this.prisma.careerPage.findUnique({
      where: { id },
    });

    if (!page) {
      throw new NotFoundException('Career page not found');
    }

    return page as CareerPage;
  }

  /**
   * Create a new career page
   * Requirements: 8.3
   */
  async createCareerPage(dto: CreateCareerPageDto): Promise<CareerPage> {
    // Check if slug is already taken
    const existing = await this.prisma.careerPage.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException(
        'A career page with this slug already exists',
      );
    }

    const page = await this.prisma.careerPage.create({
      data: {
        companyId: dto.companyId,
        slug: dto.slug,
        title: dto.title,
        description: dto.description || '',
        sections: dto.sections || this.getDefaultSections(),
        theme: dto.theme || this.getDefaultTheme(),
        isPublished: dto.isPublished || false,
        publishedAt: dto.isPublished ? new Date() : null,
      },
    });

    this.logger.log(`Career page created: ${dto.slug}`);

    return page as CareerPage;
  }

  /**
   * Update a career page
   * Requirements: 8.3
   */
  async updateCareerPage(
    id: string,
    dto: UpdateCareerPageDto,
  ): Promise<CareerPage> {
    const existing = await this.prisma.careerPage.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Career page not found');
    }

    // Check slug uniqueness if changing
    if (dto.slug && dto.slug !== existing.slug) {
      const slugExists = await this.prisma.careerPage.findUnique({
        where: { slug: dto.slug },
      });

      if (slugExists) {
        throw new ConflictException(
          'A career page with this slug already exists',
        );
      }
    }

    // Handle publishing
    const updateData: any = {
      ...(dto.slug !== undefined && { slug: dto.slug }),
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.sections !== undefined && { sections: dto.sections }),
      ...(dto.theme !== undefined && { theme: dto.theme }),
    };

    if (dto.isPublished !== undefined) {
      updateData.isPublished = dto.isPublished;
      if (dto.isPublished && !existing.isPublished) {
        updateData.publishedAt = new Date();
      }
    }

    const page = await this.prisma.careerPage.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Career page updated: ${page.slug}`);

    return page as CareerPage;
  }

  /**
   * Delete a career page
   */
  async deleteCareerPage(id: string): Promise<void> {
    const existing = await this.prisma.careerPage.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Career page not found');
    }

    await this.prisma.careerPage.delete({
      where: { id },
    });

    this.logger.log(`Career page deleted: ${existing.slug}`);
  }

  /**
   * Get all career pages (for admin)
   */
  async getAllCareerPages(): Promise<CareerPage[]> {
    const pages = await this.prisma.careerPage.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return pages as CareerPage[];
  }

  /**
   * Track job view for analytics
   * Requirements: 8.1
   */
  async trackJobView(metadata: JobViewMetadata): Promise<void> {
    try {
      // Update job analytics
      await this.updateJobAnalytics(metadata.jobId, 'view');

      // Publish event for further processing
      this.eventBus.publish('job.viewed', {
        jobId: metadata.jobId,
        source: metadata.source,
        referrer: metadata.referrer,
        timestamp: metadata.timestamp,
      });
    } catch (error) {
      // Don't fail the request if analytics tracking fails
      this.logger.warn(`Failed to track job view: ${error}`);
    }
  }

  /**
   * Update job analytics counters
   */
  private async updateJobAnalytics(
    jobId: string,
    type: 'view' | 'application',
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    // Upsert job analytics
    await this.prisma.jobAnalytics.upsert({
      where: { jobId },
      create: {
        jobId,
        totalViews: type === 'view' ? 1 : 0,
        totalApplications: type === 'application' ? 1 : 0,
        sourceBreakdown: {},
        viewsOverTime: { [today]: type === 'view' ? 1 : 0 },
        applicationsOverTime: { [today]: type === 'application' ? 1 : 0 },
      },
      update: {
        totalViews: type === 'view' ? { increment: 1 } : undefined,
        totalApplications:
          type === 'application' ? { increment: 1 } : undefined,
      },
    });
  }

  /**
   * Get default career page sections
   */
  private getDefaultSections(): any[] {
    return [
      {
        type: 'hero',
        title: 'Join Our Team',
        content: 'Discover exciting career opportunities and grow with us.',
        order: 1,
        isVisible: true,
      },
      {
        type: 'about',
        title: 'About Us',
        content: 'We are a company dedicated to innovation and excellence.',
        order: 2,
        isVisible: true,
      },
      {
        type: 'benefits',
        title: 'Benefits & Perks',
        items: [
          {
            title: 'Health Insurance',
            description: 'Comprehensive health coverage',
          },
          { title: 'Remote Work', description: 'Flexible work arrangements' },
          {
            title: 'Learning Budget',
            description: 'Annual learning and development budget',
          },
        ],
        order: 3,
        isVisible: true,
      },
    ];
  }

  /**
   * Get default career page theme
   */
  private getDefaultTheme(): any {
    return {
      primaryColor: '#3B82F6',
      secondaryColor: '#1E40AF',
      backgroundColor: '#FFFFFF',
      textColor: '#1F2937',
      fontFamily: 'Inter, sans-serif',
      // Mobile-responsive settings (Requirement 8.6)
      mobileSettings: {
        showBanner: true,
        compactJobCards: true,
        stickyHeader: true,
        bottomNavigation: false,
      },
    };
  }

  /**
   * Get jobs for a specific career page
   */
  async getJobsForCareerPage(
    slug: string,
    dto: PublicJobSearchDto,
  ): Promise<PublicJobSearchResult> {
    // Verify career page exists and is published
    const page = await this.prisma.careerPage.findUnique({
      where: { slug },
    });

    if (!page || !page.isPublished) {
      throw new NotFoundException('Career page not found');
    }

    // Get jobs - in a real implementation, you'd filter by company
    // For now, return all active jobs
    return this.getPublicJobs(dto);
  }

  /**
   * Get featured jobs for career page
   */
  async getFeaturedJobs(limit: number = 5): Promise<PublicJob[]> {
    const jobs = await this.prisma.jobPosting.findMany({
      where: { isActive: true },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        salary: true,
        requirements: true,
        createdAt: true,
        user: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return jobs.map((job) => ({
      id: job.id,
      title: job.title,
      description: job.description,
      location: job.location,
      salary: job.salary || undefined,
      requirements: job.requirements,
      createdAt: job.createdAt,
      companyName: job.user.name,
    }));
  }

  /**
   * Get job locations for filtering
   */
  async getJobLocations(): Promise<string[]> {
    const jobs = await this.prisma.jobPosting.findMany({
      where: { isActive: true },
      select: { location: true },
      distinct: ['location'],
    });

    return jobs.map((job) => job.location).sort();
  }

  /**
   * Get job count by location
   */
  async getJobCountByLocation(): Promise<
    { location: string; count: number }[]
  > {
    const jobs = await this.prisma.jobPosting.groupBy({
      by: ['location'],
      where: { isActive: true },
      _count: { id: true },
    });

    return jobs.map((item) => ({
      location: item.location,
      count: item._count.id,
    }));
  }

  /**
   * Duplicate a career page
   * Requirements: 8.3
   */
  async duplicateCareerPage(id: string): Promise<CareerPage> {
    const existing = await this.prisma.careerPage.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Career page not found');
    }

    // Generate unique slug
    let newSlug = `${existing.slug}-copy`;
    let counter = 1;
    while (
      await this.prisma.careerPage.findUnique({ where: { slug: newSlug } })
    ) {
      newSlug = `${existing.slug}-copy-${counter}`;
      counter++;
    }

    const page = await this.prisma.careerPage.create({
      data: {
        companyId: existing.companyId,
        slug: newSlug,
        title: `${existing.title} (Copy)`,
        description: existing.description,
        sections: existing.sections as any,
        theme: existing.theme as any,
        isPublished: false,
      },
    });

    this.logger.log(`Career page duplicated: ${existing.slug} -> ${newSlug}`);

    return page as CareerPage;
  }

  /**
   * Get career page statistics
   */
  async getCareerPageStats(id: string): Promise<{
    totalJobs: number;
    totalViews: number;
    totalApplications: number;
  }> {
    const page = await this.prisma.careerPage.findUnique({
      where: { id },
    });

    if (!page) {
      throw new NotFoundException('Career page not found');
    }

    // Get job statistics
    const [totalJobs, analytics] = await Promise.all([
      this.prisma.jobPosting.count({ where: { isActive: true } }),
      this.prisma.jobAnalytics.aggregate({
        _sum: {
          totalViews: true,
          totalApplications: true,
        },
      }),
    ]);

    return {
      totalJobs,
      totalViews: analytics._sum.totalViews || 0,
      totalApplications: analytics._sum.totalApplications || 0,
    };
  }
}
