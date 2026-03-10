import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from '../monitoring/metrics.service';

export interface PerformanceMetrics {
  path: string;
  method: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
}

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger('PerformanceMonitor');
  private readonly slowThreshold: number;
  private readonly enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    this.slowThreshold = this.configService.get<number>(
      'SLOW_QUERY_THRESHOLD_MS',
      1000,
    );
    this.enabled = this.configService.get<boolean>(
      'ENABLE_PERFORMANCE_METRICS',
      true,
    );
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.enabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const { method, url, path } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;
          const endpoint = path || url;

          this.logPerformance({
            path: endpoint,
            method,
            statusCode,
            duration,
            timestamp: new Date(),
          });

          // Record metrics
          this.metricsService.recordRequest(
            `${method} ${endpoint}`,
            statusCode,
            duration,
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || 500;
          const endpoint = path || url;

          this.logPerformance({
            path: endpoint,
            method,
            statusCode,
            duration,
            timestamp: new Date(),
          });

          // Record metrics
          this.metricsService.recordRequest(
            `${method} ${endpoint}`,
            statusCode,
            duration,
          );
        },
      }),
    );
  }

  private logPerformance(metrics: PerformanceMetrics): void {
    const { path, method, statusCode, duration } = metrics;

    if (duration >= this.slowThreshold) {
      this.logger.warn(
        `SLOW REQUEST: ${method} ${path} - ${statusCode} - ${duration}ms`,
      );
    } else {
      this.logger.debug(`${method} ${path} - ${statusCode} - ${duration}ms`);
    }
  }
}
