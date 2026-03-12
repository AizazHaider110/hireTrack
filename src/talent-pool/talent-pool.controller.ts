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
  Request,
} from '@nestjs/common';
import { TalentPoolService } from './talent-pool.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import {
  AddToTalentPoolDto,
  UpdateTalentPoolEntryDto,
  TalentPoolSearchDto,
  RecordEngagementDto,
  BulkImportDto,
  SuggestCandidatesDto,
} from '../common/dto/talent-pool.dto';

@Controller('talent-pool')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TalentPoolController {
  constructor(private readonly talentPoolService: TalentPoolService) {}

  /**
   * Add a candidate to the talent pool
   */
  @Post()
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async addToPool(@Request() req, @Body() dto: AddToTalentPoolDto) {
    return this.talentPoolService.addCandidateToPool(req.user.id, dto);
  }

  /**
   * Get all talent pool entries with pagination
   */
  @Get()
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER, Role.INTERVIEWER)
  async getAllEntries(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.talentPoolService.getAllEntries(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /**
   * Search talent pool with advanced filters
   */
  @Post('search')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER, Role.INTERVIEWER)
  async searchTalentPool(@Body() dto: TalentPoolSearchDto) {
    return this.talentPoolService.searchTalentPool(dto);
  }

  /**
   * Get talent pool statistics
   */
  @Get('statistics')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async getStatistics() {
    return this.talentPoolService.getStatistics();
  }

  /**
   * Get all unique tags
   */
  @Get('tags')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER, Role.INTERVIEWER)
  async getAllTags() {
    return this.talentPoolService.getAllTags();
  }

  /**
   * Suggest candidates for a job
   */
  @Post('suggest')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async suggestCandidates(@Body() dto: SuggestCandidatesDto) {
    return this.talentPoolService.suggestCandidates(dto);
  }

  /**
   * Bulk import candidates
   */
  @Post('bulk-import')
  @Roles(Role.ADMIN, Role.RECRUITER)
  async bulkImport(@Request() req, @Body() dto: BulkImportDto) {
    return this.talentPoolService.bulkImportCandidates(
      req.user.id,
      dto.candidates,
    );
  }

  /**
   * Get a specific talent pool entry
   */
  @Get(':id')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER, Role.INTERVIEWER)
  async getEntry(@Param('id') id: string) {
    return this.talentPoolService.getEntry(id);
  }

  /**
   * Get talent pool entry by candidate ID
   */
  @Get('candidate/:candidateId')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER, Role.INTERVIEWER)
  async getEntryByCandidateId(@Param('candidateId') candidateId: string) {
    return this.talentPoolService.getEntryByCandidateId(candidateId);
  }

  /**
   * Update a talent pool entry
   */
  @Put(':id')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async updateEntry(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateTalentPoolEntryDto,
  ) {
    return this.talentPoolService.updateEntry(id, req.user.id, dto);
  }

  /**
   * Record engagement activity
   */
  @Post(':id/engagement')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async recordEngagement(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: RecordEngagementDto,
  ) {
    return this.talentPoolService.recordEngagement(id, req.user.id, dto);
  }

  /**
   * Add tags to an entry
   */
  @Post(':id/tags')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async addTags(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { tags: string[] },
  ) {
    return this.talentPoolService.addTags(id, body.tags, req.user.id);
  }

  /**
   * Remove tags from an entry
   */
  @Delete(':id/tags')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async removeTags(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { tags: string[] },
  ) {
    return this.talentPoolService.removeTags(id, body.tags, req.user.id);
  }

  /**
   * Remove a candidate from the talent pool
   */
  @Delete(':id')
  @Roles(Role.ADMIN, Role.RECRUITER)
  async removeFromPool(@Request() req, @Param('id') id: string) {
    await this.talentPoolService.removeFromPool(id, req.user.id);
    return { success: true, message: 'Candidate removed from talent pool' };
  }

  /**
   * Archive inactive candidates (admin only)
   */
  @Post('archive-inactive')
  @Roles(Role.ADMIN)
  async archiveInactive(@Body() body: { inactiveDays?: number }) {
    return this.talentPoolService.archiveInactiveCandidates(body.inactiveDays);
  }
}
