import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { AuditService } from './audit.service';
import { Reflector } from '@nestjs/core';

// Decorator to mark methods that should be audited
export const AUDIT_KEY = 'audit';
export const Audit = (resource: string, action?: string) =>
  SetMetadata(AUDIT_KEY, { resource, action });

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditConfig = this.reflector.get(AUDIT_KEY, context.getHandler());

    // Skip if no audit configuration
    if (!auditConfig) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();

    // Skip if no authenticated user
    if (!request.user?.id) {
      return next.handle();
    }

    const startTime = Date.now();
    const { resource, action } = auditConfig;
    const httpMethod = request.method;
    const url = request.url;
    const userAgent = request.get('User-Agent');
    const ipAddress = this.getClientIp(request);

    // Determine action if not provided
    const auditAction = action || this.determineAction(httpMethod, resource);

    // Extract resource ID from request
    const resourceId = this.extractResourceId(request, resource);

    return next.handle().pipe(
      tap(async (responseData) => {
        try {
          const duration = Date.now() - startTime;

          // Create audit log for successful operations
          await this.auditService.createAuditLog({
            userId: request.user!.id,
            action: auditAction,
            resource,
            resourceId: resourceId || 'unknown',
            after: this.sanitizeResponseData(responseData),
            metadata: {
              httpMethod,
              url,
              statusCode: response.statusCode,
              duration,
              success: true,
            },
            ipAddress,
            userAgent,
          });

          this.logger.debug(
            `Audit logged: ${auditAction} on ${resource}:${resourceId} by user ${request.user!.id}`,
          );
        } catch (error) {
          this.logger.error('Failed to create audit log:', error);
        }
      }),
      catchError(async (error) => {
        try {
          const duration = Date.now() - startTime;

          // Create audit log for failed operations
          await this.auditService.createAuditLog({
            userId: request.user!.id,
            action: `${auditAction}.failed`,
            resource,
            resourceId: resourceId || 'unknown',
            metadata: {
              httpMethod,
              url,
              statusCode: response.statusCode || 500,
              duration,
              success: false,
              error: error.message,
            },
            ipAddress,
            userAgent,
          });

          this.logger.debug(
            `Audit logged (failed): ${auditAction} on ${resource}:${resourceId} by user ${request.user!.id}`,
          );
        } catch (auditError) {
          this.logger.error(
            'Failed to create audit log for error:',
            auditError,
          );
        }

        throw error;
      }),
    );
  }

  private determineAction(httpMethod: string, resource: string): string {
    switch (httpMethod.toUpperCase()) {
      case 'POST':
        return `${resource}.created`;
      case 'PUT':
      case 'PATCH':
        return `${resource}.updated`;
      case 'DELETE':
        return `${resource}.deleted`;
      case 'GET':
        return `${resource}.accessed`;
      default:
        return `${resource}.action`;
    }
  }

  private extractResourceId(
    request: AuthenticatedRequest,
    resource: string,
  ): string | null {
    // Try to extract ID from URL parameters
    if (request.params?.id) {
      return request.params.id;
    }

    // Try to extract from common parameter names
    const commonIdParams = [
      `${resource}Id`,
      `${resource}_id`,
      'resourceId',
      'id',
    ];

    for (const param of commonIdParams) {
      if (request.params?.[param]) {
        return request.params[param];
      }
      if (request.query?.[param]) {
        return request.query[param] as string;
      }
    }

    // Try to extract from request body for POST requests
    if (request.method === 'POST' && request.body?.id) {
      return request.body.id;
    }

    return null;
  }

  private sanitizeResponseData(data: any): any {
    if (!data) return null;

    // Remove sensitive fields from audit logs
    const sensitiveFields = ['password', 'token', 'secret', 'key'];

    if (typeof data === 'object') {
      const sanitized = { ...data };

      for (const field of sensitiveFields) {
        if (sanitized[field]) {
          sanitized[field] = '[REDACTED]';
        }
      }

      // Limit size of audit data to prevent large payloads
      const jsonString = JSON.stringify(sanitized);
      if (jsonString.length > 10000) {
        return { message: 'Response data too large for audit log' };
      }

      return sanitized;
    }

    return data;
  }

  private getClientIp(request: Request): string {
    return ((request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      'unknown') as string;
  }
}
