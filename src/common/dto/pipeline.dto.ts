import { IsString, IsOptional, IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePipelineDto {
  @IsString()
  @IsUUID()
  jobId: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StageTemplateDto)
  stages?: StageTemplateDto[];
}

export class StageTemplateDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(0)
  order: number;

  @IsOptional()
  @IsString()
  color?: string;
}

export class UpdateStageDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsString()
  color?: string;
}

export class MoveCandidateDto {
  @IsString()
  @IsUUID()
  candidateId: string;

  @IsString()
  @IsUUID()
  stageId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class BulkMoveCandidatesDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  candidateIds: string[];

  @IsString()
  @IsUUID()
  stageId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdatePipelineStagesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StageUpdateDto)
  stages: StageUpdateDto[];
}

export class StageUpdateDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  id?: string;

  @IsString()
  name: string;

  @IsInt()
  @Min(0)
  order: number;

  @IsOptional()
  @IsString()
  color?: string;
}

export class UpdateCandidatePositionDto {
  @IsString()
  @IsUUID()
  stageId: string;

  @IsInt()
  @Min(0)
  position: number;
}

export class AddCandidateToPipelineDto {
  @IsString()
  @IsUUID()
  jobId: string;

  @IsString()
  @IsUUID()
  stageId: string;
}

export class RemoveCandidateFromPipelineDto {
  @IsOptional()
  @IsString()
  reason?: string;
}