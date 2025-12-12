import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { AuditService, AuditQuery } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Query audit logs with filters
   */
  @Get('logs')
  @Roles(Role.ADMIN)
  async queryAuditLogs(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('resourceId') resourceId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ) {
    const query: AuditQuery = {
      userId,
      action,
      resource,
      resourceId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
      offset,
    };

    return this.auditService.queryAuditLogs(query);
  }

  /**
   * Get specific audit log entry
   */
  @Get('logs/:id')
  @Roles(Role.ADMIN)
  async getAuditLog(@Param('id') id: string) {
    return this.auditService.getAuditLogById(id);
  }

  /**
   * Get user activity history
   */
  @Get('user/:userId')
  @Roles(Role.ADMIN)
  async getUserActivity(
    @Param('userId') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.auditService.getUserActivity(
      userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      limit,
    );
  }

  /**
   * Get resource change history
   */
  @Get('resource/:resource/:id')
  @Roles(Role.ADMIN)
  async getResourceHistory(
    @Param('resource') resource: string,
    @Param('id') resourceId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.auditService.getResourceHistory(resource, resourceId, limit);
  }
}
