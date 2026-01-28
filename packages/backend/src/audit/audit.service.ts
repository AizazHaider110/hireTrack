import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLog, Prisma } from '@prisma/client';

export interface AuditLogData {
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditQuery {
  userId?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an audit log entry
   */
  async createAuditLog(data: AuditLogData): Promise<AuditLog> {
    try {
      const auditLog = await this.prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          resource: data.resource,
          resourceId: data.resourceId,
          before: data.before
            ? (data.before as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          after: data.after
            ? (data.after as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          metadata: data.metadata
            ? (data.metadata as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          timestamp: new Date(),
        },
      });

      this.logger.debug(
        `Audit log created: ${data.action} on ${data.resource}:${data.resourceId} by user ${data.userId}`,
      );
      return auditLog;
    } catch (error) {
      this.logger.error('Failed to create audit log:', error);
      throw error;
    }
  }

  /**
   * Log a create operation
   */
  async logCreate(
    userId: string,
    resource: string,
    resourceId: string,
    data: unknown,
    metadata?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuditLog> {
    return this.createAuditLog({
      userId,
      action: `${resource}.created`,
      resource,
      resourceId,
      after: data,
      metadata,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log an update operation
   */
  async logUpdate(
    userId: string,
    resource: string,
    resourceId: string,
    before: unknown,
    after: unknown,
    metadata?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuditLog> {
    return this.createAuditLog({
      userId,
      action: `${resource}.updated`,
      resource,
      resourceId,
      before,
      after,
      metadata,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log a delete operation
   */
  async logDelete(
    userId: string,
    resource: string,
    resourceId: string,
    data: unknown,
    metadata?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuditLog> {
    return this.createAuditLog({
      userId,
      action: `${resource}.deleted`,
      resource,
      resourceId,
      before: data,
      metadata,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log a custom action
   */
  async logAction(
    userId: string,
    action: string,
    resource: string,
    resourceId: string,
    metadata?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuditLog> {
    return this.createAuditLog({
      userId,
      action,
      resource,
      resourceId,
      metadata,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Query audit logs with filters
   */
  async queryAuditLogs(query: AuditQuery): Promise<{
    logs: AuditLog[];
    total: number;
  }> {
    const where: Prisma.AuditLogWhereInput = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.action) {
      where.action = {
        contains: query.action,
        mode: 'insensitive',
      };
    }

    if (query.resource) {
      where.resource = query.resource;
    }

    if (query.resourceId) {
      where.resourceId = query.resourceId;
    }

    if (query.startDate || query.endDate) {
      where.timestamp = {};
      if (query.startDate) {
        where.timestamp.gte = query.startDate;
      }
      if (query.endDate) {
        where.timestamp.lte = query.endDate;
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: query.limit || 50,
        skip: query.offset || 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Get audit logs for a specific resource
   */
  async getResourceHistory(
    resource: string,
    resourceId: string,
    limit = 50,
  ): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: {
        resource,
        resourceId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserActivity(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    limit = 50,
  ): Promise<AuditLog[]> {
    const where: Prisma.AuditLogWhereInput = {
      userId,
    };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = startDate;
      }
      if (endDate) {
        where.timestamp.lte = endDate;
      }
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Get audit log by ID
   */
  async getAuditLogById(id: string): Promise<AuditLog | null> {
    return this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }
}
