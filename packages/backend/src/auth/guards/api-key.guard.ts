import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

export const API_KEY_SCOPES = 'api_key_scopes';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    // Hash the API key to compare with stored hash
    const keyHash = this.hashApiKey(apiKey);

    // Find the API key in database
    const apiKeyRecord = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });

    if (!apiKeyRecord) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (!apiKeyRecord.isActive) {
      throw new UnauthorizedException('API key is inactive');
    }

    if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    // Check required scopes
    const requiredScopes = this.reflector.get<string[]>(
      API_KEY_SCOPES,
      context.getHandler(),
    );

    if (requiredScopes && requiredScopes.length > 0) {
      const hasRequiredScopes = requiredScopes.every(
        (scope) =>
          apiKeyRecord.scopes.includes(scope) ||
          apiKeyRecord.scopes.includes('admin'),
      );

      if (!hasRequiredScopes) {
        throw new ForbiddenException('Insufficient API key scopes');
      }
    }

    // Update last used timestamp (async, don't wait)
    this.prisma.apiKey
      .update({
        where: { id: apiKeyRecord.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {
        // Ignore errors updating last used
      });

    // Attach API key info and user to request
    request.apiKey = {
      id: apiKeyRecord.id,
      name: apiKeyRecord.name,
      scopes: apiKeyRecord.scopes,
      rateLimit: apiKeyRecord.rateLimit,
    };
    request.user = apiKeyRecord.user;

    return true;
  }

  private extractApiKey(request: any): string | null {
    // Check Authorization header (Bearer token style)
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check X-API-Key header
    const apiKeyHeader = request.headers['x-api-key'];
    if (apiKeyHeader) {
      return apiKeyHeader;
    }

    // Check query parameter (not recommended for production)
    const queryApiKey = request.query.api_key;
    if (queryApiKey) {
      return queryApiKey;
    }

    return null;
  }

  private hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }
}
