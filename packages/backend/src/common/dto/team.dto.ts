import { IsString, IsOptional, IsEnum, IsArray, IsUUID } from 'class-validator';
import { TeamRole } from '@prisma/client';

export class CreateTeamDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class AddTeamMemberDto {
  @IsUUID()
  userId: string;

  @IsEnum(TeamRole)
  role: TeamRole;
}

export class UpdateTeamMemberRoleDto {
  @IsEnum(TeamRole)
  role: TeamRole;
}

export class AssignJobToTeamDto {
  @IsUUID()
  jobId: string;
}

export class BulkAddTeamMembersDto {
  @IsArray()
  members: AddTeamMemberDto[];
}

export class TeamActivityQueryDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
