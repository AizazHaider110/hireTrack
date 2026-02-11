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
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SearchService } from './search.service';
import {
  SearchDto,
  AdvancedSearchDto,
  CreateSavedSearchDto,
  UpdateSavedSearchDto,
  SearchResults,
  SavedSearch,
  SearchEntityType,
  SearchSortField,
  SortOrder,
} from '../common/dto/search.dto';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(
    @Query('query') query: string,
    @Query('entityType') entityType: SearchEntityType,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('sortBy') sortBy: SearchSortField,
    @Query('sortOrder') sortOrder: SortOrder,
    @Query('highlightResults') highlightResults: string,
    @Request() req: any,
  ): Promise<SearchResults> {
    const searchDto: SearchDto = {
      query,
      entityType: entityType || SearchEntityType.ALL,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      sortBy: sortBy || SearchSortField.RELEVANCE,
      sortOrder: sortOrder || SortOrder.DESC,
      highlightResults: highlightResults !== 'false',
    };
    return this.searchService.search(searchDto, req.user.id);
  }

  @Post('advanced')
  @HttpCode(HttpStatus.OK)
  async advancedSearch(
    @Body() dto: AdvancedSearchDto,
    @Request() req: any,
  ): Promise<SearchResults> {
    return this.searchService.advancedSearch(dto, req.user.id);
  }

  @Get('candidates')
  async searchCandidates(
    @Query('query') query: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('sortBy') sortBy: SearchSortField,
    @Query('sortOrder') sortOrder: SortOrder,
    @Request() req: any,
  ): Promise<SearchResults> {
    const searchDto: SearchDto = {
      query,
      entityType: SearchEntityType.CANDIDATE,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      sortBy: sortBy || SearchSortField.RELEVANCE,
      sortOrder: sortOrder || SortOrder.DESC,
      highlightResults: true,
    };
    return this.searchService.search(searchDto, req.user.id);
  }

  @Get('jobs')
  async searchJobs(
    @Query('query') query: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('sortBy') sortBy: SearchSortField,
    @Query('sortOrder') sortOrder: SortOrder,
    @Request() req: any,
  ): Promise<SearchResults> {
    const searchDto: SearchDto = {
      query,
      entityType: SearchEntityType.JOB,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      sortBy: sortBy || SearchSortField.RELEVANCE,
      sortOrder: sortOrder || SortOrder.DESC,
      highlightResults: true,
    };
    return this.searchService.search(searchDto, req.user.id);
  }

  @Get('applications')
  async searchApplications(
    @Query('query') query: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('sortBy') sortBy: SearchSortField,
    @Query('sortOrder') sortOrder: SortOrder,
    @Request() req: any,
  ): Promise<SearchResults> {
    const searchDto: SearchDto = {
      query,
      entityType: SearchEntityType.APPLICATION,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      sortBy: sortBy || SearchSortField.RELEVANCE,
      sortOrder: sortOrder || SortOrder.DESC,
      highlightResults: true,
    };
    return this.searchService.search(searchDto, req.user.id);
  }

  @Post('saved')
  async createSavedSearch(
    @Body() dto: CreateSavedSearchDto,
    @Request() req: any,
  ): Promise<SavedSearch> {
    return this.searchService.createSavedSearch(req.user.id, dto);
  }

  @Get('saved')
  async getSavedSearches(
    @Query('includeShared') includeShared: string,
    @Request() req: any,
  ): Promise<SavedSearch[]> {
    return this.searchService.getSavedSearches(
      req.user.id,
      includeShared !== 'false',
    );
  }

  @Get('saved/:id')
  async getSavedSearchById(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ): Promise<SavedSearch> {
    return this.searchService.getSavedSearchById(id, req.user.id);
  }

  @Put('saved/:id')
  async updateSavedSearch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSavedSearchDto,
    @Request() req: any,
  ): Promise<SavedSearch> {
    return this.searchService.updateSavedSearch(id, req.user.id, dto);
  }

  @Delete('saved/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSavedSearch(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ): Promise<void> {
    return this.searchService.deleteSavedSearch(id, req.user.id);
  }

  @Post('saved/:id/execute')
  @HttpCode(HttpStatus.OK)
  async executeSavedSearch(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Request() req: any,
  ): Promise<SearchResults> {
    return this.searchService.executeSavedSearch(
      id,
      req.user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
