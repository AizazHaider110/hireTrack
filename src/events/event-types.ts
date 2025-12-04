/**
 * System event types for internal event bus
 */
export enum SystemEventType {
  // Application events
  CANDIDATE_APPLIED = 'candidate.applied',
  APPLICATION_UPDATED = 'application.updated',
  APPLICATION_WITHDRAWN = 'application.withdrawn',

  // Pipeline events
  CANDIDATE_STAGE_CHANGED = 'candidate.stage_changed',
  CANDIDATE_MOVED = 'candidate.moved',
  PIPELINE_CREATED = 'pipeline.created',

  // Interview events
  INTERVIEW_SCHEDULED = 'interview.scheduled',
  INTERVIEW_UPDATED = 'interview.updated',
  INTERVIEW_CANCELLED = 'interview.cancelled',
  INTERVIEW_COMPLETED = 'interview.completed',
  INTERVIEW_RESCHEDULED = 'interview.rescheduled',

  // Offer events
  OFFER_SENT = 'offer.sent',
  OFFER_ACCEPTED = 'offer.accepted',
  OFFER_REJECTED = 'offer.rejected',

  // Candidate events
  CANDIDATE_REJECTED = 'candidate.rejected',
  CANDIDATE_HIRED = 'candidate.hired',

  // Feedback events
  FEEDBACK_SUBMITTED = 'feedback.submitted',
  RATING_UPDATED = 'rating.updated',

  // Job events
  JOB_POSTED = 'job.posted',
  JOB_UPDATED = 'job.updated',
  JOB_CLOSED = 'job.closed',

  // User events
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',

  // Team events
  TEAM_CREATED = 'team.created',
  TEAM_MEMBER_ADDED = 'team.member_added',
  TEAM_MEMBER_REMOVED = 'team.member_removed',
}

/**
 * Queue names for background job processing
 */
export enum QueueName {
  EMAIL = 'email',
  RESUME_PARSING = 'resume-parsing',
  NOTIFICATIONS = 'notifications',
  WEBHOOKS = 'webhooks',
  ANALYTICS = 'analytics',
  AI_SCORING = 'ai-scoring',
}

/**
 * Job names for queue processing
 */
export enum JobName {
  // Email jobs
  SEND_EMAIL = 'send-email',
  SEND_BULK_EMAIL = 'send-bulk-email',

  // Resume parsing jobs
  PARSE_RESUME = 'parse-resume',

  // Notification jobs
  SEND_NOTIFICATION = 'send-notification',
  SEND_INTERVIEW_INVITATION = 'send-interview-invitation',
  SEND_APPLICATION_CONFIRMATION = 'send-application-confirmation',
  SEND_REJECTION_EMAIL = 'send-rejection-email',
  SEND_OFFER_EMAIL = 'send-offer-email',

  // Webhook jobs
  DELIVER_WEBHOOK = 'deliver-webhook',

  // Analytics jobs
  UPDATE_JOB_ANALYTICS = 'update-job-analytics',
  CALCULATE_FUNNEL_METRICS = 'calculate-funnel-metrics',

  // AI scoring jobs
  SCORE_CANDIDATE = 'score-candidate',
  MATCH_CANDIDATES = 'match-candidates',
}
