import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { WebhookDeliveryService } from '../communication/webhook-delivery.service';
import {
  CreateApiKeyDto,
  UpdateApiKeyDto,
  ApiKeyResponseDto,
  ApiKeyCreatedResponseDto,
  ExternalApplicationDto,
  ExternalCandidateDto,
  BulkImportDto,
  ApiScope,
} from '../common/dto/integration.dto';
import { WebhookEvent, Role, ApplicationStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly webhookDeliveryService: WebhookDeliveryService,
  ) {}

  /**
   * Generate a new API key
   */
  private generateApiKey(): { key: string; hash: string; prefix: string } {
    const key = `ats_${crypto.randomBytes(32).toString('hex')}`;
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    const prefix = key.substring(0, 12);
    return { key, hash, prefix };
  }

  /**
   * Create a new API key
   */
  async createApiKey(
    userId: string,
    data: CreateApiKeyDto,
  ): Promise<ApiKeyCreatedResponseDto> {
    const { key, hash, prefix } = this.generateApiKey();

    const apiKey = await this.prisma.apiKey.create({
      data: {
        name: data.name,
        description: data.description,
        keyHash: hash,
        keyPrefix: prefix,
        scopes: data.scopes || [ApiScope.READ_JOBS, ApiScope.READ_CANDIDATES],
        rateLimit: data.rateLimit || 100,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        userId,
      },
    });

    this.logger.log(`Created API key ${apiKey.id} for user ${userId}`);

    return {
      id: apiKey.id,
      name: apiKey.name,
      description: apiKey.description || undefined,
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      isActive: apiKey.isActive,
      rateLimit: apiKey.rateLimit,
      expiresAt: apiKey.expiresAt || undefined,
      createdAt: apiKey.createdAt,
      apiKey: key, // Only returned on creation
    };
  }

  /**
   * Get all API keys for a user
   */
  async getApiKeys(userId: string): Promise<ApiKeyResponseDto[]> {
    const apiKeys = await this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return apiKeys.map((key) => ({
      id: key.id,
      name: key.name,
      description: key.description || undefined,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes,
      isActive: key.isActive,
      rateLimit: key.rateLimit,
      lastUsedAt: key.lastUsedAt || undefined,
      expiresAt: key.expiresAt || undefined,
      createdAt: key.createdAt,
    }));
  }

  /**
   * Get API key by ID
   */
  async getApiKeyById(id: string, userId: string): Promise<ApiKeyResponseDto> {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id, userId },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    return {
      id: apiKey.id,
      name: apiKey.name,
      description: apiKey.description || undefined,
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      isActive: apiKey.isActive,
      rateLimit: apiKey.rateLimit,
      lastUsedAt: apiKey.lastUsedAt || undefined,
      expiresAt: apiKey.expiresAt || undefined,
      createdAt: apiKey.createdAt,
    };
  }

  /**
   * Update an API key
   */
  async updateApiKey(
    id: string,
    userId: string,
    data: UpdateApiKeyDto,
  ): Promise<ApiKeyResponseDto> {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('API key not found');
    }

    const apiKey = await this.prisma.apiKey.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        scopes: data.scopes,
        isActive: data.isActive,
        rateLimit: data.rateLimit,
      },
    });

    this.logger.log(`Updated API key ${id}`);

    return {
      id: apiKey.id,
      name: apiKey.name,
      description: apiKey.description || undefined,
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      isActive: apiKey.isActive,
      rateLimit: apiKey.rateLimit,
      lastUsedAt: apiKey.lastUsedAt || undefined,
      expiresAt: apiKey.expiresAt || undefined,
      createdAt: apiKey.createdAt,
    };
  }

  /**
   * Delete an API key
   */
  async deleteApiKey(id: string, userId: string): Promise<void> {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.apiKey.delete({ where: { id } });

    this.logger.log(`Deleted API key ${id}`);
  }

  /**
   * Regenerate an API key
   */
  async regenerateApiKey(
    id: string,
    userId: string,
  ): Promise<ApiKeyCreatedResponseDto> {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('API key not found');
    }

    const { key, hash, prefix } = this.generateApiKey();

    const apiKey = await this.prisma.apiKey.update({
      where: { id },
      data: {
        keyHash: hash,
        keyPrefix: prefix,
      },
    });

    this.logger.log(`Regenerated API key ${id}`);

    return {
      id: apiKey.id,
      name: apiKey.name,
      description: apiKey.description || undefined,
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      isActive: apiKey.isActive,
      rateLimit: apiKey.rateLimit,
      lastUsedAt: apiKey.lastUsedAt || undefined,
      expiresAt: apiKey.expiresAt || undefined,
      createdAt: apiKey.createdAt,
      apiKey: key,
    };
  }

  /**
   * Submit application via external API
   */
  async submitExternalApplication(
    data: ExternalApplicationDto,
  ): Promise<{ applicationId: string; candidateId: string }> {
    // Check if job exists and is active
    const job = await this.prisma.jobPosting.findUnique({
      where: { id: data.jobId },
    });

    if (!job || !job.isActive) {
      throw new NotFoundException('Job not found or inactive');
    }

    // Find or create user and candidate
    let user = await this.prisma.user.findUnique({
      where: { email: data.candidateEmail },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: data.candidateEmail,
          name: data.candidateName,
          password: crypto.randomBytes(16).toString('hex'), // Random password
          role: Role.CANDIDATE,
        },
      });
    }

    let candidate = await this.prisma.candidate.findUnique({
      where: { userId: user.id },
    });

    if (!candidate) {
      candidate = await this.prisma.candidate.create({
        data: {
          userId: user.id,
          resumeUrl: data.resumeUrl,
        },
      });
    }

    // Check for existing application
    const existingApplication = await this.prisma.application.findUnique({
      where: {
        candidateId_jobId: {
          candidateId: candidate.id,
          jobId: data.jobId,
        },
      },
    });

    if (existingApplication) {
      throw new ConflictException('Application already exists for this job');
    }

    // Create application
    const application = await this.prisma.application.create({
      data: {
        candidateId: candidate.id,
        jobId: data.jobId,
        userId: user.id,
        coverLetter: data.coverLetter,
        resumeUrl: data.resumeUrl,
        status: ApplicationStatus.APPLIED,
      },
    });

    // Trigger webhooks
    await this.webhookDeliveryService.triggerWebhooks(
      WebhookEvent.CANDIDATE_APPLIED,
      {
        applicationId: application.id,
        candidateId: candidate.id,
        jobId: data.jobId,
        source: data.source || 'api',
        timestamp: new Date().toISOString(),
      },
    );

    // Publish event
    this.eventBus.publish('candidate.applied', {
      applicationId: application.id,
      candidateId: candidate.id,
      jobId: data.jobId,
    });

    this.logger.log(
      `External application submitted: ${application.id} for job ${data.jobId}`,
    );

    return {
      applicationId: application.id,
      candidateId: candidate.id,
    };
  }

  /**
   * Import candidate to talent pool
   */
  async importCandidate(
    data: ExternalCandidateDto,
    importedBy: string,
  ): Promise<{ candidateId: string; userId: string }> {
    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: data.email,
          name: data.name,
          phone: data.phone,
          password: crypto.randomBytes(16).toString('hex'),
          role: Role.CANDIDATE,
        },
      });
    }

    // Find or create candidate
    let candidate = await this.prisma.candidate.findUnique({
      where: { userId: user.id },
    });

    if (!candidate) {
      candidate = await this.prisma.candidate.create({
        data: {
          userId: user.id,
          resumeUrl: data.resumeUrl,
          skills: data.skills || [],
          experience: data.experience,
          education: data.education,
        },
      });
    } else {
      // Update existing candidate
      candidate = await this.prisma.candidate.update({
        where: { id: candidate.id },
        data: {
          resumeUrl: data.resumeUrl || candidate.resumeUrl,
          skills: data.skills || candidate.skills,
          experience: data.experience || candidate.experience,
          education: data.education || candidate.education,
        },
      });
    }

    this.logger.log(`Imported candidate: ${candidate.id}`);

    return {
      candidateId: candidate.id,
      userId: user.id,
    };
  }

  /**
   * Bulk import candidates
   */
  async bulkImportCandidates(
    data: BulkImportDto,
    importedBy: string,
  ): Promise<{
    imported: number;
    skipped: number;
    errors: Array<{ email: string; error: string }>;
  }> {
    let imported = 0;
    let skipped = 0;
    const errors: Array<{ email: string; error: string }> = [];

    for (const candidateData of data.candidates) {
      try {
        // Check if candidate exists
        const existingUser = await this.prisma.user.findUnique({
          where: { email: candidateData.email },
        });

        if (existingUser && data.skipDuplicates) {
          skipped++;
          continue;
        }

        await this.importCandidate(candidateData, importedBy);
        imported++;
      } catch (error) {
        errors.push({
          email: candidateData.email,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.logger.log(
      `Bulk import completed: ${imported} imported, ${skipped} skipped, ${errors.length} errors`,
    );

    return { imported, skipped, errors };
  }

  /**
   * Get public jobs for external integrations
   */
  async getPublicJobs(options?: {
    limit?: number;
    offset?: number;
    location?: string;
  }): Promise<{
    jobs: any[];
    total: number;
  }> {
    const where: any = { isActive: true };

    if (options?.location) {
      where.location = { contains: options.location, mode: 'insensitive' };
    }

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
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      this.prisma.jobPosting.count({ where }),
    ]);

    return { jobs, total };
  }

  /**
   * Get job details for external integrations
   */
  async getPublicJobById(jobId: string): Promise<any> {
    const job = await this.prisma.jobPosting.findFirst({
      where: { id: jobId, isActive: true },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        salary: true,
        requirements: true,
        createdAt: true,
        updatedAt: true,
        customFields: {
          select: {
            fieldName: true,
            fieldType: true,
            isRequired: true,
            options: true,
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  /**
   * Get application status for external integrations
   */
  async getApplicationStatus(applicationId: string): Promise<{
    id: string;
    status: string;
    appliedAt: Date;
    updatedAt: Date;
  }> {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        appliedAt: true,
        updatedAt: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return application;
  }

  /**
   * Get integration health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, { status: string; latency?: number }>;
    timestamp: string;
  }> {
    const services: Record<string, { status: string; latency?: number }> = {};

    // Check database
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      services.database = { status: 'healthy', latency: Date.now() - start };
    } catch {
      services.database = { status: 'unhealthy' };
    }

    // Determine overall status
    const unhealthyServices = Object.values(services).filter(
      (s) => s.status === 'unhealthy',
    );
    const status =
      unhealthyServices.length === 0
        ? 'healthy'
        : unhealthyServices.length < Object.keys(services).length
          ? 'degraded'
          : 'unhealthy';

    return {
      status,
      services,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get available API scopes
   */
  getAvailableScopes(): Array<{ scope: string; description: string }> {
    return [
      { scope: ApiScope.READ_JOBS, description: 'Read job postings' },
      {
        scope: ApiScope.WRITE_JOBS,
        description: 'Create and update job postings',
      },
      {
        scope: ApiScope.READ_CANDIDATES,
        description: 'Read candidate information',
      },
      {
        scope: ApiScope.WRITE_CANDIDATES,
        description: 'Create and update candidates',
      },
      { scope: ApiScope.READ_APPLICATIONS, description: 'Read applications' },
      {
        scope: ApiScope.WRITE_APPLICATIONS,
        description: 'Submit applications',
      },
      {
        scope: ApiScope.READ_INTERVIEWS,
        description: 'Read interview information',
      },
      { scope: ApiScope.WRITE_INTERVIEWS, description: 'Schedule interviews' },
      { scope: ApiScope.READ_ANALYTICS, description: 'Read analytics data' },
      { scope: ApiScope.WEBHOOKS, description: 'Manage webhooks' },
      { scope: ApiScope.ADMIN, description: 'Full administrative access' },
    ];
  }
}
