import { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Video,
  Phone,
  Users,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Interview, InterviewType } from '@ats/types';

type CalendarView = 'day' | 'week' | 'month';

interface InterviewCalendarProps {
  interviews: Interview[];
  onSelectInterview: (interview: Interview) => void;
  onSelectSlot?: (date: Date) => void;
}

const TYPE_ICONS: Record<InterviewType, React.ComponentType<{ className?: string }>> = {
  PHONE: Phone,
  VIDEO: Video,
  ONSITE: MapPin,
  PANEL: Users,
};

const TYPE_COLORS: Record<InterviewType, string> = {
  PHONE: 'bg-blue-100 text-blue-800 border-blue-200',
  VIDEO: 'bg-purple-100 text-purple-800 border-purple-200',
  ONSITE: 'bg-green-100 text-green-800 border-green-200',
  PANEL: 'bg-orange-100 text-orange-800 border-orange-200',
};

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'border-l-blue-500',
  COMPLETED: 'border-l-green-500',
  CANCELLED: 'border-l-red-500',
  NO_SHOW: 'border-l-yellow-500',
};

function formatTime(dateStr: string, timezone?: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getWeekDays(date: Date): Date[] {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function getMonthDays(date: Date): Date[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Pad start with previous month days
  const startPad = firstDay.getDay();
  const days: Date[] = [];
  for (let i = startPad - 1; i >= 0; i--) {
    const d = new Date(firstDay);
    d.setDate(firstDay.getDate() - i - 1);
    days.push(d);
  }
  // Current month days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }
  // Pad end to complete grid (6 rows × 7 cols = 42)
  while (days.length < 42) {
    const d = new Date(days[days.length - 1]);
    d.setDate(d.getDate() + 1);
    days.push(d);
  }
  return days;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface InterviewEventProps {
  interview: Interview;
  onClick: () => void;
  compact?: boolean;
}

function InterviewEvent({ interview, onClick, compact = false }: InterviewEventProps) {
  const Icon = TYPE_ICONS[interview.type] || Calendar;
  const colorClass = TYPE_COLORS[interview.type] || 'bg-gray-100 text-gray-800';
  const statusBorder = STATUS_COLORS[interview.status] || 'border-l-gray-400';

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={cn(
          'w-full text-left text-xs px-1.5 py-0.5 rounded border-l-2 truncate',
          colorClass,
          statusBorder,
          interview.status === 'CANCELLED' && 'opacity-50 line-through'
        )}
      >
        {formatTime(interview.scheduledAt)} {interview.type}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left text-sm px-3 py-2 rounded-md border border-l-4 hover:opacity-90 transition-opacity',
        colorClass,
        statusBorder,
        interview.status === 'CANCELLED' && 'opacity-50'
      )}
    >
      <div className="flex items-center gap-1.5 font-medium">
        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">{interview.type} Interview</span>
      </div>
      <div className="flex items-center gap-1 mt-0.5 text-xs opacity-80">
        <Clock className="h-3 w-3" />
        {formatTime(interview.scheduledAt)} · {interview.duration}min
      </div>
      {interview.participants.length > 0 && (
        <div className="text-xs opacity-70 mt-0.5 truncate">
          {interview.participants.map((p) => p.name).join(', ')}
        </div>
      )}
    </button>
  );
}

export function InterviewCalendar({
  interviews,
  onSelectInterview,
  onSelectSlot,
}: InterviewCalendarProps) {
  const [view, setView] = useState<CalendarView>('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  const navigate = (direction: 1 | -1) => {
    const d = new Date(currentDate);
    if (view === 'day') d.setDate(d.getDate() + direction);
    else if (view === 'week') d.setDate(d.getDate() + direction * 7);
    else d.setMonth(d.getMonth() + direction);
    setCurrentDate(d);
  };

  const goToToday = () => setCurrentDate(new Date());

  const headerLabel = useMemo(() => {
    if (view === 'day') {
      return currentDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
    if (view === 'week') {
      const days = getWeekDays(currentDate);
      const start = days[0];
      const end = days[6];
      if (start.getMonth() === end.getMonth()) {
        return `${start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
      }
      return `${start.toLocaleDateString('en-US', { month: 'short' })} – ${end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [view, currentDate]);

  const interviewsByDay = useMemo(() => {
    const map = new Map<string, Interview[]>();
    interviews.forEach((iv) => {
      const key = new Date(iv.scheduledAt).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(iv);
    });
    return map;
  }, [interviews]);

  const getInterviewsForDay = (day: Date) =>
    interviewsByDay.get(day.toDateString()) || [];

  const getInterviewsForHour = (day: Date, hour: number) => {
    return getInterviewsForDay(day).filter((iv) => {
      const h = new Date(iv.scheduledAt).getHours();
      return h === hour;
    });
  };

  const today = new Date();

  // Day view
  const renderDayView = () => (
    <div className="flex flex-col flex-1 overflow-auto">
      <div className="grid grid-cols-[60px_1fr] border-b">
        <div className="text-center py-2 text-sm font-medium text-muted-foreground">
          {currentDate.toLocaleDateString('en-US', { weekday: 'short' })}
        </div>
        <div
          className={cn(
            'py-2 text-center text-sm font-medium',
            isSameDay(currentDate, today) && 'text-primary'
          )}
        >
          {currentDate.getDate()}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {HOURS.map((hour) => {
          const hourInterviews = getInterviewsForHour(currentDate, hour);
          return (
            <div key={hour} className="grid grid-cols-[60px_1fr] border-b min-h-[60px]">
              <div className="text-xs text-muted-foreground text-right pr-2 pt-1">
                {hour === 0 ? '' : `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}`}
              </div>
              <div
                className="p-1 space-y-1 cursor-pointer hover:bg-muted/30"
                onClick={() => {
                  if (onSelectSlot) {
                    const d = new Date(currentDate);
                    d.setHours(hour, 0, 0, 0);
                    onSelectSlot(d);
                  }
                }}
              >
                {hourInterviews.map((iv) => (
                  <InterviewEvent
                    key={iv.id}
                    interview={iv}
                    onClick={() => onSelectInterview(iv)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Week view
  const renderWeekView = () => {
    const days = getWeekDays(currentDate);
    return (
      <div className="flex flex-col flex-1 overflow-auto">
        {/* Day headers */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b sticky top-0 bg-background z-10">
          <div />
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                'py-2 text-center text-sm border-l',
                isSameDay(day, today) && 'bg-primary/5'
              )}
            >
              <div className="text-muted-foreground text-xs">
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div
                className={cn(
                  'font-medium',
                  isSameDay(day, today) && 'text-primary font-bold'
                )}
              >
                {day.getDate()}
              </div>
            </div>
          ))}
        </div>
        {/* Hour rows */}
        <div className="flex-1 overflow-auto">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="grid grid-cols-[60px_repeat(7,1fr)] border-b min-h-[60px]"
            >
              <div className="text-xs text-muted-foreground text-right pr-2 pt-1">
                {hour === 0 ? '' : `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}`}
              </div>
              {days.map((day) => {
                const hourInterviews = getInterviewsForHour(day, hour);
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'border-l p-1 space-y-1 cursor-pointer hover:bg-muted/30',
                      isSameDay(day, today) && 'bg-primary/5'
                    )}
                    onClick={() => {
                      if (onSelectSlot) {
                        const d = new Date(day);
                        d.setHours(hour, 0, 0, 0);
                        onSelectSlot(d);
                      }
                    }}
                  >
                    {hourInterviews.map((iv) => (
                      <InterviewEvent
                        key={iv.id}
                        interview={iv}
                        onClick={() => onSelectInterview(iv)}
                        compact
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Month view
  const renderMonthView = () => {
    const days = getMonthDays(currentDate);
    const currentMonth = currentDate.getMonth();
    return (
      <div className="flex flex-col flex-1">
        {/* Day of week headers */}
        <div className="grid grid-cols-7 border-b">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        {/* Day cells */}
        <div className="grid grid-cols-7 flex-1">
          {days.map((day, idx) => {
            const dayInterviews = getInterviewsForDay(day);
            const isCurrentMonth = day.getMonth() === currentMonth;
            const isToday = isSameDay(day, today);
            return (
              <div
                key={idx}
                className={cn(
                  'border-b border-r min-h-[100px] p-1 cursor-pointer hover:bg-muted/30',
                  !isCurrentMonth && 'opacity-40',
                  isToday && 'bg-primary/5'
                )}
                onClick={() => onSelectSlot && onSelectSlot(day)}
              >
                <div
                  className={cn(
                    'text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full mb-1',
                    isToday && 'bg-primary text-primary-foreground'
                  )}
                >
                  {day.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayInterviews.slice(0, 3).map((iv) => (
                    <InterviewEvent
                      key={iv.id}
                      interview={iv}
                      onClick={(e?: any) => {
                        e?.stopPropagation();
                        onSelectInterview(iv);
                      }}
                      compact
                    />
                  ))}
                  {dayInterviews.length > 3 && (
                    <div className="text-xs text-muted-foreground pl-1">
                      +{dayInterviews.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background rounded-lg border">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold">{headerLabel}</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Legend */}
          <div className="hidden md:flex items-center gap-3 mr-4">
            {(Object.keys(TYPE_COLORS) as InterviewType[]).map((type) => (
              <div key={type} className="flex items-center gap-1">
                <div className={cn('w-2 h-2 rounded-full', TYPE_COLORS[type].split(' ')[0])} />
                <span className="text-xs text-muted-foreground capitalize">
                  {type.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
          {/* View switcher */}
          <div className="flex rounded-md border overflow-hidden">
            {(['day', 'week', 'month'] as CalendarView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                  view === v
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground'
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar body */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {view === 'day' && renderDayView()}
        {view === 'week' && renderWeekView()}
        {view === 'month' && renderMonthView()}
      </div>

      {/* Summary bar */}
      <div className="px-4 py-2 border-t flex items-center gap-4 text-xs text-muted-foreground">
        <span>{interviews.length} interview{interviews.length !== 1 ? 's' : ''} total</span>
        <span>
          {interviews.filter((i) => i.status === 'SCHEDULED').length} scheduled
        </span>
        <span>
          {interviews.filter((i) => i.status === 'COMPLETED').length} completed
        </span>
      </div>
    </div>
  );
}
