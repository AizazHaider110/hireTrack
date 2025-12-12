import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

describe('AuditService', () => {
  let service: AuditService;

  const mockPrismaService = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAuditLog', () => {
    it('should create an audit log entry', async () => {
      const auditData = {
        userId: 'user-123',
        action: 'user.created',
        resource: 'user',
        resourceId: 'user-456',
        after: { name: 'John Doe', email: 'john@example.com' },
      };

      const expectedAuditLog = {
        id: 'audit-123',
        ...auditData,
        before: null,
        metadata: null,
        ipAddress: undefined,
        userAgent: undefined,
        timestamp: expect.any(Date),
      } as const;

      mockPrismaService.auditLog.create.mockResolvedValue(expectedAuditLog);

      const result = await service.createAuditLog(auditData);

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: auditData.userId,
          action: auditData.action,
          resource: auditData.resource,
          resourceId: auditData.resourceId,
          before: Prisma.JsonNull,
          after: auditData.after,
          metadata: Prisma.JsonNull,
          ipAddress: undefined,
          userAgent: undefined,
          timestamp: expect.any(Date),
        },
      });

      expect(result).toEqual(expectedAuditLog);
    });
  });

  describe('logCreate', () => {
    it('should log a create operation', async () => {
      const userId = 'user-123';
      const resource = 'job';
      const resourceId = 'job-456';
      const data = { title: 'Software Engineer', location: 'Remote' };

      const expectedAuditLog = {
        id: 'audit-123',
        userId,
        action: 'job.created',
        resource,
        resourceId,
        after: data,
        timestamp: expect.any(Date),
      } as const;

      mockPrismaService.auditLog.create.mockResolvedValue(expectedAuditLog);

      const result = await service.logCreate(
        userId,
        resource,
        resourceId,
        data,
      );

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId,
          action: 'job.created',
          resource,
          resourceId,
          before: Prisma.JsonNull,
          after: data,
          metadata: Prisma.JsonNull,
          ipAddress: undefined,
          userAgent: undefined,
          timestamp: expect.any(Date),
        },
      });

      expect(result).toEqual(expectedAuditLog);
    });
  });

  describe('logUpdate', () => {
    it('should log an update operation with before and after states', async () => {
      const userId = 'user-123';
      const resource = 'job';
      const resourceId = 'job-456';
      const before = { title: 'Software Engineer', location: 'Remote' };
      const after = { title: 'Senior Software Engineer', location: 'Remote' };

      const expectedAuditLog = {
        id: 'audit-123',
        userId,
        action: 'job.updated',
        resource,
        resourceId,
        before,
        after,
        timestamp: expect.any(Date),
      } as const;

      mockPrismaService.auditLog.create.mockResolvedValue(expectedAuditLog);

      const result = await service.logUpdate(
        userId,
        resource,
        resourceId,
        before,
        after,
      );

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId,
          action: 'job.updated',
          resource,
          resourceId,
          before,
          after,
          metadata: Prisma.JsonNull,
          ipAddress: undefined,
          userAgent: undefined,
          timestamp: expect.any(Date),
        },
      });

      expect(result).toEqual(expectedAuditLog);
    });
  });

  describe('queryAuditLogs', () => {
    it('should query audit logs with filters', async () => {
      const query = {
        userId: 'user-123',
        resource: 'job',
        limit: 10,
        offset: 0,
      };

      const mockLogs = [
        {
          id: 'audit-1',
          userId: 'user-123',
          action: 'job.created',
          resource: 'job',
          resourceId: 'job-1',
          timestamp: new Date(),
        },
      ] as const;

      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);
      mockPrismaService.auditLog.count.mockResolvedValue(1);

      const result = await service.queryAuditLogs(query);

      expect(result).toEqual({
        logs: mockLogs,
        total: 1,
      });

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          resource: 'job',
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
        take: 10,
        skip: 0,
      });
    });
  });

  describe('getResourceHistory', () => {
    it('should get audit history for a specific resource', async () => {
      const resource = 'job';
      const resourceId = 'job-123';
      const limit = 50;

      const mockLogs = [
        {
          id: 'audit-1',
          action: 'job.created',
          resource,
          resourceId,
          timestamp: new Date(),
        },
        {
          id: 'audit-2',
          action: 'job.updated',
          resource,
          resourceId,
          timestamp: new Date(),
        },
      ] as const;

      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getResourceHistory(
        resource,
        resourceId,
        limit,
      );

      expect(result).toEqual(mockLogs);
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
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
    });
  });
});
