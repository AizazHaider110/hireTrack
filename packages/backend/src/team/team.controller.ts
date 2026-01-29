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
import { TeamService } from './team.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import {
  CreateTeamDto,
  UpdateTeamDto,
  AddTeamMemberDto,
  UpdateTeamMemberRoleDto,
  AssignJobToTeamDto,
  TeamActivityQueryDto,
} from '../common/dto/team.dto';

@Controller('teams')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  /**
   * Create a new team
   */
  @Post()
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async createTeam(@Request() req, @Body() createTeamDto: CreateTeamDto) {
    return this.teamService.createTeam(
      req.user.id,
      req.user.role,
      createTeamDto,
    );
  }

  /**
   * Get all teams for the current user
   */
  @Get()
  async getUserTeams(@Request() req) {
    return this.teamService.getUserTeams(req.user.id, req.user.role);
  }

  /**
   * Get a specific team by ID
   */
  @Get(':id')
  async getTeam(@Request() req, @Param('id') teamId: string) {
    return this.teamService.getTeam(teamId, req.user.id, req.user.role);
  }

  /**
   * Update team details
   */
  @Put(':id')
  async updateTeam(
    @Request() req,
    @Param('id') teamId: string,
    @Body() updateTeamDto: UpdateTeamDto,
  ) {
    return this.teamService.updateTeam(
      teamId,
      req.user.id,
      req.user.role,
      updateTeamDto,
    );
  }

  /**
   * Delete a team
   */
  @Delete(':id')
  async deleteTeam(@Request() req, @Param('id') teamId: string) {
    return this.teamService.deleteTeam(teamId, req.user.id, req.user.role);
  }

  /**
   * Add a member to a team
   */
  @Post(':id/members')
  async addTeamMember(
    @Request() req,
    @Param('id') teamId: string,
    @Body() addMemberDto: AddTeamMemberDto,
  ) {
    return this.teamService.addTeamMember(
      teamId,
      req.user.id,
      req.user.role,
      addMemberDto,
    );
  }

  /**
   * Remove a member from a team
   */
  @Delete(':id/members/:userId')
  async removeTeamMember(
    @Request() req,
    @Param('id') teamId: string,
    @Param('userId') memberUserId: string,
  ) {
    return this.teamService.removeTeamMember(
      teamId,
      memberUserId,
      req.user.id,
      req.user.role,
    );
  }

  /**
   * Update a team member's role
   */
  @Put(':id/members/:userId/role')
  async updateTeamMemberRole(
    @Request() req,
    @Param('id') teamId: string,
    @Param('userId') memberUserId: string,
    @Body() updateRoleDto: UpdateTeamMemberRoleDto,
  ) {
    return this.teamService.updateTeamMemberRole(
      teamId,
      memberUserId,
      req.user.id,
      req.user.role,
      updateRoleDto,
    );
  }

  /**
   * Assign a job to a team
   */
  @Post(':id/jobs')
  async assignJobToTeam(
    @Request() req,
    @Param('id') teamId: string,
    @Body() assignJobDto: AssignJobToTeamDto,
  ) {
    return this.teamService.assignJobToTeam(
      teamId,
      assignJobDto.jobId,
      req.user.id,
      req.user.role,
    );
  }

  /**
   * Unassign a job from a team
   */
  @Delete(':id/jobs/:jobId')
  async unassignJobFromTeam(
    @Request() req,
    @Param('id') teamId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.teamService.unassignJobFromTeam(
      teamId,
      jobId,
      req.user.id,
      req.user.role,
    );
  }

  /**
   * Get team activity feed
   */
  @Get(':id/activity')
  async getTeamActivity(
    @Request() req,
    @Param('id') teamId: string,
    @Query() query: TeamActivityQueryDto,
  ) {
    const options: { startDate?: Date; endDate?: Date; limit?: number } = {};

    if (query.startDate) {
      options.startDate = new Date(query.startDate);
    }
    if (query.endDate) {
      options.endDate = new Date(query.endDate);
    }
    if (query.limit) {
      options.limit = parseInt(query.limit, 10);
    }

    return this.teamService.getTeamActivity(
      teamId,
      req.user.id,
      req.user.role,
      options,
    );
  }

  /**
   * Get team permissions for a user
   */
  @Get(':id/permissions/:userId')
  async getTeamPermissions(
    @Request() req,
    @Param('id') teamId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.teamService.getTeamPermissions(
      teamId,
      targetUserId,
      req.user.id,
      req.user.role,
    );
  }

  /**
   * Get team jobs
   */
  @Get(':id/jobs')
  async getTeamJobs(@Request() req, @Param('id') teamId: string) {
    return this.teamService.getTeamJobs(teamId, req.user.id, req.user.role);
  }

  /**
   * Get team candidates
   */
  @Get(':id/candidates')
  async getTeamCandidates(@Request() req, @Param('id') teamId: string) {
    return this.teamService.getTeamCandidates(
      teamId,
      req.user.id,
      req.user.role,
    );
  }

  /**
   * Get shared workspace data for a team
   */
  @Get(':id/workspace')
  async getSharedWorkspace(@Request() req, @Param('id') teamId: string) {
    return this.teamService.getSharedWorkspace(
      teamId,
      req.user.id,
      req.user.role,
    );
  }

  /**
   * Get assigned candidates for a team member
   */
  @Get(':id/members/:userId/candidates')
  async getMemberAssignedCandidates(
    @Request() req,
    @Param('id') teamId: string,
    @Param('userId') memberUserId: string,
  ) {
    return this.teamService.getMemberAssignedCandidates(
      teamId,
      memberUserId,
      req.user.id,
      req.user.role,
    );
  }
}
