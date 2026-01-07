import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis;
  private readonly defaultTtl: number;
  private readonly defaultPrefix: string = 'ats:cache:';

  constructor(private readonly configService: ConfigService) {
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    this.redis = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword || undefined,
      maxRetriesPerRequest: 3,
    });

    this.defaultTtl = this.configService.get<number>('CACHE_TTL', 300);

    this.redis.on('error', (err) => {
      this.logger.error('Redis cache connection error:', err);
    });

    this.redis.on('connect', () => {
      this.logger.log(`Cache connected to Redis at ${redisHost}:${redisPort}`);
    });
  }

  /**
   * Build cache key with prefix
   */
  private buildKey(key: string, prefix?: string): string {
    return `${prefix || this.defaultPrefix}${key}`;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      const value = await this.redis.get(cacheKey);

      if (value) {
        this.logger.debug(`Cache hit: ${cacheKey}`);
        return JSON.parse(value) as T;
      }

      this.logger.debug(`Cache miss: ${cacheKey}`);
      return null;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(
    key: string,
    value: T,
    options?: CacheOptions,
  ): Promise<boolean> {
    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      const ttl = options?.ttl || this.defaultTtl;
      const serialized = JSON.stringify(value);

      await this.redis.setex(cacheKey, ttl, serialized);
      this.logger.debug(`Cache set: ${cacheKey} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get or set value (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, options?: CacheOptions): Promise<boolean> {
    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      await this.redis.del(cacheKey);
      this.logger.debug(`Cache delete: ${cacheKey}`);
      return true;
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async deleteByPattern(
    pattern: string,
    options?: CacheOptions,
  ): Promise<number> {
    try {
      const cachePattern = this.buildKey(pattern, options?.prefix);
      const keys = await this.redis.keys(cachePattern);

      if (keys.length === 0) {
        return 0;
      }

      const deleted = await this.redis.del(...keys);
      this.logger.debug(
        `Cache delete by pattern: ${cachePattern} (${deleted} keys)`,
      );
      return deleted;
    } catch (error) {
      this.logger.error(`Cache delete by pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string, options?: CacheOptions): Promise<boolean> {
    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      const exists = await this.redis.exists(cacheKey);
      return exists === 1;
    } catch (error) {
      this.logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Increment a numeric value
   */
  async increment(key: string, options?: CacheOptions): Promise<number> {
    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      const value = await this.redis.incr(cacheKey);

      if (options?.ttl) {
        await this.redis.expire(cacheKey, options.ttl);
      }

      return value;
    } catch (error) {
      this.logger.error(`Cache increment error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    memoryUsage: string;
    keyCount: number;
  }> {
    try {
      const info = await this.redis.info('memory');
      const memoryMatch = info.match(/used_memory_human:(\S+)/);
      const keyCount = await this.redis.dbsize();

      return {
        connected: this.redis.status === 'ready',
        memoryUsage: memoryMatch ? memoryMatch[1] : 'unknown',
        keyCount,
      };
    } catch (error) {
      this.logger.error('Cache stats error:', error);
      return {
        connected: false,
        memoryUsage: 'unknown',
        keyCount: 0,
      };
    }
  }

  /**
   * Clear all cache entries with the default prefix
   */
  async clear(): Promise<number> {
    return this.deleteByPattern('*');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing cache Redis connection...');
    await this.redis.quit();
  }
}
