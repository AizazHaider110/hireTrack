import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const RATE_LIMIT_KEY = 'rate_limit';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly rateLimitStore: Map<string, RateLimitEntry> = new Map();
  private readonly DEFAULT_RATE_LIMIT = 100; // requests per minute
  private readonly WINDOW_MS = 60 * 1000; // 1 minute

  constructor(private readonly reflector: Reflector) {
    // Clean up expired entries every minute
    setInterval(() => this.cleanupExpiredEntries(), this.WINDOW_MS);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Get rate limit from decorator, API key, or use default
    const decoratorLimit = this.reflector.get<number>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );
    const apiKeyLimit = request.apiKey?.rateLimit;
    const rateLimit = decoratorLimit || apiKeyLimit || this.DEFAULT_RATE_LIMIT;

    // Create unique key for rate limiting
    const identifier = this.getIdentifier(request);
    const key = `${identifier}:${context.getHandler().name}`;

    const now = Date.now();
    let entry = this.rateLimitStore.get(key);

    // Initialize or reset entry if window has passed
    if (!entry || entry.resetAt <= now) {
      entry = {
        count: 0,
        resetAt: now + this.WINDOW_MS,
      };
    }

    entry.count++;
    this.rateLimitStore.set(key, entry);

    // Calculate remaining requests
    const remaining = Math.max(0, rateLimit - entry.count);
    const resetAt = new Date(entry.resetAt);

    // Set rate limit headers
    response.setHeader('X-RateLimit-Limit', rateLimit);
    response.setHeader('X-RateLimit-Remaining', remaining);
    response.setHeader('X-RateLimit-Reset', resetAt.toISOString());

    // Check if rate limit exceeded
    if (entry.count > rateLimit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      response.setHeader('Retry-After', retryAfter);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded',
          error: 'Too Many Requests',
          retryAfter,
          limit: rateLimit,
          resetAt: resetAt.toISOString(),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private getIdentifier(request: any): string {
    // Use API key ID if available
    if (request.apiKey?.id) {
      return `apikey:${request.apiKey.id}`;
    }

    // Use user ID if authenticated
    if (request.user?.id) {
      return `user:${request.user.id}`;
    }

    // Fall back to IP address
    const ip =
      request.headers['x-forwarded-for']?.split(',')[0] ||
      request.connection?.remoteAddress ||
      request.ip ||
      'unknown';

    return `ip:${ip}`;
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    for (const [key, entry] of this.rateLimitStore.entries()) {
      if (entry.resetAt <= now) {
        this.rateLimitStore.delete(key);
      }
    }
  }
}

// Decorator for setting custom rate limits
export const RateLimit = (limit: number) => SetMetadata(RATE_LIMIT_KEY, limit);

import { SetMetadata } from '@nestjs/common';
