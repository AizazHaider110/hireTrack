import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { QueueService } from '../events/queue.service';
import {
  WorkflowRule,
  WorkflowExecution,
  WorkflowTrigger,
  ExecutionStatus,
} from '@prisma/client';
import {
  CreateWorkflowRuleDto,
  UpdateWorkflowRuleDto,
  ExecuteWorkflowDto,
  WorkflowFilterDto,
  ExecutionFilterDto,
  WorkflowConditionDto,
  WorkflowActionDto,
  WorkflowActionType,
  ConditionOperator,
  WorkflowExecutionResultDto,
  ActionResultDto,
  WorkflowStatisticsDto,
  WorkflowBuilderDto,
} from '../common/dto/workflow.dto';
import { SystemEventType, QueueName, JobName } from '../events/event-types';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly queueService: QueueService,
  ) {
    this.setupEventListeners();
  }

  async createRule(
    data: CreateWorkflowRuleDto,
    createdBy: string,
  ): Promise<WorkflowRule> {
    this.validateWorkflowRule(data);
    const rule = await this.prisma.workflowRule.create({
      data: {
        name: data.name,
        trigger: data.trigger,
        conditions: JSON.parse(JSON.stringify(data.conditions || [])),
        actions: JSON.parse(JSON.stringify(data.actions)),
        isActive: data.isActive ?? true,
        createdBy,
      },
    });
    this.logger.log(`Created workflow rule: ${rule.name} (${rule.id})`);
    this.eventBus.publish('workflow.rule_created', {
      ruleId: rule.id,
      name: rule.name,
      trigger: rule.trigger,
    });
    return rule;
  }

  async updateRule(
    id: string,
    data: UpdateWorkflowRuleDto,
  ): Promise<WorkflowRule> {
    const existingRule = await this.prisma.workflowRule.findUnique({
      where: { id },
    });
    if (!existingRule)
      throw new NotFoundException(`Workflow rule with ID ${id} not found`);
    const existingActions =
      existingRule.actions as unknown as WorkflowActionDto[];
    if (data.conditions || data.actions) {
      this.validateWorkflowRule({
        name: data.name || existingRule.name,
        trigger: data.trigger || existingRule.trigger,
        conditions: data.conditions,
        actions: data.actions || existingActions,
      });
    }
    const updateData: any = {
      name: data.name,
      trigger: data.trigger,
      isActive: data.isActive,
    };
    if (data.conditions !== undefined)
      updateData.conditions = JSON.parse(JSON.stringify(data.conditions));
    if (data.actions !== undefined)
      updateData.actions = JSON.parse(JSON.stringify(data.actions));
    const rule = await this.prisma.workflowRule.update({
      where: { id },
      data: updateData,
    });
    this.logger.log(`Updated workflow rule: ${rule.name} (${rule.id})`);
    this.eventBus.publish('workflow.rule_updated', {
      ruleId: rule.id,
      name: rule.name,
      trigger: rule.trigger,
    });
    return rule;
  }

  async getRuleById(id: string): Promise<WorkflowRule | null> {
    return this.prisma.workflowRule.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        executions: { orderBy: { executedAt: 'desc' }, take: 10 },
      },
    });
  }

  async getRules(filters: WorkflowFilterDto): Promise<{
    rules: WorkflowRule[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (filters.trigger) where.trigger = filters.trigger;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.search)
      where.name = { contains: filters.search, mode: 'insensitive' };
    const [rules, total] = await Promise.all([
      this.prisma.workflowRule.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true, email: true } },
          _count: { select: { executions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.workflowRule.count({ where }),
    ]);
    return { rules, total, page, limit };
  }

  async deleteRule(id: string): Promise<void> {
    const rule = await this.prisma.workflowRule.findUnique({ where: { id } });
    if (!rule)
      throw new NotFoundException(`Workflow rule with ID ${id} not found`);
    await this.prisma.workflowExecution.deleteMany({ where: { ruleId: id } });
    await this.prisma.workflowRule.delete({ where: { id } });
    this.logger.log(`Deleted workflow rule: ${rule.name} (${id})`);
    this.eventBus.publish('workflow.rule_deleted', {
      ruleId: id,
      name: rule.name,
    });
  }

  async toggleRuleStatus(id: string): Promise<WorkflowRule> {
    const rule = await this.prisma.workflowRule.findUnique({ where: { id } });
    if (!rule)
      throw new NotFoundException(`Workflow rule with ID ${id} not found`);
    const updatedRule = await this.prisma.workflowRule.update({
      where: { id },
      data: { isActive: !rule.isActive },
    });
    this.logger.log(
      `Toggled workflow rule ${rule.name} to ${updatedRule.isActive ? 'active' : 'inactive'}`,
    );
    return updatedRule;
  }

  async executeRule(
    data: ExecuteWorkflowDto,
  ): Promise<WorkflowExecutionResultDto> {
    const rule = await this.prisma.workflowRule.findUnique({
      where: { id: data.ruleId },
    });
    if (!rule)
      throw new NotFoundException(
        `Workflow rule with ID ${data.ruleId} not found`,
      );
    return this.executeWorkflow(rule, data.input, data.metadata);
  }

  async getExecutions(filters: ExecutionFilterDto): Promise<{
    executions: WorkflowExecution[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (filters.ruleId) where.ruleId = filters.ruleId;
    if (filters.status) where.status = filters.status;
    if (filters.startDate || filters.endDate) {
      where.executedAt = {};
      if (filters.startDate) where.executedAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.executedAt.lte = new Date(filters.endDate);
    }
    const [executions, total] = await Promise.all([
      this.prisma.workflowExecution.findMany({
        where,
        include: { rule: { select: { id: true, name: true, trigger: true } } },
        orderBy: { executedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.workflowExecution.count({ where }),
    ]);
    return { executions, total, page, limit };
  }

  async getExecutionById(id: string): Promise<WorkflowExecution | null> {
    return this.prisma.workflowExecution.findUnique({
      where: { id },
      include: { rule: true },
    });
  }

  async getStatistics(days: number = 30): Promise<WorkflowStatisticsDto> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const [rules, executions] = await Promise.all([
      this.prisma.workflowRule.findMany(),
      this.prisma.workflowExecution.findMany({
        where: { executedAt: { gte: startDate } },
        include: { rule: true },
      }),
    ]);
    const activeRules = rules.filter((r) => r.isActive).length;
    const successfulExecutions = executions.filter(
      (e) => e.status === ExecutionStatus.COMPLETED,
    ).length;
    const failedExecutions = executions.filter(
      (e) => e.status === ExecutionStatus.FAILED,
    ).length;
    const pendingExecutions = executions.filter(
      (e) =>
        e.status === ExecutionStatus.PENDING ||
        e.status === ExecutionStatus.RUNNING,
    ).length;
    const executionTimes = executions
      .filter((e) => e.output && (e.output as any).executionTimeMs)
      .map((e) => (e.output as any).executionTimeMs);
    const averageExecutionTimeMs =
      executionTimes.length > 0
        ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
        : 0;
    const executionsByTrigger = executions.reduce(
      (acc, e) => {
        acc[e.rule.trigger] = (acc[e.rule.trigger] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    const executionsByStatus = executions.reduce(
      (acc, e) => {
        acc[e.status] = (acc[e.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    return {
      totalRules: rules.length,
      activeRules,
      totalExecutions: executions.length,
      successfulExecutions,
      failedExecutions,
      pendingExecutions,
      averageExecutionTimeMs: Math.round(averageExecutionTimeMs),
      executionsByTrigger,
      executionsByStatus,
    };
  }

  async createFromBuilder(
    data: WorkflowBuilderDto,
    createdBy: string,
  ): Promise<WorkflowRule> {
    const { trigger, conditions, actions } = this.parseBuilderNodes(data);
    return this.createRule(
      {
        name: data.name,
        description: data.description,
        trigger,
        conditions,
        actions,
        isActive: true,
      },
      createdBy,
    );
  }

  private parseBuilderNodes(data: WorkflowBuilderDto): {
    trigger: WorkflowTrigger;
    conditions: WorkflowConditionDto[];
    actions: WorkflowActionDto[];
  } {
    const triggerNode = data.nodes.find((n) => n.type === 'trigger');
    const conditionNodes = data.nodes.filter((n) => n.type === 'condition');
    const actionNodes = data.nodes.filter((n) => n.type === 'action');
    if (!triggerNode)
      throw new BadRequestException('Workflow must have a trigger node');
    const trigger = triggerNode.data.trigger as WorkflowTrigger;
    const conditions: WorkflowConditionDto[] = conditionNodes.map((n) => ({
      field: n.data.field,
      operator: n.data.operator,
      value: n.data.value,
    }));
    const actions: WorkflowActionDto[] = actionNodes.map((n, index) => ({
      type: n.data.actionType,
      config: n.data.config || {},
      order: index,
      stopOnFailure: n.data.stopOnFailure || false,
    }));
    return { trigger, conditions, actions };
  }

  private async executeWorkflow(
    rule: WorkflowRule,
    input: Record<string, any>,
    metadata?: Record<string, any>,
  ): Promise<WorkflowExecutionResultDto> {
    const startTime = Date.now();
    const execution = await this.prisma.workflowExecution.create({
      data: { ruleId: rule.id, status: ExecutionStatus.RUNNING, input },
    });
    this.logger.log(
      `Starting workflow execution ${execution.id} for rule ${rule.name}`,
    );
    try {
      const conditions = rule.conditions as unknown as WorkflowConditionDto[];
      const conditionsMet = this.evaluateConditions(conditions, input);
      if (!conditionsMet) {
        this.logger.debug(`Conditions not met for workflow ${rule.name}`);
        await this.prisma.workflowExecution.update({
          where: { id: execution.id },
          data: {
            status: ExecutionStatus.COMPLETED,
            output: {
              conditionsMet: false,
              executionTimeMs: Date.now() - startTime,
            },
          },
        });
        return {
          executionId: execution.id,
          status: ExecutionStatus.COMPLETED,
          output: { conditionsMet: false },
        };
      }
      const actions = rule.actions as unknown as WorkflowActionDto[];
      const sortedActions = [...actions].sort(
        (a, b) => (a.order || 0) - (b.order || 0),
      );
      const actionResults: ActionResultDto[] = [];
      for (const action of sortedActions) {
        const actionStartTime = Date.now();
        try {
          const result = await this.executeAction(action, input, metadata);
          actionResults.push({
            actionType: action.type,
            success: true,
            result,
            executionTimeMs: Date.now() - actionStartTime,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          actionResults.push({
            actionType: action.type,
            success: false,
            error: errorMessage,
            executionTimeMs: Date.now() - actionStartTime,
          });
          if (action.stopOnFailure)
            throw new Error(`Action ${action.type} failed: ${errorMessage}`);
        }
      }
      const executionTimeMs = Date.now() - startTime;
      await this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: ExecutionStatus.COMPLETED,
          output: JSON.parse(
            JSON.stringify({
              conditionsMet: true,
              actionResults,
              executionTimeMs,
            }),
          ),
        },
      });
      this.logger.log(
        `Workflow execution ${execution.id} completed in ${executionTimeMs}ms`,
      );
      this.eventBus.publish('workflow.execution_completed', {
        executionId: execution.id,
        ruleId: rule.id,
        ruleName: rule.name,
        executionTimeMs,
      });
      return {
        executionId: execution.id,
        status: ExecutionStatus.COMPLETED,
        output: { conditionsMet: true, actionResults },
        actionResults,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const executionTimeMs = Date.now() - startTime;
      await this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: ExecutionStatus.FAILED,
          error: errorMessage,
          output: { executionTimeMs },
        },
      });
      this.logger.error(
        `Workflow execution ${execution.id} failed: ${errorMessage}`,
      );
      this.eventBus.publish('workflow.execution_failed', {
        executionId: execution.id,
        ruleId: rule.id,
        ruleName: rule.name,
        error: errorMessage,
      });
      return {
        executionId: execution.id,
        status: ExecutionStatus.FAILED,
        error: errorMessage,
      };
    }
  }

  private evaluateConditions(
    conditions: WorkflowConditionDto[],
    input: Record<string, any>,
  ): boolean {
    if (!conditions || conditions.length === 0) return true;
    return conditions.every((condition) => {
      const fieldValue = this.getNestedValue(input, condition.field);
      return this.evaluateCondition(
        fieldValue,
        condition.operator,
        condition.value,
      );
    });
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private evaluateCondition(
    fieldValue: any,
    operator: ConditionOperator,
    conditionValue: any,
  ): boolean {
    switch (operator) {
      case ConditionOperator.EQUALS:
        return fieldValue === conditionValue;
      case ConditionOperator.NOT_EQUALS:
        return fieldValue !== conditionValue;
      case ConditionOperator.CONTAINS:
        return String(fieldValue).includes(String(conditionValue));
      case ConditionOperator.NOT_CONTAINS:
        return !String(fieldValue).includes(String(conditionValue));
      case ConditionOperator.GREATER_THAN:
        return Number(fieldValue) > Number(conditionValue);
      case ConditionOperator.LESS_THAN:
        return Number(fieldValue) < Number(conditionValue);
      case ConditionOperator.GREATER_THAN_OR_EQUALS:
        return Number(fieldValue) >= Number(conditionValue);
      case ConditionOperator.LESS_THAN_OR_EQUALS:
        return Number(fieldValue) <= Number(conditionValue);
      case ConditionOperator.IS_EMPTY:
        return (
          fieldValue === null || fieldValue === undefined || fieldValue === ''
        );
      case ConditionOperator.IS_NOT_EMPTY:
        return (
          fieldValue !== null && fieldValue !== undefined && fieldValue !== ''
        );
      case ConditionOperator.IN_LIST:
        return (
          Array.isArray(conditionValue) && conditionValue.includes(fieldValue)
        );
      case ConditionOperator.NOT_IN_LIST:
        return (
          !Array.isArray(conditionValue) || !conditionValue.includes(fieldValue)
        );
      default:
        return false;
    }
  }

  private async executeAction(
    action: WorkflowActionDto,
    input: Record<string, any>,
    metadata?: Record<string, any>,
  ): Promise<Record<string, any>> {
    this.logger.debug(`Executing action: ${action.type}`, {
      config: action.config,
    });
    switch (action.type) {
      case WorkflowActionType.SEND_EMAIL:
        return this.executeSendEmailAction(action.config, input);
      case WorkflowActionType.UPDATE_STATUS:
        return this.executeUpdateStatusAction(action.config, input);
      case WorkflowActionType.MOVE_STAGE:
        return this.executeMoveStageAction(action.config, input);
      case WorkflowActionType.CREATE_TASK:
        return this.executeCreateTaskAction(action.config, input);
      case WorkflowActionType.NOTIFY_USER:
        return this.executeNotifyUserAction(action.config, input);
      case WorkflowActionType.TRIGGER_WEBHOOK:
        return this.executeTriggerWebhookAction(action.config, input);
      case WorkflowActionType.SCHEDULE_INTERVIEW:
        return this.executeScheduleInterviewAction(action.config, input);
      case WorkflowActionType.CALCULATE_SCORE:
        return this.executeCalculateScoreAction(action.config, input);
      case WorkflowActionType.ADD_TO_TALENT_POOL:
        return this.executeAddToTalentPoolAction(action.config, input);
      case WorkflowActionType.REQUEST_APPROVAL:
        return this.executeRequestApprovalAction(
          action.config,
          input,
          metadata,
        );
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async executeSendEmailAction(
    config: Record<string, any>,
    input: Record<string, any>,
  ): Promise<Record<string, any>> {
    const { templateType, to, variables } = config;
    const resolvedTo = this.resolveTemplate(to, input);
    const resolvedVariables = this.resolveTemplateObject(
      variables || {},
      input,
    );
    await this.queueService.addJob(QueueName.EMAIL, JobName.SEND_EMAIL, {
      type: 'workflow_email',
      payload: { templateType, to: resolvedTo, variables: resolvedVariables },
    });
    return { queued: true, to: resolvedTo };
  }

  private async executeUpdateStatusAction(
    config: Record<string, any>,
    input: Record<string, any>,
  ): Promise<Record<string, any>> {
    const { entityType, entityId, status } = config;
    const resolvedEntityId = this.resolveTemplate(entityId, input);
    if (entityType === 'application')
      await this.prisma.application.update({
        where: { id: resolvedEntityId },
        data: { status },
      });
    this.eventBus.publish('workflow.status_updated', {
      entityType,
      entityId: resolvedEntityId,
      status,
    });
    return { entityType, entityId: resolvedEntityId, status };
  }

  private async executeMoveStageAction(
    config: Record<string, any>,
    input: Record<string, any>,
  ): Promise<Record<string, any>> {
    const { candidateId, stageId, reason } = config;
    const resolvedCandidateId = this.resolveTemplate(candidateId, input);
    const resolvedStageId = this.resolveTemplate(stageId, input);
    this.eventBus.publish(SystemEventType.CANDIDATE_MOVED, {
      candidateId: resolvedCandidateId,
      stageId: resolvedStageId,
      reason: reason || 'Automated workflow action',
      automated: true,
    });
    return { candidateId: resolvedCandidateId, stageId: resolvedStageId };
  }

  private async executeCreateTaskAction(
    config: Record<string, any>,
    input: Record<string, any>,
  ): Promise<Record<string, any>> {
    const { title, description, assigneeId, dueDate } = config;
    const resolvedTitle = this.resolveTemplate(title, input);
    const resolvedDescription = this.resolveTemplate(description || '', input);
    const resolvedAssigneeId = this.resolveTemplate(assigneeId, input);
    this.eventBus.publish('workflow.task_created', {
      title: resolvedTitle,
      description: resolvedDescription,
      assigneeId: resolvedAssigneeId,
      dueDate,
      source: 'workflow',
    });
    return { title: resolvedTitle, assigneeId: resolvedAssigneeId };
  }

  private async executeNotifyUserAction(
    config: Record<string, any>,
    input: Record<string, any>,
  ): Promise<Record<string, any>> {
    const { userId, message, channel } = config;
    const resolvedUserId = this.resolveTemplate(userId, input);
    const resolvedMessage = this.resolveTemplate(message, input);
    await this.queueService.addJob(
      QueueName.NOTIFICATIONS,
      JobName.SEND_NOTIFICATION,
      {
        type: 'workflow_notification',
        payload: {
          userId: resolvedUserId,
          message: resolvedMessage,
          channel: channel || 'in_app',
        },
      },
    );
    return { userId: resolvedUserId, channel };
  }

  private async executeTriggerWebhookAction(
    config: Record<string, any>,
    input: Record<string, any>,
  ): Promise<Record<string, any>> {
    const { webhookId, payload } = config;
    const resolvedPayload = this.resolveTemplateObject(payload || input, input);
    await this.queueService.addJob(
      QueueName.WEBHOOKS,
      JobName.DELIVER_WEBHOOK,
      {
        type: 'workflow_webhook',
        payload: { webhookId, payload: resolvedPayload },
      },
    );
    return { webhookId, queued: true };
  }

  private async executeScheduleInterviewAction(
    config: Record<string, any>,
    input: Record<string, any>,
  ): Promise<Record<string, any>> {
    const { candidateId, jobId, interviewType, duration } = config;
    const resolvedCandidateId = this.resolveTemplate(candidateId, input);
    const resolvedJobId = this.resolveTemplate(jobId, input);
    this.eventBus.publish('workflow.interview_requested', {
      candidateId: resolvedCandidateId,
      jobId: resolvedJobId,
      interviewType,
      duration,
      automated: true,
    });
    return { candidateId: resolvedCandidateId, jobId: resolvedJobId };
  }

  private async executeCalculateScoreAction(
    config: Record<string, any>,
    input: Record<string, any>,
  ): Promise<Record<string, any>> {
    const { candidateId, jobId } = config;
    const resolvedCandidateId = this.resolveTemplate(candidateId, input);
    const resolvedJobId = this.resolveTemplate(jobId, input);
    await this.queueService.addJob(
      QueueName.AI_SCORING,
      JobName.SCORE_CANDIDATE,
      {
        type: 'workflow_scoring',
        payload: { candidateId: resolvedCandidateId, jobId: resolvedJobId },
      },
    );
    return {
      candidateId: resolvedCandidateId,
      jobId: resolvedJobId,
      queued: true,
    };
  }

  private async executeAddToTalentPoolAction(
    config: Record<string, any>,
    input: Record<string, any>,
  ): Promise<Record<string, any>> {
    const { candidateId, tags, status } = config;
    const resolvedCandidateId = this.resolveTemplate(candidateId, input);
    this.eventBus.publish('workflow.talent_pool_add', {
      candidateId: resolvedCandidateId,
      tags: tags || [],
      status: status || 'ACTIVE',
      automated: true,
    });
    return { candidateId: resolvedCandidateId, tags };
  }

  private async executeRequestApprovalAction(
    config: Record<string, any>,
    input: Record<string, any>,
    metadata?: Record<string, any>,
  ): Promise<Record<string, any>> {
    const { approverIds, title, description } = config;
    const resolvedTitle = this.resolveTemplate(title, input);
    const resolvedDescription = this.resolveTemplate(description || '', input);
    this.eventBus.publish('workflow.approval_requested', {
      approverIds,
      title: resolvedTitle,
      description: resolvedDescription,
      input,
      metadata,
    });
    return { approverIds, title: resolvedTitle, pending: true };
  }

  private resolveTemplate(
    template: string,
    input: Record<string, any>,
  ): string {
    if (!template) return template;
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.getNestedValue(input, path.trim());
      return value !== undefined ? String(value) : match;
    });
  }

  private resolveTemplateObject(
    obj: Record<string, any>,
    input: Record<string, any>,
  ): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string')
        result[key] = this.resolveTemplate(value, input);
      else if (typeof value === 'object' && value !== null)
        result[key] = this.resolveTemplateObject(value, input);
      else result[key] = value;
    }
    return result;
  }

  private validateWorkflowRule(data: CreateWorkflowRuleDto): void {
    if (!data.actions || data.actions.length === 0)
      throw new BadRequestException('Workflow must have at least one action');
    for (const action of data.actions) {
      if (!Object.values(WorkflowActionType).includes(action.type))
        throw new BadRequestException(`Invalid action type: ${action.type}`);
    }
    if (data.conditions) {
      for (const condition of data.conditions) {
        if (!Object.values(ConditionOperator).includes(condition.operator))
          throw new BadRequestException(
            `Invalid condition operator: ${condition.operator}`,
          );
      }
    }
  }

  private setupEventListeners(): void {
    const triggerMap: Record<string, WorkflowTrigger> = {
      [SystemEventType.CANDIDATE_APPLIED]: WorkflowTrigger.APPLICATION_RECEIVED,
      [SystemEventType.CANDIDATE_STAGE_CHANGED]: WorkflowTrigger.STAGE_CHANGED,
      [SystemEventType.INTERVIEW_SCHEDULED]:
        WorkflowTrigger.INTERVIEW_SCHEDULED,
      [SystemEventType.INTERVIEW_COMPLETED]:
        WorkflowTrigger.INTERVIEW_COMPLETED,
      [SystemEventType.SCORE_CALCULATED]: WorkflowTrigger.SCORE_CALCULATED,
      [SystemEventType.OFFER_SENT]: WorkflowTrigger.OFFER_SENT,
      [SystemEventType.CANDIDATE_REJECTED]: WorkflowTrigger.CANDIDATE_REJECTED,
    };
    for (const [eventType, trigger] of Object.entries(triggerMap)) {
      this.eventBus.subscribe(eventType, async (event) => {
        await this.handleTrigger(trigger, event.payload);
      });
    }
    this.logger.log('Workflow event listeners setup complete');
  }

  private async handleTrigger(
    trigger: WorkflowTrigger,
    payload: Record<string, any>,
  ): Promise<void> {
    try {
      const rules = await this.prisma.workflowRule.findMany({
        where: { trigger, isActive: true },
      });
      if (rules.length === 0) return;
      this.logger.debug(
        `Found ${rules.length} active rules for trigger ${trigger}`,
      );
      for (const rule of rules) {
        try {
          await this.executeWorkflow(rule, payload);
        } catch (error) {
          this.logger.error(
            `Failed to execute workflow rule ${rule.id}:`,
            error,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error handling trigger ${trigger}:`, error);
    }
  }

  async retryExecution(
    executionId: string,
  ): Promise<WorkflowExecutionResultDto> {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: { rule: true },
    });
    if (!execution)
      throw new NotFoundException(`Execution with ID ${executionId} not found`);
    if (execution.status !== ExecutionStatus.FAILED)
      throw new BadRequestException('Only failed executions can be retried');
    return this.executeWorkflow(
      execution.rule,
      execution.input as Record<string, any>,
    );
  }

  async cancelExecution(executionId: string): Promise<WorkflowExecution> {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id: executionId },
    });
    if (!execution)
      throw new NotFoundException(`Execution with ID ${executionId} not found`);
    if (
      execution.status !== ExecutionStatus.PENDING &&
      execution.status !== ExecutionStatus.RUNNING
    )
      throw new BadRequestException(
        'Only pending or running executions can be cancelled',
      );
    return this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: ExecutionStatus.CANCELLED },
    });
  }

  async processApproval(
    executionId: string,
    approved: boolean,
    approverId: string,
    comment?: string,
  ): Promise<WorkflowExecution> {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: { rule: true },
    });
    if (!execution)
      throw new NotFoundException(`Execution with ID ${executionId} not found`);
    if (execution.status !== ExecutionStatus.PENDING)
      throw new BadRequestException('Execution is not pending approval');
    const output = (execution.output as Record<string, any>) || {};
    const approvalData = {
      ...output,
      approval: {
        approved,
        approverId,
        comment,
        processedAt: new Date().toISOString(),
      },
    };
    if (approved) {
      const updatedExecution = await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: ExecutionStatus.RUNNING,
          output: JSON.parse(JSON.stringify(approvalData)),
        },
      });
      this.eventBus.publish('workflow.approval_granted', {
        executionId,
        ruleId: execution.ruleId,
        approverId,
      });
      return updatedExecution;
    } else {
      const updatedExecution = await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: ExecutionStatus.CANCELLED,
          output: JSON.parse(JSON.stringify(approvalData)),
          error: `Rejected by approver: ${comment || 'No reason provided'}`,
        },
      });
      this.eventBus.publish('workflow.approval_rejected', {
        executionId,
        ruleId: execution.ruleId,
        approverId,
        comment,
      });
      return updatedExecution;
    }
  }

  async getPendingApprovals(userId: string): Promise<WorkflowExecution[]> {
    const executions = await this.prisma.workflowExecution.findMany({
      where: { status: ExecutionStatus.PENDING },
      include: { rule: true },
      orderBy: { executedAt: 'desc' },
    });
    return executions.filter((execution) => {
      const output = execution.output as Record<string, any>;
      const approverIds = output?.pendingApproval?.approverIds || [];
      return approverIds.includes(userId);
    });
  }

  async getExecutionLogs(executionId: string): Promise<{
    execution: WorkflowExecution;
    logs: Array<{
      timestamp: string;
      level: string;
      message: string;
      data?: Record<string, any>;
    }>;
  }> {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: { rule: true },
    });
    if (!execution)
      throw new NotFoundException(`Execution with ID ${executionId} not found`);
    const output = (execution.output as Record<string, any>) || {};
    const actionResults = output.actionResults || [];
    const logs: Array<{
      timestamp: string;
      level: string;
      message: string;
      data?: Record<string, any>;
    }> = [];
    logs.push({
      timestamp: execution.executedAt.toISOString(),
      level: 'INFO',
      message: `Workflow execution started for rule: ${execution.rule.name}`,
      data: { ruleId: execution.ruleId, trigger: execution.rule.trigger },
    });
    if (output.conditionsMet !== undefined)
      logs.push({
        timestamp: execution.executedAt.toISOString(),
        level: output.conditionsMet ? 'INFO' : 'DEBUG',
        message: output.conditionsMet
          ? 'All conditions met, proceeding with actions'
          : 'Conditions not met, skipping actions',
      });
    for (const result of actionResults)
      logs.push({
        timestamp: execution.executedAt.toISOString(),
        level: result.success ? 'INFO' : 'ERROR',
        message: result.success
          ? `Action ${result.actionType} completed successfully`
          : `Action ${result.actionType} failed: ${result.error}`,
        data: {
          actionType: result.actionType,
          executionTimeMs: result.executionTimeMs,
          result: result.result,
        },
      });
    logs.push({
      timestamp: new Date().toISOString(),
      level: execution.status === ExecutionStatus.COMPLETED ? 'INFO' : 'ERROR',
      message:
        execution.status === ExecutionStatus.COMPLETED
          ? `Workflow execution completed in ${output.executionTimeMs}ms`
          : `Workflow execution failed: ${execution.error}`,
    });
    return { execution, logs };
  }

  async getHealthMetrics(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: {
      activeRules: number;
      recentExecutions: number;
      successRate: number;
      averageExecutionTime: number;
      pendingApprovals: number;
      failedInLastHour: number;
    };
    issues: string[];
  }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [activeRules, recentExecutions, failedInLastHour, pendingApprovals] =
      await Promise.all([
        this.prisma.workflowRule.count({ where: { isActive: true } }),
        this.prisma.workflowExecution.findMany({
          where: { executedAt: { gte: oneDayAgo } },
        }),
        this.prisma.workflowExecution.count({
          where: {
            status: ExecutionStatus.FAILED,
            executedAt: { gte: oneHourAgo },
          },
        }),
        this.prisma.workflowExecution.count({
          where: { status: ExecutionStatus.PENDING },
        }),
      ]);
    const successfulExecutions = recentExecutions.filter(
      (e) => e.status === ExecutionStatus.COMPLETED,
    ).length;
    const successRate =
      recentExecutions.length > 0
        ? (successfulExecutions / recentExecutions.length) * 100
        : 100;
    const executionTimes = recentExecutions
      .filter((e) => e.output && (e.output as any).executionTimeMs)
      .map((e) => (e.output as any).executionTimeMs);
    const averageExecutionTime =
      executionTimes.length > 0
        ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
        : 0;
    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (failedInLastHour > 10) {
      issues.push(
        `High failure rate: ${failedInLastHour} failures in the last hour`,
      );
      status = 'unhealthy';
    } else if (failedInLastHour > 5) {
      issues.push(
        `Elevated failure rate: ${failedInLastHour} failures in the last hour`,
      );
      status = 'degraded';
    }
    if (successRate < 80) {
      issues.push(`Low success rate: ${successRate.toFixed(1)}%`);
      status = status === 'healthy' ? 'degraded' : status;
    }
    if (pendingApprovals > 20) {
      issues.push(`Many pending approvals: ${pendingApprovals}`);
      status = status === 'healthy' ? 'degraded' : status;
    }
    if (averageExecutionTime > 5000) {
      issues.push(
        `Slow execution time: ${averageExecutionTime.toFixed(0)}ms average`,
      );
      status = status === 'healthy' ? 'degraded' : status;
    }
    return {
      status,
      metrics: {
        activeRules,
        recentExecutions: recentExecutions.length,
        successRate: Math.round(successRate * 100) / 100,
        averageExecutionTime: Math.round(averageExecutionTime),
        pendingApprovals,
        failedInLastHour,
      },
      issues,
    };
  }

  async cloneRule(
    id: string,
    newName: string,
    createdBy: string,
  ): Promise<WorkflowRule> {
    const rule = await this.prisma.workflowRule.findUnique({ where: { id } });
    if (!rule)
      throw new NotFoundException(`Workflow rule with ID ${id} not found`);
    const clonedRule = await this.prisma.workflowRule.create({
      data: {
        name: newName || `${rule.name} (Copy)`,
        trigger: rule.trigger,
        conditions: rule.conditions as any,
        actions: rule.actions as any,
        isActive: false,
        createdBy,
      },
    });
    this.logger.log(`Cloned workflow rule ${rule.name} to ${clonedRule.name}`);
    return clonedRule;
  }

  async exportRule(id: string): Promise<Record<string, any>> {
    const rule = await this.prisma.workflowRule.findUnique({ where: { id } });
    if (!rule)
      throw new NotFoundException(`Workflow rule with ID ${id} not found`);
    return {
      name: rule.name,
      trigger: rule.trigger,
      conditions: rule.conditions,
      actions: rule.actions,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };
  }

  async importRule(
    data: Record<string, any>,
    createdBy: string,
  ): Promise<WorkflowRule> {
    if (!data.name || !data.trigger || !data.actions) {
      throw new BadRequestException(
        'Invalid workflow rule data: missing required fields',
      );
    }
    const createDto: CreateWorkflowRuleDto = {
      name: data.name,
      trigger: data.trigger,
      conditions: data.conditions || [],
      actions: data.actions,
      isActive: false,
    };
    this.validateWorkflowRule(createDto);
    return this.createRule(createDto, createdBy);
  }

  async bulkToggleRules(ruleIds: string[], isActive: boolean): Promise<number> {
    const result = await this.prisma.workflowRule.updateMany({
      where: { id: { in: ruleIds } },
      data: { isActive },
    });
    this.logger.log(
      `Bulk toggled ${result.count} rules to ${isActive ? 'active' : 'inactive'}`,
    );
    return result.count;
  }

  async getRuleExecutionSummary(
    ruleId: string,
    days: number = 7,
  ): Promise<{
    ruleId: string;
    ruleName: string;
    totalExecutions: number;
    successCount: number;
    failureCount: number;
    averageExecutionTime: number;
    executionsByDay: Record<string, number>;
  }> {
    const rule = await this.prisma.workflowRule.findUnique({
      where: { id: ruleId },
    });
    if (!rule)
      throw new NotFoundException(`Workflow rule with ID ${ruleId} not found`);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const executions = await this.prisma.workflowExecution.findMany({
      where: { ruleId, executedAt: { gte: startDate } },
    });
    const successCount = executions.filter(
      (e) => e.status === ExecutionStatus.COMPLETED,
    ).length;
    const failureCount = executions.filter(
      (e) => e.status === ExecutionStatus.FAILED,
    ).length;
    const executionTimes = executions
      .filter((e) => e.output && (e.output as any).executionTimeMs)
      .map((e) => (e.output as any).executionTimeMs);
    const averageExecutionTime =
      executionTimes.length > 0
        ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
        : 0;
    const executionsByDay: Record<string, number> = {};
    for (const execution of executions) {
      const day = execution.executedAt.toISOString().split('T')[0];
      executionsByDay[day] = (executionsByDay[day] || 0) + 1;
    }
    return {
      ruleId,
      ruleName: rule.name,
      totalExecutions: executions.length,
      successCount,
      failureCount,
      averageExecutionTime: Math.round(averageExecutionTime),
      executionsByDay,
    };
  }

  getAvailableTriggers(): Array<{
    value: WorkflowTrigger;
    label: string;
    description: string;
  }> {
    return [
      {
        value: WorkflowTrigger.APPLICATION_RECEIVED,
        label: 'Application Received',
        description: 'Triggered when a new application is submitted',
      },
      {
        value: WorkflowTrigger.STAGE_CHANGED,
        label: 'Stage Changed',
        description: 'Triggered when a candidate moves to a different stage',
      },
      {
        value: WorkflowTrigger.INTERVIEW_SCHEDULED,
        label: 'Interview Scheduled',
        description: 'Triggered when an interview is scheduled',
      },
      {
        value: WorkflowTrigger.INTERVIEW_COMPLETED,
        label: 'Interview Completed',
        description: 'Triggered when an interview is completed',
      },
      {
        value: WorkflowTrigger.SCORE_CALCULATED,
        label: 'Score Calculated',
        description: 'Triggered when a candidate score is calculated',
      },
      {
        value: WorkflowTrigger.OFFER_SENT,
        label: 'Offer Sent',
        description: 'Triggered when an offer is sent to a candidate',
      },
      {
        value: WorkflowTrigger.CANDIDATE_REJECTED,
        label: 'Candidate Rejected',
        description: 'Triggered when a candidate is rejected',
      },
      {
        value: WorkflowTrigger.TIME_ELAPSED,
        label: 'Time Elapsed',
        description: 'Triggered after a specified time period',
      },
    ];
  }

  getAvailableActions(): Array<{
    value: WorkflowActionType;
    label: string;
    description: string;
    configSchema: Record<string, any>;
  }> {
    return [
      {
        value: WorkflowActionType.SEND_EMAIL,
        label: 'Send Email',
        description: 'Send an email notification',
        configSchema: {
          templateType: 'string',
          to: 'string',
          variables: 'object',
        },
      },
      {
        value: WorkflowActionType.UPDATE_STATUS,
        label: 'Update Status',
        description: 'Update entity status',
        configSchema: {
          entityType: 'string',
          entityId: 'string',
          status: 'string',
        },
      },
      {
        value: WorkflowActionType.MOVE_STAGE,
        label: 'Move Stage',
        description: 'Move candidate to a different stage',
        configSchema: {
          candidateId: 'string',
          stageId: 'string',
          reason: 'string',
        },
      },
      {
        value: WorkflowActionType.CREATE_TASK,
        label: 'Create Task',
        description: 'Create a new task',
        configSchema: {
          title: 'string',
          description: 'string',
          assigneeId: 'string',
          dueDate: 'string',
        },
      },
      {
        value: WorkflowActionType.NOTIFY_USER,
        label: 'Notify User',
        description: 'Send a notification to a user',
        configSchema: {
          userId: 'string',
          message: 'string',
          channel: 'string',
        },
      },
      {
        value: WorkflowActionType.TRIGGER_WEBHOOK,
        label: 'Trigger Webhook',
        description: 'Trigger an external webhook',
        configSchema: { webhookId: 'string', payload: 'object' },
      },
      {
        value: WorkflowActionType.SCHEDULE_INTERVIEW,
        label: 'Schedule Interview',
        description: 'Schedule an interview',
        configSchema: {
          candidateId: 'string',
          jobId: 'string',
          interviewType: 'string',
          duration: 'number',
        },
      },
      {
        value: WorkflowActionType.CALCULATE_SCORE,
        label: 'Calculate Score',
        description: 'Calculate candidate score',
        configSchema: { candidateId: 'string', jobId: 'string' },
      },
      {
        value: WorkflowActionType.ADD_TO_TALENT_POOL,
        label: 'Add to Talent Pool',
        description: 'Add candidate to talent pool',
        configSchema: {
          candidateId: 'string',
          tags: 'array',
          status: 'string',
        },
      },
      {
        value: WorkflowActionType.REQUEST_APPROVAL,
        label: 'Request Approval',
        description: 'Request approval from users',
        configSchema: {
          approverIds: 'array',
          title: 'string',
          description: 'string',
        },
      },
    ];
  }

  getAvailableOperators(): Array<{
    value: ConditionOperator;
    label: string;
    description: string;
    applicableTypes: string[];
  }> {
    return [
      {
        value: ConditionOperator.EQUALS,
        label: 'Equals',
        description: 'Value equals the specified value',
        applicableTypes: ['string', 'number', 'boolean'],
      },
      {
        value: ConditionOperator.NOT_EQUALS,
        label: 'Not Equals',
        description: 'Value does not equal the specified value',
        applicableTypes: ['string', 'number', 'boolean'],
      },
      {
        value: ConditionOperator.CONTAINS,
        label: 'Contains',
        description: 'Value contains the specified string',
        applicableTypes: ['string'],
      },
      {
        value: ConditionOperator.NOT_CONTAINS,
        label: 'Not Contains',
        description: 'Value does not contain the specified string',
        applicableTypes: ['string'],
      },
      {
        value: ConditionOperator.GREATER_THAN,
        label: 'Greater Than',
        description: 'Value is greater than the specified number',
        applicableTypes: ['number'],
      },
      {
        value: ConditionOperator.LESS_THAN,
        label: 'Less Than',
        description: 'Value is less than the specified number',
        applicableTypes: ['number'],
      },
      {
        value: ConditionOperator.GREATER_THAN_OR_EQUALS,
        label: 'Greater Than or Equals',
        description: 'Value is greater than or equal to the specified number',
        applicableTypes: ['number'],
      },
      {
        value: ConditionOperator.LESS_THAN_OR_EQUALS,
        label: 'Less Than or Equals',
        description: 'Value is less than or equal to the specified number',
        applicableTypes: ['number'],
      },
      {
        value: ConditionOperator.IS_EMPTY,
        label: 'Is Empty',
        description: 'Value is null, undefined, or empty string',
        applicableTypes: ['string', 'array'],
      },
      {
        value: ConditionOperator.IS_NOT_EMPTY,
        label: 'Is Not Empty',
        description: 'Value is not null, undefined, or empty string',
        applicableTypes: ['string', 'array'],
      },
      {
        value: ConditionOperator.IN_LIST,
        label: 'In List',
        description: 'Value is in the specified list',
        applicableTypes: ['string', 'number'],
      },
      {
        value: ConditionOperator.NOT_IN_LIST,
        label: 'Not In List',
        description: 'Value is not in the specified list',
        applicableTypes: ['string', 'number'],
      },
    ];
  }
}
