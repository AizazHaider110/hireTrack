import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Video, Phone, Users, MapPin, Plus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ScheduleInterviewDto, InterviewType, TimeSlot } from '@ats/types';

interface Participant {
  id: string;
  name: string;
  email: string;
  role: 'INTERVIEWER' | 'ORGANIZER' | 'OBSERVER';
}

interface ScheduleInterviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateName: string;
  candidateId: string;
  jobId: string;
  applicationId: string;
  availableSlots?: TimeSlot[];
  availableParticipants?: Participant[];
  existingInterviews?: Array<{ scheduledAt: string; duration: number }>;
  onSchedule: (data: ScheduleInterviewDto) => void;
  isLoading?: boolean;
  initialDate?: Date;
}

const INTERVIEW_TYPES: Array<{ value: InterviewType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: 'PHONE', label: 'Phone Screen', icon: Phone },
  { value: 'VIDEO', label: 'Video Call', icon: Video },
  { value: 'ONSITE', label: 'On-site', icon: MapPin },
  { value: 'PANEL', label: 'Panel Interview', icon: Users },
];

const DURATIONS = [
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

// Common IANA timezones
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'GMT / London' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)' },
  { value: 'Europe/Berlin', label: 'Central European Time (CET)' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (GST)' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST)' },
  { value: 'Asia/Singapore', label: 'Singapore Time (SGT)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' },
  { value: 'UTC', label: 'UTC' },
];

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

function formatInTimezone(dateStr: string, timezone: string): string {
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      timeZone: timezone,
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

function hasConflict(
  scheduledAt: string,
  duration: number,
  existingInterviews: Array<{ scheduledAt: string; duration: number }>
): boolean {
  const start = new Date(scheduledAt).getTime();
  const end = start + duration * 60 * 1000;

  return existingInterviews.some((iv) => {
    const ivStart = new Date(iv.scheduledAt).getTime();
    const ivEnd = ivStart + iv.duration * 60 * 1000;
    return start < ivEnd && end > ivStart;
  });
}

export function ScheduleInterviewModal({
  open,
  onOpenChange,
  candidateName,
  candidateId,
  jobId,
  applicationId,
  availableSlots = [],
  availableParticipants = [],
  existingInterviews = [],
  onSchedule,
  isLoading = false,
  initialDate,
}: ScheduleInterviewModalProps) {
  const userTimezone = detectTimezone();

  const [type, setType] = useState<InterviewType>('VIDEO');
  const [scheduledAt, setScheduledAt] = useState('');
  const [duration, setDuration] = useState(60);
  const [timezone, setTimezone] = useState(userTimezone);
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [agenda, setAgenda] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<Participant[]>([]);
  const [participantSearch, setParticipantSearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Pre-fill date if provided
  useEffect(() => {
    if (initialDate && open) {
      const local = new Date(initialDate.getTime() - initialDate.getTimezoneOffset() * 60000);
      setScheduledAt(local.toISOString().slice(0, 16));
    }
  }, [initialDate, open]);

  const conflict = scheduledAt
    ? hasConflict(scheduledAt, duration, existingInterviews)
    : false;

  const filteredParticipants = availableParticipants.filter(
    (p) =>
      !selectedParticipants.find((s) => s.id === p.id) &&
      (p.name.toLowerCase().includes(participantSearch.toLowerCase()) ||
        p.email.toLowerCase().includes(participantSearch.toLowerCase()))
  );

  const addParticipant = (p: Participant) => {
    setSelectedParticipants((prev) => [...prev, p]);
    setParticipantSearch('');
  };

  const removeParticipant = (id: string) => {
    setSelectedParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!scheduledAt) newErrors.scheduledAt = 'Please select a date and time';
    if (selectedParticipants.length === 0)
      newErrors.participants = 'At least one interviewer is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSchedule({
      candidateId,
      jobId,
      applicationId,
      type,
      scheduledAt: new Date(scheduledAt).toISOString(),
      duration,
      timezone,
      location: location || undefined,
      meetingLink: meetingLink || undefined,
      agenda: agenda || undefined,
      participantIds: selectedParticipants.map((p) => p.id),
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset form
    setType('VIDEO');
    setScheduledAt('');
    setDuration(60);
    setTimezone(userTimezone);
    setLocation('');
    setMeetingLink('');
    setAgenda('');
    setSelectedParticipants([]);
    setErrors({});
  };

  // Candidate time display
  const candidateTime =
    scheduledAt && timezone !== userTimezone
      ? formatInTimezone(new Date(scheduledAt).toISOString(), timezone)
      : null;

  const interviewerTime =
    scheduledAt && timezone !== userTimezone
      ? formatInTimezone(new Date(scheduledAt).toISOString(), userTimezone)
      : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Interview</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Scheduling interview for <span className="font-medium">{candidateName}</span>
          </p>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Interview Type */}
          <div className="space-y-2">
            <Label>Interview Type</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {INTERVIEW_TYPES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 text-sm transition-colors',
                    type === value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-muted-foreground/50'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date/Time & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduledAt">Date & Time *</Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => {
                  setScheduledAt(e.target.value);
                  setErrors((prev) => ({ ...prev, scheduledAt: '' }));
                }}
                className={errors.scheduledAt ? 'border-destructive' : ''}
              />
              {errors.scheduledAt && (
                <p className="text-xs text-destructive">{errors.scheduledAt}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Duration</Label>
              <Select
                value={String(duration)}
                onValueChange={(v) => setDuration(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d.value} value={String(d.value)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Conflict Warning */}
          {conflict && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium">Scheduling conflict detected</p>
                <p className="text-xs mt-0.5">
                  This time slot overlaps with an existing interview. Consider choosing a different time.
                </p>
              </div>
            </div>
          )}

          {/* Timezone */}
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Dual timezone display */}
            {scheduledAt && (candidateTime || interviewerTime) && (
              <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                {candidateTime && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Candidate ({timezone}): {candidateTime}</span>
                  </div>
                )}
                {interviewerTime && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Your time ({userTimezone}): {interviewerTime}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Available Slots */}
          {availableSlots.length > 0 && (
            <div className="space-y-2">
              <Label>Available Slots</Label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {availableSlots
                  .filter((s) => s.available)
                  .map((slot, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        const d = new Date(slot.start);
                        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
                        setScheduledAt(local.toISOString().slice(0, 16));
                      }}
                      className="text-xs px-2 py-1 rounded border hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      {new Date(slot.start).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Location / Meeting Link */}
          {(type === 'ONSITE' || type === 'PANEL') && (
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g. 123 Main St, Conference Room A"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          )}
          {(type === 'VIDEO' || type === 'PANEL') && (
            <div className="space-y-2">
              <Label htmlFor="meetingLink">Meeting Link</Label>
              <Input
                id="meetingLink"
                placeholder="https://meet.google.com/..."
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
              />
            </div>
          )}

          {/* Participants */}
          <div className="space-y-2">
            <Label>Interviewers *</Label>
            {/* Selected participants */}
            {selectedParticipants.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedParticipants.map((p) => (
                  <Badge key={p.id} variant="secondary" className="gap-1 pr-1">
                    {p.name}
                    <button
                      type="button"
                      onClick={() => removeParticipant(p.id)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            {/* Search / add participants */}
            {availableParticipants.length > 0 ? (
              <div className="relative">
                <Input
                  placeholder="Search interviewers..."
                  value={participantSearch}
                  onChange={(e) => setParticipantSearch(e.target.value)}
                />
                {participantSearch && filteredParticipants.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-md max-h-40 overflow-y-auto">
                    {filteredParticipants.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addParticipant(p)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                      >
                        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.email}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Input
                placeholder="Enter interviewer email..."
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && participantSearch.includes('@')) {
                    addParticipant({
                      id: participantSearch,
                      name: participantSearch,
                      email: participantSearch,
                      role: 'INTERVIEWER',
                    });
                  }
                }}
              />
            )}
            {errors.participants && (
              <p className="text-xs text-destructive">{errors.participants}</p>
            )}
          </div>

          {/* Agenda */}
          <div className="space-y-2">
            <Label htmlFor="agenda">Agenda (Optional)</Label>
            <Textarea
              id="agenda"
              placeholder="Interview agenda, topics to cover, preparation notes..."
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Scheduling...' : 'Schedule Interview'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
