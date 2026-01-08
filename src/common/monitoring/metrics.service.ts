import { Injectable, Logger } from '@nestjs/common';

export interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  requestsByEndpoint: Map<string, number>;
  requestsByStatusCode: Map<number, number>;
}

export interface SystemMetrics {
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  timestamp: Date;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private totalRequests = 0;
  private successfulRequests = 0;
  private failedRequests = 0;
  private totalResponseTime = 0;
  private requestsByEndpoint = new Map<string, number>();
  private requestsByStatusCode = new Map<number, number>();
  private lastCpuUsage: NodeJS.CpuUsage | null = null;

  /**
   * Record a request metric
   */
  recordRequest(
    endpoint: string,
    statusCode: number,
    responseTime: number,
  ): void {
    this.totalRequests++;
    this.totalResponseTime += responseTime;

    if (statusCode >= 200 && statusCode < 400) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
    }

    // Track by endpoint
    const currentEndpointCount = this.requestsByEndpoint.get(endpoint) || 0;
    this.requestsByEndpoint.set(endpoint, currentEndpointCount + 1);

    // Track by status code
    const currentStatusCount = this.requestsByStatusCode.get(statusCode) || 0;
    this.requestsByStatusCode.set(statusCode, currentStatusCount + 1);
  }

  /**
   * Get request metrics
   */
  getRequestMetrics(): RequestMetrics {
    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      averageResponseTime:
        this.totalRequests > 0
          ? Math.round(this.totalResponseTime / this.totalRequests)
          : 0,
      requestsByEndpoint: new Map(this.requestsByEndpoint),
      requestsByStatusCode: new Map(this.requestsByStatusCode),
    };
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(): SystemMetrics {
    const currentCpuUsage = process.cpuUsage(this.lastCpuUsage || undefined);
    this.lastCpuUsage = process.cpuUsage();

    return {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: currentCpuUsage,
      timestamp: new Date(),
    };
  }

  /**
   * Get all metrics as a serializable object
   */
  getAllMetrics(): {
    request: {
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      averageResponseTime: number;
      successRate: string;
      topEndpoints: Array<{ endpoint: string; count: number }>;
      statusCodeDistribution: Array<{ statusCode: number; count: number }>;
    };
    system: SystemMetrics;
  } {
    const requestMetrics = this.getRequestMetrics();
    const systemMetrics = this.getSystemMetrics();

    // Convert maps to arrays for serialization
    const topEndpoints = Array.from(requestMetrics.requestsByEndpoint.entries())
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const statusCodeDistribution = Array.from(
      requestMetrics.requestsByStatusCode.entries(),
    )
      .map(([statusCode, count]) => ({ statusCode, count }))
      .sort((a, b) => a.statusCode - b.statusCode);

    const successRate =
      requestMetrics.totalRequests > 0
        ? (
            (requestMetrics.successfulRequests / requestMetrics.totalRequests) *
            100
          ).toFixed(2)
        : '0.00';

    return {
      request: {
        totalRequests: requestMetrics.totalRequests,
        successfulRequests: requestMetrics.successfulRequests,
        failedRequests: requestMetrics.failedRequests,
        averageResponseTime: requestMetrics.averageResponseTime,
        successRate: `${successRate}%`,
        topEndpoints,
        statusCodeDistribution,
      },
      system: systemMetrics,
    };
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.totalResponseTime = 0;
    this.requestsByEndpoint.clear();
    this.requestsByStatusCode.clear();
    this.logger.log('Metrics reset');
  }
}
