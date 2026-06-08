import { useState } from 'react';
import {
  Calendar,
  Clock,
  Video,
  Phone,
  Users,
  MapPin,
  Link,
  User,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Edit,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { Interview, InterviewType, InterviewStatus } from '@ats/types';

interface InterviewDetailProps {
  interview: Interview;
  onReschedule?: () => void;
  onCancel?: (reason?: string) => void;
  onSubmitFeedback?: () => void;
  isLoading?: boolean;
}

const TYPE_ICONS: Record<InterviewType, React.ComponentType<{ className?: string }>> = {
  PHONE: Phone,
  VIDEO: Video,
  ONSITE: MapPin,
  PANEL: Users,
};

const TYPE_LABELS: Record<InterviewType, string> = {
  PHONE: 'Phone Screen',
  VIDEO: 'Video Call',
  ONSITE: 'On-site Interview',
  PANEL: 'Panel Interview',
};

const STATUS_CONFIG: Record<
  InterviewStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ComponentType<{ className?: string }> }
> = {
  SCHEDULED: { label: 'Scheduled', variant: 'default', icon: Calendar },
  COMPLETED: { label: 'Completed', variant: 'secondary', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelled', variant: 'destructive', icon: XCircle },
  NO_SHOW: { label: 'No Show', variant: 'outline', icon: AlertTriangle },
};

const ROLE_LABELS: Record<string, string> = {
  INTERVIEWER: 'Interviewer',
  ORGANIZER: 'Organizer',
  OBSERVER: 'Observer',
};

function formatDateTime(dateStr: string, timezone?: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h} hour${h > 1 ? 's' : ''}`;
}

export function InterviewDetail({
  interview,
  onReschedule,
  onCancel,
  onSubmitFeedback,
  isLoading = false,
}: InterviewDetailProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const TypeIcon = TYPE_ICONS[interview.type] || Calendar;
  const statusConfig = STATUS_CONFIG[interview.status];
  const StatusIcon = statusConfig.icon;

  const isUpcoming =
    interview.status === 'SCHEDULED' && new Date(interview.scheduledAt) > new Date();
  const isPast =
    interview.status === 'SCHEDULED' && new Date(interview.scheduledAt) <= new Date();
  const canSubmitFeedback =
    interview.status === 'COMPLETED' || isPast;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-muted">
            <TypeIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{TYPE_LABELS[interview.type]}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={statusConfig.variant} className="gap-1">
                <StatusIcon className="h-3 w-3" />
                {statusConfig.label}
              </Badge>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {canSubmitFeedback && onSubmitFeedback && (
            <Button size="sm" onClick={onSubmitFeedback} disabled={isLoading}>
              <FileText className="h-4 w-4 mr-1.5" />
              Submit Feedback
            </Button>
          )}
          {isUpcoming && onReschedule && (
            <Button
              size="sm"
              variant="outline"
              onClick={onReschedule}
              disabled={isLoading}
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Reschedule
            </Button>
          )}
          {isUpcoming && onCancel && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCancelDialog(true)}
              disabled={isLoading}
              className="text-destructive hover:text-destructive"
            >
              <XCircle className="h-4 w-4 mr-1.5" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Date & Time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex items-start gap-3">
          <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Date & Time
            </p>
            <p className="text-sm font-medium mt-0.5">
              {formatDateTime(interview.scheduledAt, interview.timezone)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{interview.timezone}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Clock className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Duration
            </p>
            <p className="text-sm font-medium mt-0.5">{formatDuration(interview.duration)}</p>
          </div>
        </div>

        {interview.location && (
          <div className="flex items-start gap-3">
            <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Location
              </p>
              <p className="text-sm font-medium mt-0.5">{interview.location}</p>
            </div>
          </div>
        )}

        {interview.meetingLink && (
          <div className="flex items-start gap-3">
            <Link className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Meeting Link
              </p>
              <a
                href={interview.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary hover:underline mt-0.5 block truncate max-w-[200px]"
              >
                {interview.meetingLink}
              </a>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Participants */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Participants ({interview.participants.length})
        </h3>
        <div className="space-y-2">
          {interview.participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No participants added</p>
          ) : (
            interview.participants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                    {participant.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{participant.name}</p>
                    <p className="text-xs text-muted-foreground">{participant.email}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {ROLE_LABELS[participant.role] || participant.role}
                </Badge>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Agenda */}
      {interview.agenda && (
        <>
          <Separator />
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Agenda
            </h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {interview.agenda}
            </p>
          </div>
        </>
      )}

      {/* Feedback Summary */}
      {interview.feedback && interview.feedback.length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="text-sm font-semibold mb-3">
              Feedback ({interview.feedback.length})
            </h3>
            <div className="space-y-3">
              {interview.feedback.map((fb) => (
                <div key={fb.id} className="p-3 rounded-md border space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">Interviewer</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span
                            key={i}
                            className={cn(
                              'text-sm',
                              i < fb.rating ? 'text-yellow-400' : 'text-muted-foreground/30'
                            )}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                      <RecommendationBadge recommendation={fb.recommendation} />
                    </div>
                  </div>
                  {fb.notes && (
                    <p className="text-xs text-muted-foreground">{fb.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Interview</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this interview? Participants will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Interview</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowCancelDialog(false);
                onCancel?.();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel Interview
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RecommendationBadge({ recommendation }: { recommendation: string }) {
  const config: Record<string, { label: string; className: string }> = {
    STRONG_YES: { label: 'Strong Yes', className: 'bg-green-100 text-green-800' },
    YES: { label: 'Yes', className: 'bg-emerald-100 text-emerald-800' },
    NEUTRAL: { label: 'Neutral', className: 'bg-gray-100 text-gray-800' },
    NO: { label: 'No', className: 'bg-red-100 text-red-800' },
    STRONG_NO: { label: 'Strong No', className: 'bg-red-200 text-red-900' },
  };
  const c = config[recommendation] || { label: recommendation, className: 'bg-gray-100 text-gray-800' };
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', c.className)}>
      {c.label}
    </span>
  );
}
