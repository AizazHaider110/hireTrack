import { useState } from 'react';
import { 
  UserCheck, Mail, Calendar, ArrowRight, FileText, 
  MessageSquare, Star, AlertCircle, ChevronDown, ChevronUp 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface TimelineEvent {
  id: string;
  type: 
    | 'stage_change'
    | 'email_sent'
    | 'interview_scheduled'
    | 'interview_completed'
    | 'note_added'
    | 'score_updated'
    | 'application_created'
    | 'status_change'
    | string;
  title: string;
  description?: string;
  actor?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

interface TimelineItemProps {
  event: TimelineEvent;
  isLast: boolean;
}

const eventConfig: Record<string, { icon: React.ComponentType<any>; color: string; bgColor: string }> = {
  stage_change: { icon: ArrowRight, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  email_sent: { icon: Mail, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  interview_scheduled: { icon: Calendar, color: 'text-green-600', bgColor: 'bg-green-100' },
  interview_completed: { icon: UserCheck, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  note_added: { icon: MessageSquare, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  score_updated: { icon: Star, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  application_created: { icon: FileText, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  status_change: { icon: AlertCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
};

const defaultConfig = { icon: FileText, color: 'text-gray-600', bgColor: 'bg-gray-100' };

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TimelineItem({ event, isLast }: TimelineItemProps) {
  const [expanded, setExpanded] = useState(false);
  const config = eventConfig[event.type] || defaultConfig;
  const Icon = config.icon;
  const hasDetails = event.description || (event.metadata && Object.keys(event.metadata).length > 0);

  return (
    <div className="flex gap-4">
      {/* Icon + connector line */}
      <div className="flex flex-col items-center">
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', config.bgColor)}>
          <Icon className={cn('h-4 w-4', config.color)} />
        </div>
        {!isLast && <div className="mt-1 w-px flex-1 bg-border" />}
      </div>

      {/* Content */}
      <div className={cn('pb-6 flex-1 min-w-0', isLast && 'pb-0')}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{event.title}</p>
            {event.actor && (
              <p className="text-xs text-muted-foreground mt-0.5">by {event.actor}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatTimestamp(event.timestamp)}
            </span>
            {hasDetails && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label={expanded ? 'Collapse details' : 'Expand details'}
              >
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Expandable details */}
        {expanded && hasDetails && (
          <div className="mt-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            {event.description && <p>{event.description}</p>}
            {event.metadata && Object.keys(event.metadata).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(event.metadata).map(([key, value]) => (
                  <Badge key={key} variant="secondary" className="text-xs">
                    {key}: {String(value)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface CandidateTimelineProps {
  events: TimelineEvent[];
  isLoading?: boolean;
}

export function CandidateTimeline({ events, isLoading }: CandidateTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-4 w-48 rounded bg-muted animate-pulse" />
              <div className="h-3 w-32 rounded bg-muted animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">No activity recorded yet</p>
      </div>
    );
  }

  return (
    <div>
      {events.map((event, index) => (
        <TimelineItem key={event.id} event={event} isLast={index === events.length - 1} />
      ))}
    </div>
  );
}
