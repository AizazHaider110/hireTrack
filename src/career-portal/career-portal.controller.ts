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
  Req,
  UseInterceptors,
  Headers,
  Ip,
} from '@nestjs/common';
import { CareerPortalService } from './career-portal.service';
import {
  PublicJobSearchDto,
  PublicApplicationDto,
  CreateCareerPageDto,
  UpdateCareerPageDto,
} from '../common/dto/career-portal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { AuditInterceptor, Audit } from '../audit/audit.interceptor';

@Controller('career-portal')
export class CareerPortalController {
  constructor(private readonly careerPortalService: CareerPortalService) {}

  // ==================== PUBLIC ENDPOINTS ====================

  /**
   * Get public job listings with search and filtering
   * Public endpoint - no authentication required
   */
  @Get('jobs')
  async getPublicJobs(@Query() dto: PublicJobSearchDto) {
    return this.careerPortalService.getPublicJobs(dto);
  }

  /**
   * Get featured jobs for homepage
   * Public endpoint
   */
  @Get('jobs/featured')
  async getFeaturedJobs(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 5;
    return this.careerPortalService.getFeaturedJobs(limitNum);
  }

  /**
   * Get available job locations for filtering
   * Public endpoint
   */
  @Get('jobs/locations')
  async getJobLocations() {
    return this.careerPortalService.getJobLocations();
  }

  /**
   * Get job count by location
   * Public endpoint
   */
  @Get('jobs/locations/count')
  async getJobCountByLocation() {
    return this.careerPortalService.getJobCountByLocation();
  }

  /**
   * Get public job details by ID
   * Public endpoint
   */
  @Get('jobs/:id')
  async getJobDetails(
    @Param('id') id: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('referer') referrer?: string,
    @Ip() ipAddress?: string,
    @Query('source') source?: string,
  ) {
    // Track the view
    await this.careerPortalService.trackJobView({
      jobId: id,
      source,
      referrer,
      userAgent,
      ipAddress,
      timestamp: new Date(),
    });

    return this.careerPortalService.getJobDetails(id);
  }

  /**
   * Submit a public application
   * Public endpoint - no authentication required
   */
  @Post('jobs/:id/apply')
  async submitApplication(
    @Param('id') jobId: string,
    @Body() dto: PublicApplicationDto,
    @Query('source') source?: string,
  ) {
    return this.careerPortalService.submitApplication(jobId, {
      ...dto,
      source: dto.source || source || 'career_portal',
    });
  }

  /**
   * Get career page by slug
   * Public endpoint
   */
  @Get('pages/:slug')
  async getCareerPage(@Param('slug') slug: string) {
    return this.careerPortalService.getCareerPage(slug);
  }

  /**
   * Get jobs for a specific career page
   * Public endpoint
   */
  @Get('pages/:slug/jobs')
  async getJobsForCareerPage(
    @Param('slug') slug: string,
    @Query() dto: PublicJobSearchDto,
  ) {
    return this.careerPortalService.getJobsForCareerPage(slug, dto);
  }

  // ==================== ADMIN ENDPOINTS ====================

  /**
   * Get all career pages (admin)
   */
  @Get('admin/pages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.RECRUITER)
  async getAllCareerPages() {
    return this.careerPortalService.getAllCareerPages();
  }

  /**
   * Get career page by ID (admin)
   */
  @Get('admin/pages/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.RECRUITER)
  async getCareerPageById(@Param('id') id: string) {
    return this.careerPortalService.getCareerPageById(id);
  }

  /**
   * Create a new career page (admin)
   */
  @Post('admin/pages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.RECRUITER)
  @UseInterceptors(AuditInterceptor)
  @Audit('career_page', 'career_page.created')
  async createCareerPage(@Body() dto: CreateCareerPageDto) {
    return this.careerPortalService.createCareerPage(dto);
  }

  /**
   * Update a career page (admin)
   */
  @Put('admin/pages/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.RECRUITER)
  @UseInterceptors(AuditInterceptor)
  @Audit('career_page', 'career_page.updated')
  async updateCareerPage(
    @Param('id') id: string,
    @Body() dto: UpdateCareerPageDto,
  ) {
    return this.careerPortalService.updateCareerPage(id, dto);
  }

  /**
   * Delete a career page (admin)
   */
  @Delete('admin/pages/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(AuditInterceptor)
  @Audit('career_page', 'career_page.deleted')
  async deleteCareerPage(@Param('id') id: string) {
    await this.careerPortalService.deleteCareerPage(id);
    return { message: 'Career page deleted successfully' };
  }

  /**
   * Publish a career page (admin)
   */
  @Post('admin/pages/:id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.RECRUITER)
  @UseInterceptors(AuditInterceptor)
  @Audit('career_page', 'career_page.published')
  async publishCareerPage(@Param('id') id: string) {
    return this.careerPortalService.updateCareerPage(id, { isPublished: true });
  }

  /**
   * Unpublish a career page (admin)
   */
  @Post('admin/pages/:id/unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.RECRUITER)
  @UseInterceptors(AuditInterceptor)
  @Audit('career_page', 'career_page.unpublished')
  async unpublishCareerPage(@Param('id') id: string) {
    return this.careerPortalService.updateCareerPage(id, {
      isPublished: false,
    });
  }

  /**
   * Preview career page (admin) - returns page even if unpublished
   */
  @Get('admin/pages/:id/preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.RECRUITER)
  async previewCareerPage(@Param('id') id: string) {
    return this.careerPortalService.getCareerPageById(id);
  }

  /**
   * Duplicate a career page (admin)
   */
  @Post('admin/pages/:id/duplicate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.RECRUITER)
  @UseInterceptors(AuditInterceptor)
  @Audit('career_page', 'career_page.duplicated')
  async duplicateCareerPage(@Param('id') id: string) {
    return this.careerPortalService.duplicateCareerPage(id);
  }
}
