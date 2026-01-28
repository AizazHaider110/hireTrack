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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import {
  CreateWorkflowRuleDto,
  UpdateWorkflowRuleDto,
  ExecuteWorkflowDto,
  WorkflowFilterDto,
  ExecutionFilterDto,
  WorkflowBuilderDto,
  ApprovalRequestDto,
} from '../common/dto/workflow.dto';

@Controller('workflows')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  /**
   * Create a new workflow rule
   */
  @Post('rules')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async createRule(@Body() data: CreateWorkflowRuleDto, @Request() req: any) {
    return this.workflowService.createRule(data, req.user.id);
  }

  /**
   * Get all workflow rules with filtering
   */
  @Get('rules')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async getRules(@Query() filters: WorkflowFilterDto) {
    return this.workflowService.getRules(filters);
  }

  /**
   * Get workflow rule by ID
   */
  @Get('rules/:id')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async getRuleById(@Param('id') id: string) {
    return this.workflowService.getRuleById(id);
  }

  /**
   * Update a workflow rule
   */
  @Put('rules/:id')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async updateRule(
    @Param('id') id: string,
    @Body() data: UpdateWorkflowRuleDto,
  ) {
    return this.workflowService.updateRule(id, data);
  }

  /**
   * Delete a workflow rule
   */
  @Delete('rules/:id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRule(@Param('id') id: string) {
    await this.workflowService.deleteRule(id);
  }

  /**
   * Toggle workflow rule active status
   */
  @Post('rules/:id/toggle')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async toggleRuleStatus(@Param('id') id: string) {
    return this.workflowService.toggleRuleStatus(id);
  }

  /**
   * Clone a workflow rule
   */
  @Post('rules/:id/clone')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async cloneRule(
    @Param('id') id: string,
    @Body('name') name: string,
    @Request() req: any,
  ) {
    return this.workflowService.cloneRule(id, name, req.user.id);
  }

  /**
   * Export a workflow rule as JSON
   */
  @Get('rules/:id/export')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async exportRule(@Param('id') id: string) {
    return this.workflowService.exportRule(id);
  }

  /**
   * Import a workflow rule from JSON
   */
  @Post('rules/import')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async importRule(@Body() data: Record<string, any>, @Request() req: any) {
    return this.workflowService.importRule(data, req.user.id);
  }

  /**
   * Bulk toggle workflow rules
   */
  @Post('rules/bulk-toggle')
  @Roles(Role.ADMIN)
  async bulkToggleRules(
    @Body('ruleIds') ruleIds: string[],
    @Body('isActive') isActive: boolean,
  ) {
    const count = await this.workflowService.bulkToggleRules(ruleIds, isActive);
    return { updated: count };
  }

  /**
   * Get rule execution summary
   */
  @Get('rules/:id/summary')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async getRuleExecutionSummary(
    @Param('id') id: string,
    @Query('days') days?: number,
  ) {
    return this.workflowService.getRuleExecutionSummary(id, days || 7);
  }

  /**
   * Execute a workflow rule manually
   */
  @Post('execute')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async executeRule(@Body() data: ExecuteWorkflowDto) {
    return this.workflowService.executeRule(data);
  }

  /**
   * Get workflow executions with filtering
   */
  @Get('executions')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async getExecutions(@Query() filters: ExecutionFilterDto) {
    return this.workflowService.getExecutions(filters);
  }

  /**
   * Get execution by ID
   */
  @Get('executions/:id')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async getExecutionById(@Param('id') id: string) {
    return this.workflowService.getExecutionById(id);
  }

  /**
   * Get execution logs
   */
  @Get('executions/:id/logs')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async getExecutionLogs(@Param('id') id: string) {
    return this.workflowService.getExecutionLogs(id);
  }

  /**
   * Retry a failed execution
   */
  @Post('executions/:id/retry')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async retryExecution(@Param('id') id: string) {
    return this.workflowService.retryExecution(id);
  }

  /**
   * Cancel a pending execution
   */
  @Post('executions/:id/cancel')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async cancelExecution(@Param('id') id: string) {
    return this.workflowService.cancelExecution(id);
  }

  /**
   * Process approval for a workflow execution
   */
  @Post('approvals/:executionId')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async processApproval(
    @Param('executionId') executionId: string,
    @Body() data: ApprovalRequestDto,
    @Request() req: any,
  ) {
    return this.workflowService.processApproval(
      executionId,
      data.approved,
      req.user.id,
      data.comment,
    );
  }

  /**
   * Get pending approvals for current user
   */
  @Get('approvals/pending')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async getPendingApprovals(@Request() req: any) {
    return this.workflowService.getPendingApprovals(req.user.id);
  }

  /**
   * Get workflow statistics
   */
  @Get('statistics')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async getStatistics(@Query('days') days?: number) {
    return this.workflowService.getStatistics(days || 30);
  }

  /**
   * Get workflow health metrics
   */
  @Get('health')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async getHealthMetrics() {
    return this.workflowService.getHealthMetrics();
  }

  /**
   * Create workflow from visual builder
   */
  @Post('builder')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER)
  async createFromBuilder(
    @Body() data: WorkflowBuilderDto,
    @Request() req: any,
  ) {
    return this.workflowService.createFromBuilder(data, req.user.id);
  }

  /**
   * Get available triggers
   */
  @Get('meta/triggers')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER, Role.INTERVIEWER)
  async getAvailableTriggers() {
    return this.workflowService.getAvailableTriggers();
  }

  /**
   * Get available actions
   */
  @Get('meta/actions')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER, Role.INTERVIEWER)
  async getAvailableActions() {
    return this.workflowService.getAvailableActions();
  }

  /**
   * Get available condition operators
   */
  @Get('meta/operators')
  @Roles(Role.ADMIN, Role.RECRUITER, Role.HIRING_MANAGER, Role.INTERVIEWER)
  async getAvailableOperators() {
    return this.workflowService.getAvailableOperators();
  }
}
