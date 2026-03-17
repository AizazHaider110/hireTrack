import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import {
  CreatePipelineDto,
  UpdatePipelineStagesDto,
  MoveCandidateDto,
  BulkMoveCandidatesDto,
  UpdateCandidatePositionDto,
  AddCandidateToPipelineDto,
  RemoveCandidateFromPipelineDto,
} from '../common/dto/pipeline.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('pipelines')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Post()
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN)
  async createPipeline(
    @Body() createPipelineDto: CreatePipelineDto,
    @Req() req: any,
  ) {
    return this.pipelineService.createPipeline(
      req.user.id,
      req.user.role,
      createPipelineDto,
    );
  }

  @Put(':id/stages')
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN)
  async updatePipelineStages(
    @Param('id') id: string,
    @Body() updateStagesDto: UpdatePipelineStagesDto,
    @Req() req: any,
  ) {
    return this.pipelineService.updatePipelineStages(
      id,
      req.user.id,
      req.user.role,
      updateStagesDto,
    );
  }

  @Post('candidates/move')
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN)
  async moveCandidateToStage(
    @Body() moveCandidateDto: MoveCandidateDto,
    @Req() req: any,
  ) {
    return this.pipelineService.moveCandidateToStage(
      req.user.id,
      req.user.role,
      moveCandidateDto,
    );
  }

  @Post('candidates/bulk-move')
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN)
  async bulkMoveCandidates(
    @Body() bulkMoveDto: BulkMoveCandidatesDto,
    @Req() req: any,
  ) {
    return this.pipelineService.bulkMoveCandidates(
      req.user.id,
      req.user.role,
      bulkMoveDto,
    );
  }

  @Get('job/:jobId')
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN)
  async getPipelineByJob(@Param('jobId') jobId: string, @Req() req: any) {
    return this.pipelineService.getPipelineByJob(
      jobId,
      req.user.id,
      req.user.role,
    );
  }

  @Get('candidates/:candidateId/history')
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN)
  async getStageTransitionHistory(
    @Param('candidateId') candidateId: string,
    @Req() req: any,
  ) {
    return this.pipelineService.getStageTransitionHistory(
      candidateId,
      req.user.id,
      req.user.role,
    );
  }

  @Get('candidates/:candidateId/card/:jobId')
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN)
  async getCandidateCard(
    @Param('candidateId') candidateId: string,
    @Param('jobId') jobId: string,
    @Req() req: any,
  ) {
    return this.pipelineService.getCandidateCard(
      candidateId,
      jobId,
      req.user.id,
      req.user.role,
    );
  }

  @Put('candidates/:candidateId/position')
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN)
  async updateCandidateCardPosition(
    @Param('candidateId') candidateId: string,
    @Body() updatePositionDto: UpdateCandidatePositionDto,
    @Req() req: any,
  ) {
    return this.pipelineService.updateCandidateCardPosition(
      candidateId,
      updatePositionDto.stageId,
      updatePositionDto.position,
      req.user.id,
      req.user.role,
    );
  }

  @Post('candidates/:candidateId/add')
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN)
  async addCandidateToPipeline(
    @Param('candidateId') candidateId: string,
    @Body() addCandidateDto: AddCandidateToPipelineDto,
    @Req() req: any,
  ) {
    return this.pipelineService.addCandidateToPipeline(
      candidateId,
      addCandidateDto.jobId,
      addCandidateDto.stageId,
      req.user.id,
      req.user.role,
    );
  }

  @Delete('candidates/:candidateId/remove/:jobId')
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN)
  async removeCandidateFromPipeline(
    @Param('candidateId') candidateId: string,
    @Param('jobId') jobId: string,
    @Body() removeDto: RemoveCandidateFromPipelineDto,
    @Req() req: any,
  ) {
    return this.pipelineService.removeCandidateFromPipeline(
      candidateId,
      jobId,
      req.user.id,
      req.user.role,
      removeDto.reason,
    );
  }
}
