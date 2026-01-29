import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import {
  CreateTeamDto,
  UpdateTeamDto,
  AddTeamMemberDto,
  UpdateTeamMemberRoleDto,
} from '../common/dto/team.dto';
import { Role, TeamRole } from '@prisma/client';

// Permission definitions for team roles
const TEAM_PERMISSIONS = {
  [TeamRole.TEAM_LEAD]: [
    'team.manage',
    'team.members.add',
    'team.members.remove',
    'team.members.update',
    'job.assign',
    'job.view',
    'candidate.view',
    'candidate.evaluate',
    'interview.schedule',
    'interview.feedback',
    'activity.view',
  ],
  [TeamRole.RECRUITER]: [
    'job.view',
    'candidate.view',
    'candidate.evaluate',
    'interview.schedule',
    'interview.feedback',
    'activity.view',
  ],
  [TeamRole.INTERVIEWER]: [
    'job.view',
    'candidate.view',
    'interview.feedback',
    'activity.view',
  ],
  [TeamRole.VIEWER]: ['job.view', 'candidate.view', 'activity.view'],
};

export interface TeamActivity {
  id: string;
  teamId: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId: string;
  details?: Record<string, any>;
  timestamp: Date;
}

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  /**
   * Create a new team
   */
  async createTeam(
    userId: string,
    userRole: Role,
    createTeamDto: CreateTeamDto,
  ) {
    const allowedRoles: Role[] = [
      Role.ADMIN,
      Role.RECRUITER,
      Role.HIRING_MANAGER,
    ];
    if (!allowedRoles.includes(userRole)) {
      throw new ForbiddenException(
        'You do not have permission to create teams',
      );
    }

    const team = await this.prisma.team.create({
      data: {
        name: createTeamDto.name,
        description: createTeamDto.description,
        members: {
          create: {
            userId,
            role: TeamRole.TEAM_LEAD,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
        jobs: {
          select: { id: true, title: true, isActive: true },
        },
      },
    });

    this.eventBus.publish('team.created', {
      teamId: team.id,
      name: team.name,
      createdBy: userId,
    });

    return team;
  }

  /**
   * Get team by ID
   */
  async getTeam(teamId: string, userId: string, userRole: Role) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
        jobs: {
          select: {
            id: true,
            title: true,
            isActive: true,
            _count: { select: { applications: true } },
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const isMember = team.members.some((m) => m.userId === userId);
    if (!isMember && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You do not have access to this team');
    }

    return team;
  }

  /**
   * Get all teams for a user
   */
  async getUserTeams(userId: string, userRole: Role) {
    if (userRole === Role.ADMIN) {
      return this.prisma.team.findMany({
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, role: true },
              },
            },
          },
          jobs: {
            select: { id: true, title: true, isActive: true },
          },
          _count: { select: { members: true, jobs: true } },
        },
      });
    }

    return this.prisma.team.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
        jobs: {
          select: { id: true, title: true, isActive: true },
        },
        _count: { select: { members: true, jobs: true } },
      },
    });
  }

  /**
   * Update team details
   */
  async updateTeam(
    teamId: string,
    userId: string,
    userRole: Role,
    updateTeamDto: UpdateTeamDto,
  ) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const membership = team.members.find((m) => m.userId === userId);
    if (!membership && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You do not have access to this team');
    }

    if (
      membership &&
      membership.role !== TeamRole.TEAM_LEAD &&
      userRole !== Role.ADMIN
    ) {
      throw new ForbiddenException('Only team leads can update team details');
    }

    return this.prisma.team.update({
      where: { id: teamId },
      data: updateTeamDto,
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
        jobs: {
          select: { id: true, title: true, isActive: true },
        },
      },
    });
  }

  /**
   * Delete a team
   */
  async deleteTeam(teamId: string, userId: string, userRole: Role) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true, jobs: true },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const membership = team.members.find((m) => m.userId === userId);
    if (
      userRole !== Role.ADMIN &&
      (!membership || membership.role !== TeamRole.TEAM_LEAD)
    ) {
      throw new ForbiddenException(
        'Only admins or team leads can delete teams',
      );
    }

    await this.prisma.jobPosting.updateMany({
      where: { teamId },
      data: { teamId: null },
    });

    await this.prisma.teamMember.deleteMany({ where: { teamId } });
    await this.prisma.team.delete({ where: { id: teamId } });

    return { success: true, message: 'Team deleted successfully' };
  }

  /**
   * Add a member to a team
   */
  async addTeamMember(
    teamId: string,
    userId: string,
    userRole: Role,
    addMemberDto: AddTeamMemberDto,
  ) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    await this.checkTeamPermission(
      teamId,
      userId,
      userRole,
      'team.members.add',
    );

    const userToAdd = await this.prisma.user.findUnique({
      where: { id: addMemberDto.userId },
    });

    if (!userToAdd) {
      throw new NotFoundException('User not found');
    }

    const existingMember = team.members.find(
      (m) => m.userId === addMemberDto.userId,
    );
    if (existingMember) {
      throw new ConflictException('User is already a member of this team');
    }

    const member = await this.prisma.teamMember.create({
      data: {
        teamId,
        userId: addMemberDto.userId,
        role: addMemberDto.role,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
        team: {
          select: { id: true, name: true },
        },
      },
    });

    this.eventBus.publish('team.member_added', {
      teamId,
      userId: addMemberDto.userId,
      role: addMemberDto.role,
      addedBy: userId,
    });

    return member;
  }

  /**
   * Remove a member from a team
   */
  async removeTeamMember(
    teamId: string,
    memberUserId: string,
    userId: string,
    userRole: Role,
  ) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    await this.checkTeamPermission(
      teamId,
      userId,
      userRole,
      'team.members.remove',
    );

    const memberToRemove = team.members.find((m) => m.userId === memberUserId);
    if (!memberToRemove) {
      throw new NotFoundException('Member not found in this team');
    }

    if (memberToRemove.role === TeamRole.TEAM_LEAD) {
      const teamLeadCount = team.members.filter(
        (m) => m.role === TeamRole.TEAM_LEAD,
      ).length;
      if (teamLeadCount <= 1) {
        throw new BadRequestException('Cannot remove the last team lead');
      }
    }

    await this.prisma.teamMember.delete({ where: { id: memberToRemove.id } });

    this.eventBus.publish('team.member_removed', {
      teamId,
      userId: memberUserId,
      removedBy: userId,
    });

    return { success: true, message: 'Member removed from team' };
  }

  /**
   * Update a team member's role
   */
  async updateTeamMemberRole(
    teamId: string,
    memberUserId: string,
    userId: string,
    userRole: Role,
    updateRoleDto: UpdateTeamMemberRoleDto,
  ) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    await this.checkTeamPermission(
      teamId,
      userId,
      userRole,
      'team.members.update',
    );

    const memberToUpdate = team.members.find((m) => m.userId === memberUserId);
    if (!memberToUpdate) {
      throw new NotFoundException('Member not found in this team');
    }

    if (
      memberToUpdate.role === TeamRole.TEAM_LEAD &&
      updateRoleDto.role !== TeamRole.TEAM_LEAD
    ) {
      const teamLeadCount = team.members.filter(
        (m) => m.role === TeamRole.TEAM_LEAD,
      ).length;
      if (teamLeadCount <= 1) {
        throw new BadRequestException('Cannot demote the last team lead');
      }
    }

    return this.prisma.teamMember.update({
      where: { id: memberToUpdate.id },
      data: { role: updateRoleDto.role },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
        team: {
          select: { id: true, name: true },
        },
      },
    });
  }

  /**
   * Assign a job to a team
   */
  async assignJobToTeam(
    teamId: string,
    jobId: string,
    userId: string,
    userRole: Role,
  ) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    await this.checkTeamPermission(teamId, userId, userRole, 'job.assign');

    const job = await this.prisma.jobPosting.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.userId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException(
        'You can only assign your own jobs to teams',
      );
    }

    return this.prisma.jobPosting.update({
      where: { id: jobId },
      data: { teamId },
      include: {
        team: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Unassign a job from a team
   */
  async unassignJobFromTeam(
    teamId: string,
    jobId: string,
    userId: string,
    userRole: Role,
  ) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    await this.checkTeamPermission(teamId, userId, userRole, 'job.assign');

    const job = await this.prisma.jobPosting.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.teamId !== teamId) {
      throw new BadRequestException('Job is not assigned to this team');
    }

    return this.prisma.jobPosting.update({
      where: { id: jobId },
      data: { teamId: null },
    });
  }

  /**
   * Get team activity feed
   */
  async getTeamActivity(
    teamId: string,
    userId: string,
    userRole: Role,
    options?: { startDate?: Date; endDate?: Date; limit?: number },
  ): Promise<TeamActivity[]> {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: true,
        jobs: { select: { id: true } },
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    await this.checkTeamPermission(teamId, userId, userRole, 'activity.view');

    const memberIds = team.members.map((m) => m.userId);
    const jobIds = team.jobs.map((j) => j.id);

    const dateFilter: any = {};
    if (options?.startDate) {
      dateFilter.gte = options.startDate;
    }
    if (options?.endDate) {
      dateFilter.lte = options.endDate;
    }

    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { userId: { in: memberIds } },
          { AND: [{ resource: 'JobPosting' }, { resourceId: { in: jobIds } }] },
          { AND: [{ resource: 'Team' }, { resourceId: teamId }] },
        ],
        ...(Object.keys(dateFilter).length > 0 && { timestamp: dateFilter }),
      },
      include: {
        user: { select: { name: true } },
      },
      orderBy: { timestamp: 'desc' },
      take: options?.limit || 50,
    });

    return auditLogs.map((log) => ({
      id: log.id,
      teamId,
      userId: log.userId,
      userName: log.user.name,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      details: log.metadata as Record<string, any> | undefined,
      timestamp: log.timestamp,
    }));
  }

  /**
   * Get team permissions for a user
   */
  async getTeamPermissions(
    teamId: string,
    targetUserId: string,
    userId: string,
    userRole: Role,
  ): Promise<string[]> {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const requestingMember = team.members.find((m) => m.userId === userId);
    if (!requestingMember && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You do not have access to this team');
    }

    if (userRole === Role.ADMIN) {
      return TEAM_PERMISSIONS[TeamRole.TEAM_LEAD];
    }

    const targetMember = team.members.find((m) => m.userId === targetUserId);
    if (!targetMember) {
      return [];
    }

    return TEAM_PERMISSIONS[targetMember.role] || [];
  }

  /**
   * Check if a user has a specific permission in a team
   */
  async checkTeamPermission(
    teamId: string,
    userId: string,
    userRole: Role,
    permission: string,
  ): Promise<boolean> {
    if (userRole === Role.ADMIN) {
      return true;
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const membership = team.members.find((m) => m.userId === userId);
    if (!membership) {
      throw new ForbiddenException('You are not a member of this team');
    }

    const permissions = TEAM_PERMISSIONS[membership.role] || [];
    if (!permissions.includes(permission)) {
      throw new ForbiddenException(
        `You do not have permission to perform this action: ${permission}`,
      );
    }

    return true;
  }

  /**
   * Get team jobs with candidates
   */
  async getTeamJobs(teamId: string, userId: string, userRole: Role) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    await this.checkTeamPermission(teamId, userId, userRole, 'job.view');

    return this.prisma.jobPosting.findMany({
      where: { teamId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { applications: true } },
        pipeline: {
          include: {
            stages: {
              orderBy: { order: 'asc' },
              include: { _count: { select: { candidates: true } } },
            },
          },
        },
      },
    });
  }

  /**
   * Get team candidates (candidates who applied to team jobs)
   */
  async getTeamCandidates(teamId: string, userId: string, userRole: Role) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { jobs: { select: { id: true } } },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    await this.checkTeamPermission(teamId, userId, userRole, 'candidate.view');

    const jobIds = team.jobs.map((j) => j.id);

    return this.prisma.application.findMany({
      where: { jobId: { in: jobIds } },
      include: {
        candidate: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        job: { select: { id: true, title: true } },
      },
      orderBy: { appliedAt: 'desc' },
    });
  }

  /**
   * Notify team members of an activity
   */
  async notifyTeamMembers(
    teamId: string,
    excludeUserId: string,
    notification: {
      type: string;
      title: string;
      message: string;
      resourceType?: string;
      resourceId?: string;
    },
  ): Promise<void> {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: { select: { id: true, email: true, name: true } },
          },
        },
      },
    });

    if (!team) {
      return;
    }

    for (const member of team.members) {
      if (member.userId !== excludeUserId) {
        this.eventBus.publish('team.notification', {
          teamId,
          userId: member.userId,
          userEmail: member.user.email,
          userName: member.user.name,
          ...notification,
          timestamp: new Date().toISOString(),
        });
      }
    }

    this.logger.log(
      `Notified ${team.members.length - 1} team members about: ${notification.type}`,
    );
  }

  /**
   * Get shared workspace data for a team
   */
  async getSharedWorkspace(teamId: string, userId: string, userRole: Role) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        jobs: { select: { id: true } },
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const isMember = team.members.some((m) => m.userId === userId);
    if (!isMember && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You do not have access to this team');
    }

    const jobIds = team.jobs.map((j) => j.id);

    const jobs = await this.prisma.jobPosting.findMany({
      where: { teamId },
      include: {
        user: { select: { id: true, name: true } },
        _count: { select: { applications: true } },
        pipeline: {
          include: {
            stages: {
              orderBy: { order: 'asc' },
              include: { _count: { select: { candidates: true } } },
            },
          },
        },
      },
    });

    const recentApplications = await this.prisma.application.findMany({
      where: { jobId: { in: jobIds } },
      include: {
        candidate: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        job: { select: { id: true, title: true } },
      },
      orderBy: { appliedAt: 'desc' },
      take: 20,
    });

    const upcomingInterviews = await this.prisma.interview.findMany({
      where: {
        jobId: { in: jobIds },
        scheduledAt: { gte: new Date() },
        status: 'SCHEDULED',
      },
      include: {
        candidate: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        interviewers: true,
      },
      orderBy: { scheduledAt: 'asc' },
      take: 10,
    });

    const memberIds = team.members.map((m) => m.userId);
    const recentActivity = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { userId: { in: memberIds } },
          { AND: [{ resource: 'JobPosting' }, { resourceId: { in: jobIds } }] },
        ],
      },
      include: { user: { select: { name: true } } },
      orderBy: { timestamp: 'desc' },
      take: 20,
    });

    const stats = {
      totalJobs: jobs.length,
      activeJobs: jobs.filter((j) => j.isActive).length,
      totalApplications: jobs.reduce(
        (sum, j) => sum + j._count.applications,
        0,
      ),
      totalMembers: team.members.length,
      upcomingInterviews: upcomingInterviews.length,
    };

    return {
      team: {
        id: team.id,
        name: team.name,
        description: team.description,
        members: team.members,
      },
      jobs,
      recentApplications,
      upcomingInterviews,
      recentActivity: recentActivity.map((log) => ({
        id: log.id,
        userId: log.userId,
        userName: log.user.name,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        timestamp: log.timestamp,
      })),
      stats,
    };
  }

  /**
   * Get team member's assigned candidates
   */
  async getMemberAssignedCandidates(
    teamId: string,
    memberUserId: string,
    userId: string,
    userRole: Role,
  ) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: true,
        jobs: { select: { id: true } },
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const isMember = team.members.some((m) => m.userId === userId);
    if (!isMember && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You do not have access to this team');
    }

    const jobIds = team.jobs.map((j) => j.id);

    const interviews = await this.prisma.interview.findMany({
      where: {
        jobId: { in: jobIds },
        interviewers: { some: { userId: memberUserId } },
      },
      include: {
        candidate: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    const candidateMap = new Map();
    for (const interview of interviews) {
      if (!candidateMap.has(interview.candidateId)) {
        candidateMap.set(interview.candidateId, interview.candidate);
      }
    }

    return Array.from(candidateMap.values());
  }

  /**
   * Check if user has access to a job through team membership
   */
  async hasJobAccess(
    jobId: string,
    userId: string,
    userRole: Role,
  ): Promise<boolean> {
    if (userRole === Role.ADMIN) {
      return true;
    }

    const job = await this.prisma.jobPosting.findUnique({
      where: { id: jobId },
      include: {
        team: { include: { members: true } },
      },
    });

    if (!job) {
      return false;
    }

    if (job.userId === userId) {
      return true;
    }

    if (job.team) {
      return job.team.members.some((m) => m.userId === userId);
    }

    return false;
  }

  /**
   * Check if user has access to a candidate through team membership
   */
  async hasCandidateAccess(
    candidateId: string,
    userId: string,
    userRole: Role,
  ): Promise<boolean> {
    if (userRole === Role.ADMIN) {
      return true;
    }

    const applications = await this.prisma.application.findMany({
      where: { candidateId },
      include: {
        job: {
          include: {
            team: { include: { members: true } },
          },
        },
      },
    });

    for (const application of applications) {
      if (application.job.userId === userId) {
        return true;
      }
      if (application.job.team) {
        if (application.job.team.members.some((m) => m.userId === userId)) {
          return true;
        }
      }
    }

    return false;
  }
}
