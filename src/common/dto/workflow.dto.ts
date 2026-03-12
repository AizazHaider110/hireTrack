import {
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsArray,
  IsObject,
  ValidateNested,
  IsUUID,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WorkflowTrigger, ExecutionStatus } from '@prisma/client';

/**
 * Workflow action types
 */
export enum WorkflowActionType {
  SEND_EMAIL = 'SEND_EMAIL',
  UPDATE_STATUS = 'UPDATE_STATUS',
  MOVE_STAGE = 'MOVE_STAGE',
  CREATE_TASK = 'CREATE_TASK',
  NOTIFY_USER = 'NOTIFY_USER',
  TRIGGER_WEBHOOK = 'TRIGGER_WEBHOOK',
  SCHEDULE_INTERVIEW = 'SCHEDULE_INTERVIEW',
  CALCULATE_SCORE = 'CALCULATE_SCORE',
  ADD_TO_TALENT_POOL = 'ADD_TO_TALENT_POOL',
  REQUEST_APPROVAL = 'REQUEST_APPROVAL',
}

/**
 * Workflow condition operators
 */
export enum ConditionOperator {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  CONTAINS = 'CONTAINS',
  NOT_CONTAINS = 'NOT_CONTAINS',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  GREATER_THAN_OR_EQUALS = 'GREATER_THAN_OR_EQUALS',
  LESS_THAN_OR_EQUALS = 'LESS_THAN_OR_EQUALS',
  IS_EMPTY = 'IS_EMPTY',
  IS_NOT_EMPTY = 'IS_NOT_EMPTY',
  IN_LIST = 'IN_LIST',
  NOT_IN_LIST = 'NOT_IN_LIST',
}

/**
 * Workflow condition DTO
 */
export class WorkflowConditionDto {
  @IsString()
  field: string;

  @IsEnum(ConditionOperator)
  operator: ConditionOperator;

  @IsOptional()
  value?: any;
}

/**
 * Workflow action DTO
 */
export class WorkflowActionDto {
  @IsEnum(WorkflowActionType)
  type: WorkflowActionType;

  @IsObject()
  config: Record<string, any>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  stopOnFailure?: boolean;
}

/**
 * Create workflow rule DTO
 */
export class CreateWorkflowRuleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(WorkflowTrigger)
  trigger: WorkflowTrigger;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowConditionDto)
  conditions?: WorkflowConditionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowActionDto)
  actions: WorkflowActionDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priority?: number;
}

/**
 * Update workflow rule DTO
 */
export class UpdateWorkflowRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(WorkflowTrigger)
  trigger?: WorkflowTrigger;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowConditionDto)
  conditions?: WorkflowConditionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowActionDto)
  actions?: WorkflowActionDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priority?: number;
}

/**
 * Execute workflow DTO
 */
export class ExecuteWorkflowDto {
  @IsUUID()
  ruleId: string;

  @IsObject()
  input: Record<string, any>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * Workflow execution result
 */
export class WorkflowExecutionResultDto {
  @IsUUID()
  executionId: string;

  @IsEnum(ExecutionStatus)
  status: ExecutionStatus;

  @IsOptional()
  @IsObject()
  output?: Record<string, any>;

  @IsOptional()
  @IsString()
  error?: string;

  @IsOptional()
  @IsArray()
  actionResults?: ActionResultDto[];
}

/**
 * Action result DTO
 */
export class ActionResultDto {
  @IsEnum(WorkflowActionType)
  actionType: WorkflowActionType;

  @IsBoolean()
  success: boolean;

  @IsOptional()
  @IsObject()
  result?: Record<string, any>;

  @IsOptional()
  @IsString()
  error?: string;

  @IsNumber()
  executionTimeMs: number;
}

/**
 * Workflow filter DTO
 */
export class WorkflowFilterDto {
  @IsOptional()
  @IsEnum(WorkflowTrigger)
  trigger?: WorkflowTrigger;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

/**
 * Workflow execution filter DTO
 */
export class ExecutionFilterDto {
  @IsOptional()
  @IsUUID()
  ruleId?: string;

  @IsOptional()
  @IsEnum(ExecutionStatus)
  status?: ExecutionStatus;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

/**
 * Approval request DTO
 */
export class ApprovalRequestDto {
  @IsUUID()
  executionId: string;

  @IsBoolean()
  approved: boolean;

  @IsOptional()
  @IsString()
  comment?: string;
}

/**
 * Workflow statistics DTO
 */
export class WorkflowStatisticsDto {
  totalRules: number;
  activeRules: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  pendingExecutions: number;
  averageExecutionTimeMs: number;
  executionsByTrigger: Record<string, number>;
  executionsByStatus: Record<string, number>;
}

/**
 * Workflow builder node DTO (for visual builder)
 */
export class WorkflowBuilderNodeDto {
  @IsString()
  id: string;

  @IsString()
  type: 'trigger' | 'condition' | 'action';

  @IsObject()
  data: Record<string, any>;

  @IsOptional()
  @IsObject()
  position?: { x: number; y: number };
}

/**
 * Workflow builder edge DTO (for visual builder)
 */
export class WorkflowBuilderEdgeDto {
  @IsString()
  id: string;

  @IsString()
  source: string;

  @IsString()
  target: string;

  @IsOptional()
  @IsString()
  label?: string;
}

/**
 * Workflow builder DTO (for visual builder)
 */
export class WorkflowBuilderDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowBuilderNodeDto)
  nodes: WorkflowBuilderNodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowBuilderEdgeDto)
  edges: WorkflowBuilderEdgeDto[];
}
