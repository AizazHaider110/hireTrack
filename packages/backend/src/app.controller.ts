import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { CacheService } from './common/cache/cache.service';
import { QueueService } from './events/queue.service';
import { MetricsService } from './common/monitoring/metrics.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
    private readonly queueService: QueueService,
    private readonly metricsService: MetricsService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async getHealth(): Promise<{
    status: string;
    timestamp: string;
    services: {
      database: { status: string; latency: number };
      cache: {
        status: string;
        connected: boolean;
        memoryUsage: string;
        keyCount: number;
      };
      queues: { email: any; webhook: any };
    };
  }> {
    const [dbHealth, cacheStats, emailQueueMetrics, webhookQueueMetrics] =
      await Promise.all([
        this.prismaService.healthCheck(),
        this.cacheService.getStats(),
        this.queueService.getQueueMetrics('email').catch(() => null),
        this.queueService.getQueueMetrics('webhook').catch(() => null),
      ]);

    const allHealthy = dbHealth.status === 'healthy' && cacheStats.connected;

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth,
        cache: {
          status: cacheStats.connected ? 'healthy' : 'unhealthy',
          ...cacheStats,
        },
        queues: {
          email: emailQueueMetrics || { status: 'unavailable' },
          webhook: webhookQueueMetrics || { status: 'unavailable' },
        },
      },
    };
  }

  @Get('metrics')
  async getMetrics(): Promise<{
    request: {
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      averageResponseTime: number;
      successRate: string;
      topEndpoints: Array<{ endpoint: string; count: number }>;
      statusCodeDistribution: Array<{ statusCode: number; count: number }>;
    };
    system: {
      uptime: number;
      memoryUsage: NodeJS.MemoryUsage;
      cpuUsage: NodeJS.CpuUsage;
      timestamp: Date;
    };
  }> {
    return this.metricsService.getAllMetrics();
  }

  @Get('metrics/system')
  getSystemMetrics(): {
    uptime: number;
    memory: NodeJS.MemoryUsage;
    timestamp: string;
  } {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };
  }
}
