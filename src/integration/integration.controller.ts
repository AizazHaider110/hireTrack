import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { RateLimitGuard, RateLimit } from '../auth/guards/rate-limit.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiScopes } from '../auth/decorators/api-scopes.decorator';
import { IntegrationService } from './integration.service';
import {
  CreateApiKeyDto,
  UpdateApiKeyDto,
  ExternalApplicationDto,
  ExternalCandidateDto,
  BulkImportDto,
  ApiScope,
} from '../common/dto/integration.dto';
import { Role } from '@prisma/client';

/**
 * API Key Management Endpoints (JWT Auth)
 */
@Controller('integration/api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApiKeyController {
  constructor(private readonly integrationService: IntegrationService) {}

  @Post()
  @Roles(Role.ADMIN, Role.HIRING_MANAGER, Role.RECRUITER)
  async createApiKey(@Body() data: CreateApiKeyDto, @Request() req: any) {
    return this.integrationService.createApiKey(req.user.id, data);
  }

  @Get()
  @Roles(Role.ADMIN, Role.HIRING_MANAGER, Role.RECRUITER)
  async getApiKeys(@Request() req: any) {
    return this.integrationService.getApiKeys(req.user.id);
  }

  @Get('scopes')
  @Roles(Role.ADMIN, Role.HIRING_MANAGER, Role.RECRUITER)
  getAvailableScopes() {
    return this.integrationService.getAvailableScopes();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.HIRING_MANAGER, Role.RECRUITER)
  async getApiKey(@Param('id') id: string, @Request() req: any) {
    return this.integrationService.getApiKeyById(id, req.user.id);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.HIRING_MANAGER, Role.RECRUITER)
  async updateApiKey(
    @Param('id') id: string,
    @Body() data: UpdateApiKeyDto,
    @Request() req: any,
  ) {
    return this.integrationService.updateApiKey(id, req.user.id, data);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.HIRING_MANAGER, Role.RECRUITER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteApiKey(@Param('id') id: string, @Request() req: any) {
    await this.integrationService.deleteApiKey(id, req.user.id);
  }

  @Post(':id/regenerate')
  @Roles(Role.ADMIN, Role.HIRING_MANAGER, Role.RECRUITER)
  async regenerateApiKey(@Param('id') id: string, @Request() req: any) {
    return this.integrationService.regenerateApiKey(id, req.user.id);
  }
}

/**
 * External API Endpoints (API Key Auth with Rate Limiting)
 */
@Controller('api/v1')
@UseGuards(ApiKeyGuard, RateLimitGuard)
export class ExternalApiController {
  constructor(private readonly integrationService: IntegrationService) {}

  /**
   * Health check endpoint
   */
  @Get('health')
  @RateLimit(1000) // Higher rate limit for health checks
  async healthCheck() {
    return this.integrationService.getHealthStatus();
  }

  /**
   * Get public job listings
   */
  @Get('jobs')
  @ApiScopes(ApiScope.READ_JOBS)
  @RateLimit(100)
  async getJobs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('location') location?: string,
  ) {
    return this.integrationService.getPublicJobs({
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      location,
    });
  }

  /**
   * Get job details
   */
  @Get('jobs/:id')
  @ApiScopes(ApiScope.READ_JOBS)
  @RateLimit(100)
  async getJob(@Param('id') id: string) {
    return this.integrationService.getPublicJobById(id);
  }

  /**
   * Submit application
   */
  @Post('applications')
  @ApiScopes(ApiScope.WRITE_APPLICATIONS)
  @RateLimit(50)
  @HttpCode(HttpStatus.CREATED)
  async submitApplication(@Body() data: ExternalApplicationDto) {
    return this.integrationService.submitExternalApplication(data);
  }

  /**
   * Get application status
   */
  @Get('applications/:id/status')
  @ApiScopes(ApiScope.READ_APPLICATIONS)
  @RateLimit(100)
  async getApplicationStatus(@Param('id') id: string) {
    return this.integrationService.getApplicationStatus(id);
  }

  /**
   * Import single candidate
   */
  @Post('candidates')
  @ApiScopes(ApiScope.WRITE_CANDIDATES)
  @RateLimit(50)
  @HttpCode(HttpStatus.CREATED)
  async importCandidate(
    @Body() data: ExternalCandidateDto,
    @Request() req: any,
  ) {
    return this.integrationService.importCandidate(data, req.user.id);
  }

  /**
   * Bulk import candidates
   */
  @Post('candidates/bulk')
  @ApiScopes(ApiScope.WRITE_CANDIDATES)
  @RateLimit(10) // Lower rate limit for bulk operations
  @HttpCode(HttpStatus.CREATED)
  async bulkImportCandidates(@Body() data: BulkImportDto, @Request() req: any) {
    return this.integrationService.bulkImportCandidates(data, req.user.id);
  }
}

/**
 * Public API Documentation Endpoint
 */
@Controller('api/v1/docs')
export class ApiDocsController {
  @Get()
  getApiDocumentation() {
    return {
      version: '1.0.0',
      title: 'ATS Integration API',
      description: 'External API for integrating with the ATS platform',
      baseUrl: '/api/v1',
      authentication: {
        type: 'API Key',
        header: 'X-API-Key',
        alternativeHeader: 'Authorization: Bearer <api_key>',
      },
      rateLimiting: {
        description: 'Rate limits are applied per API key',
        headers: {
          'X-RateLimit-Limit': 'Maximum requests per minute',
          'X-RateLimit-Remaining': 'Remaining requests in current window',
          'X-RateLimit-Reset': 'Time when the rate limit resets',
        },
      },
      endpoints: [
        {
          method: 'GET',
          path: '/health',
          description: 'Health check endpoint',
          authentication: 'Required',
          rateLimit: '1000/min',
        },
        {
          method: 'GET',
          path: '/jobs',
          description: 'List active job postings',
          authentication: 'Required',
          scopes: ['read:jobs'],
          rateLimit: '100/min',
          parameters: {
            limit: 'Number of results (default: 50)',
            offset: 'Pagination offset',
            location: 'Filter by location',
          },
        },
        {
          method: 'GET',
          path: '/jobs/:id',
          description: 'Get job details',
          authentication: 'Required',
          scopes: ['read:jobs'],
          rateLimit: '100/min',
        },
        {
          method: 'POST',
          path: '/applications',
          description: 'Submit a job application',
          authentication: 'Required',
          scopes: ['write:applications'],
          rateLimit: '50/min',
          body: {
            jobId: 'UUID of the job',
            candidateEmail: 'Candidate email address',
            candidateName: 'Candidate full name',
            resumeUrl: 'URL to resume (optional)',
            coverLetter: 'Cover letter text (optional)',
            source: 'Application source (optional)',
          },
        },
        {
          method: 'GET',
          path: '/applications/:id/status',
          description: 'Get application status',
          authentication: 'Required',
          scopes: ['read:applications'],
          rateLimit: '100/min',
        },
        {
          method: 'POST',
          path: '/candidates',
          description: 'Import a candidate',
          authentication: 'Required',
          scopes: ['write:candidates'],
          rateLimit: '50/min',
        },
        {
          method: 'POST',
          path: '/candidates/bulk',
          description: 'Bulk import candidates',
          authentication: 'Required',
          scopes: ['write:candidates'],
          rateLimit: '10/min',
        },
      ],
      scopes: [
        { scope: 'read:jobs', description: 'Read job postings' },
        { scope: 'write:jobs', description: 'Create and update job postings' },
        { scope: 'read:candidates', description: 'Read candidate information' },
        {
          scope: 'write:candidates',
          description: 'Create and update candidates',
        },
        { scope: 'read:applications', description: 'Read applications' },
        { scope: 'write:applications', description: 'Submit applications' },
        { scope: 'read:interviews', description: 'Read interview information' },
        { scope: 'write:interviews', description: 'Schedule interviews' },
        { scope: 'read:analytics', description: 'Read analytics data' },
        { scope: 'webhooks', description: 'Manage webhooks' },
        { scope: 'admin', description: 'Full administrative access' },
      ],
      errors: {
        400: 'Bad Request - Invalid input',
        401: 'Unauthorized - Invalid or missing API key',
        403: 'Forbidden - Insufficient scopes',
        404: 'Not Found - Resource not found',
        409: 'Conflict - Resource already exists',
        429: 'Too Many Requests - Rate limit exceeded',
        500: 'Internal Server Error',
      },
    };
  }
}
