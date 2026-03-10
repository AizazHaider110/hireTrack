import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { CacheService } from './common/cache/cache.service';
import { QueueService } from './events/queue.service';
import { MetricsService } from './common/monitoring/metrics.service';

describe('AppController', () => {
  let appController: AppController;

  const mockPrismaService = {
    healthCheck: jest.fn().mockResolvedValue({ status: 'healthy', latency: 5 }),
  };

  const mockCacheService = {
    getStats: jest.fn().mockResolvedValue({
      connected: true,
      memoryUsage: '1MB',
      keyCount: 10,
    }),
  };

  const mockQueueService = {
    getQueueMetrics: jest.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 100,
      failed: 0,
    }),
  };

  const mockMetricsService = {
    getAllMetrics: jest.fn().mockResolvedValue({
      request: {
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        averageResponseTime: 50,
        successRate: '95%',
        topEndpoints: [],
        statusCodeDistribution: [],
      },
      system: {
        uptime: 1000,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        timestamp: new Date(),
      },
    }),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: QueueService, useValue: mockQueueService },
        { provide: MetricsService, useValue: mockMetricsService },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('should return health status', async () => {
      const result = await appController.getHealth();
      expect(result.status).toBe('healthy');
      expect(result.services.database.status).toBe('healthy');
      expect(result.services.cache.status).toBe('healthy');
    });
  });

  describe('metrics', () => {
    it('should return metrics', async () => {
      const result = await appController.getMetrics();
      expect(result.request.totalRequests).toBe(100);
      expect(result.system.uptime).toBe(1000);
    });
  });
});
