// Pipeline Types

export interface PipelineStage {
  id: string;
  name: string;
  order: number;
  color: string;
  candidateCount: number;
}

export interface Pipeline {
  id: string;
  jobId: string;
  name: string;
  stages: PipelineStage[];
  createdAt: string;
  updatedAt: string;
}

export interface MoveCandidateDto {
  candidateId: string;
  applicationId: string;
  fromStageId: string;
  toStageId: string;
  reason?: string;
}

export interface BulkMoveDto {
  applicationIds: string[];
  toStageId: string;
  reason?: string;
}

export interface StageTransition {
  id: string;
  applicationId: string;
  fromStageId: string;
  toStageId: string;
  reason?: string;
  movedBy: string;
  movedAt: string;
}
