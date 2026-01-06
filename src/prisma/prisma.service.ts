import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'query' | 'error' | 'warn'>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly enableQueryLogging: boolean;
  private readonly slowQueryThreshold: number;

  constructor() {
    const enableLogging = process.env.ENABLE_QUERY_LOGGING === 'true';
    const logLevels: Prisma.LogLevel[] = enableLogging
      ? ['query', 'error', 'warn']
      : ['error', 'warn'];

    super({
      datasourceUrl: process.env.DATABASE_URL,
      log: logLevels.map((level) => ({
        emit: 'event',
        level,
      })) as Prisma.LogDefinition[],
    });

    this.enableQueryLogging = enableLogging;
    this.slowQueryThreshold = parseInt(
      process.env.SLOW_QUERY_THRESHOLD_MS || '1000',
      10,
    );
  }

  async onModuleInit() {
    // Set up query logging
    if (this.enableQueryLogging) {
      this.$on('query', (e: Prisma.QueryEvent) => {
        const duration = e.duration;
        if (duration >= this.slowQueryThreshold) {
          this.logger.warn(
            `SLOW QUERY (${duration}ms): ${e.query} - Params: ${e.params}`,
          );
        } else {
          this.logger.debug(`Query (${duration}ms): ${e.query}`);
        }
      });
    }

    // Set up error logging
    this.$on('error', (e: Prisma.LogEvent) => {
      this.logger.error(`Database error: ${e.message}`);
    });

    // Set up warning logging
    this.$on('warn', (e: Prisma.LogEvent) => {
      this.logger.warn(`Database warning: ${e.message}`);
    });

    await this.$connect();
    this.logger.log('Database connection established');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }

  /**
   * Execute a raw query with performance logging
   */
  async executeRaw<T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: any[]
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await this.$queryRaw<T>(query, ...values);
      const duration = Date.now() - startTime;
      if (duration >= this.slowQueryThreshold) {
        this.logger.warn(`SLOW RAW QUERY (${duration}ms)`);
      }
      return result;
    } catch (error) {
      this.logger.error('Raw query execution failed:', error);
      throw error;
    }
  }

  /**
   * Health check for database connection
   */
  async healthCheck(): Promise<{ status: string; latency: number }> {
    const startTime = Date.now();
    try {
      await this.$queryRaw`SELECT 1`;
      const latency = Date.now() - startTime;
      return { status: 'healthy', latency };
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return { status: 'unhealthy', latency: -1 };
    }
  }

  /**
   * Clean up soft-deleted records older than specified days
   */
  async cleanupSoftDeleted(
    tableName: string,
    days: number = 30,
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    try {
      const result = await this.$executeRaw`
        DELETE FROM ${Prisma.raw(`"${tableName}"`)} 
        WHERE "deletedAt" IS NOT NULL 
        AND "deletedAt" < ${cutoffDate}
      `;
      this.logger.log(
        `Cleaned up ${result} soft-deleted records from ${tableName}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Cleanup failed for ${tableName}:`, error);
      return 0;
    }
  }
}
