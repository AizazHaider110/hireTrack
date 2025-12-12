import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventBusService, SystemEvent } from '../events/event-bus.service';
import { AuditService } from './audit.service';
import { SystemEventType } from '../events/event-types';

@Injectable()
export class AuditEventListener implements OnModuleInit {
  private readonly logger = new Logger(AuditEventListener.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly auditService: AuditService,
  ) {}

  onModuleInit() {
    this.subscribeToEvents();
  }

  private subscribeToEvents() {
    // Subscribe to all system events using pattern matching
    this.eventBus.subscribePattern(/.+/, this.handleSystemEvent.bind(this));
    this.logger.log(
      'Audit event listener initialized and subscribed to all events',
    );
  }

  private async handleSystemEvent(event: SystemEvent) {
    try {
      // Extract user information from event payload or metadata
      const userId = this.extractUserId(event);
      if (!userId) {
        // Skip events without user context
        return;
      }

      // Map event type to audit action and resource
      const { action, resource, resourceId } = this.mapEventToAudit(event);
      if (!action || !resource || !resourceId) {
        // Skip events that don't map to auditable actions
        return;
      }

      // Extract before/after states if available
      const { before, after } = this.extractStates(event);

      // Create audit log entry
      await this.auditService.createAuditLog({
        userId,
        action,
        resource,
        resourceId,
        before,
        after,
        metadata: {
          eventType: event.type,
          timestamp: event.timestamp,
          ...event.metadata,
        },
      });

      this.logger.debug(`Audit log created for event: ${event.type}`);
    } catch (error) {
      this.logger.error(
        `Failed to create audit log for event ${event.type}:`,
        error,
      );
    }
  }

  private extractUserId(event: SystemEvent): string | null {
    // Try to extract user ID from various places in the event
    if (event.payload?.userId) {
      return event.payload.userId;
    }
    if (event.payload?.user?.id) {
      return event.payload.user.id;
    }
    if (event.payload?.createdBy) {
      return event.payload.createdBy;
    }
    if (event.payload?.updatedBy) {
      return event.payload.updatedBy;
    }
    if (event.metadata?.userId) {
      return event.metadata.userId;
    }
    return null;
  }

  private mapEventToAudit(event: SystemEvent): {
    action: string;
    resource: string;
    resourceId: string;
  } {
    const eventType = event.type;
    const payload = event.payload;

    // Map event types to audit actions and resources
    switch (eventType) {
      case SystemEventType.CANDIDATE_APPLIED:
        return {
          action: 'application.created',
          resource: 'application',
          resourceId: payload.applicationId || payload.id,
        };

      case SystemEventType.APPLICATION_UPDATED:
        return {
          action: 'application.updated',
          resource: 'application',
          resourceId: payload.applicationId || payload.id,
        };

      case SystemEventType.APPLICATION_WITHDRAWN:
        return {
          action: 'application.withdrawn',
          resource: 'application',
          resourceId: payload.applicationId || payload.id,
        };

      case SystemEventType.CANDIDATE_STAGE_CHANGED:
        return {
          action: 'candidate.stage_changed',
          resource: 'candidate',
          resourceId: payload.candidateId || payload.id,
        };

      case SystemEventType.CANDIDATE_MOVED:
        return {
          action: 'candidate.moved',
          resource: 'candidate',
          resourceId: payload.candidateId || payload.id,
        };

      case SystemEventType.PIPELINE_CREATED:
        return {
          action: 'pipeline.created',
          resource: 'pipeline',
          resourceId: payload.pipelineId || payload.id,
        };

      case SystemEventType.INTERVIEW_SCHEDULED:
        return {
          action: 'interview.scheduled',
          resource: 'interview',
          resourceId: payload.interviewId || payload.id,
        };

      case SystemEventType.INTERVIEW_UPDATED:
        return {
          action: 'interview.updated',
          resource: 'interview',
          resourceId: payload.interviewId || payload.id,
        };

      case SystemEventType.INTERVIEW_CANCELLED:
        return {
          action: 'interview.cancelled',
          resource: 'interview',
          resourceId: payload.interviewId || payload.id,
        };

      case SystemEventType.INTERVIEW_COMPLETED:
        return {
          action: 'interview.completed',
          resource: 'interview',
          resourceId: payload.interviewId || payload.id,
        };

      case SystemEventType.INTERVIEW_RESCHEDULED:
        return {
          action: 'interview.rescheduled',
          resource: 'interview',
          resourceId: payload.interviewId || payload.id,
        };

      case SystemEventType.OFFER_SENT:
        return {
          action: 'offer.sent',
          resource: 'candidate',
          resourceId: payload.candidateId || payload.id,
        };

      case SystemEventType.OFFER_ACCEPTED:
        return {
          action: 'offer.accepted',
          resource: 'candidate',
          resourceId: payload.candidateId || payload.id,
        };

      case SystemEventType.OFFER_REJECTED:
        return {
          action: 'offer.rejected',
          resource: 'candidate',
          resourceId: payload.candidateId || payload.id,
        };

      case SystemEventType.CANDIDATE_REJECTED:
        return {
          action: 'candidate.rejected',
          resource: 'candidate',
          resourceId: payload.candidateId || payload.id,
        };

      case SystemEventType.CANDIDATE_HIRED:
        return {
          action: 'candidate.hired',
          resource: 'candidate',
          resourceId: payload.candidateId || payload.id,
        };

      case SystemEventType.FEEDBACK_SUBMITTED:
        return {
          action: 'feedback.created',
          resource: 'feedback',
          resourceId: payload.feedbackId || payload.id,
        };

      case SystemEventType.RATING_UPDATED:
        return {
          action: 'rating.updated',
          resource: 'feedback',
          resourceId: payload.feedbackId || payload.id,
        };

      case SystemEventType.JOB_POSTED:
        return {
          action: 'job.created',
          resource: 'job',
          resourceId: payload.jobId || payload.id,
        };

      case SystemEventType.JOB_UPDATED:
        return {
          action: 'job.updated',
          resource: 'job',
          resourceId: payload.jobId || payload.id,
        };

      case SystemEventType.JOB_CLOSED:
        return {
          action: 'job.closed',
          resource: 'job',
          resourceId: payload.jobId || payload.id,
        };

      case SystemEventType.USER_CREATED:
        return {
          action: 'user.created',
          resource: 'user',
          resourceId: payload.userId || payload.id,
        };

      case SystemEventType.USER_UPDATED:
        return {
          action: 'user.updated',
          resource: 'user',
          resourceId: payload.userId || payload.id,
        };

      case SystemEventType.USER_DELETED:
        return {
          action: 'user.deleted',
          resource: 'user',
          resourceId: payload.userId || payload.id,
        };

      case SystemEventType.TEAM_CREATED:
        return {
          action: 'team.created',
          resource: 'team',
          resourceId: payload.teamId || payload.id,
        };

      case SystemEventType.TEAM_MEMBER_ADDED:
        return {
          action: 'team.member_added',
          resource: 'team',
          resourceId: payload.teamId || payload.id,
        };

      case SystemEventType.TEAM_MEMBER_REMOVED:
        return {
          action: 'team.member_removed',
          resource: 'team',
          resourceId: payload.teamId || payload.id,
        };

      default:
        // Return empty for unknown events
        return {
          action: '',
          resource: '',
          resourceId: '',
        };
    }
  }

  private extractStates(event: SystemEvent): {
    before?: any;
    after?: any;
  } {
    const payload = event.payload;

    return {
      before: payload.before || payload.oldData || payload.previousState,
      after:
        payload.after ||
        payload.newData ||
        payload.currentState ||
        payload.data,
    };
  }
}
