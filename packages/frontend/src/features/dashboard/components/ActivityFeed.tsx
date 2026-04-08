import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { ActivityFeedItem } from '@ats/types';
import { 
  UserPlus, 
  ArrowRight, 
  Calendar, 
  MessageSquare, 
  CheckCircle, 
  XCircle,
  LucideIcon 
} from 'lucide-react';

export interface ActivityFeedProps {
  activities: ActivityFeedItem[];
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

const activityIcons: Record<string, LucideIcon> = {
  APPLICATION_RECEIVED: UserPlus,
  STAGE_CHANGED: ArrowRight,
  INTERVIEW_SCHEDULED: Calendar,
  FEEDBACK_SUBMITTED: MessageSquare,
  OFFER_EXTENDED: CheckCircle,
  CANDIDATE_HIRED: CheckCircle,
  CANDIDATE_REJECTED: XCircle,
};

const activityColors: Record<string, string> = {
  APPLICATION_RECEIVED: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950',
  STAGE_CHANGED: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-950',
  INTERVIEW_SCHEDULED: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950',
  FEEDBACK_SUBMITTED: 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950',
  OFFER_EXTENDED: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950',
  CANDIDATE_HIRED: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950',
  CANDIDATE_REJECTED: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950',
};

const formatTimeAgo = (timestamp: string): string => {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return past.toLocaleDateString();
};

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities,
  loading = false,
  onLoadMore,
  hasMore = false,
}) => {
  if (loading && activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No recent activity
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {activities.map((activity, index) => {
              const Icon = activityIcons[activity.type] || UserPlus;
              const colorClass = activityColors[activity.type] || activityColors.APPLICATION_RECEIVED;

              return (
                <div
                  key={activity.id}
                  className="flex gap-3 pb-4 border-b last:border-0 last:pb-0"
                >
                  {/* Timeline connector */}
                  <div className="relative flex flex-col items-center">
                    <div className={`p-2 rounded-full ${colorClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    {index < activities.length - 1 && (
                      <div className="w-px h-full bg-border mt-2" />
                    )}
                  </div>

                  {/* Activity content */}
                  <div className="flex-1 space-y-1 pt-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium leading-none">
                          {activity.description}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={activity.actor.avatar} />
                            <AvatarFallback className="text-xs">
                              {getInitials(activity.actor.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">
                            {activity.actor.name}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(activity.timestamp)}
                      </span>
                    </div>

                    {/* Metadata badges */}
                    {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(activity.metadata).slice(0, 2).map(([key, value]) => (
                          <Badge key={key} variant="secondary" className="text-xs">
                            {String(value)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Load more button */}
            {hasMore && onLoadMore && (
              <button
                onClick={onLoadMore}
                className="w-full py-2 text-sm text-primary hover:text-primary/80 transition-colors"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load more'}
              </button>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
