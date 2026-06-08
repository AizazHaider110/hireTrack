import { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  InterviewCalendar,
  ScheduleInterviewModal,
  InterviewDetail,
  FeedbackForm,
  useGetInterviewsQuery,
  useScheduleInterviewMutation,
  useCancelInterviewMutation,
  useSubmitFeedbackMutation,
} from '@/features/interviews';
import type { SubmitFeedbackDto } from '@/features/interviews';
import { useToast } from '@/hooks/use-toast';
import type { Interview, ScheduleInterviewDto } from '@ats/types';

export function InterviewsPage() {
  const { toast } = useToast();

  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [initialSlotDate, setInitialSlotDate] = useState<Date | undefined>();

  const { data: interviews = [], isLoading, refetch } = useGetInterviewsQuery({});
  const [scheduleInterview, { isLoading: isScheduling }] = useScheduleInterviewMutation();
  const [cancelInterview, { isLoading: isCancelling }] = useCancelInterviewMutation();
  const [submitFeedback, { isLoading: isSubmittingFeedback }] = useSubmitFeedbackMutation();

  const handleSelectSlot = (date: Date) => {
    setInitialSlotDate(date);
    setShowScheduleModal(true);
  };

  const handleSchedule = async (data: ScheduleInterviewDto) => {
    try {
      await scheduleInterview(data).unwrap();
      toast({ title: 'Interview scheduled successfully' });
      setShowScheduleModal(false);
      setInitialSlotDate(undefined);
    } catch {
      toast({ title: 'Failed to schedule interview', variant: 'destructive' });
    }
  };

  const handleCancel = async (reason?: string) => {
    if (!selectedInterview) return;
    try {
      await cancelInterview({ id: selectedInterview.id, reason }).unwrap();
      toast({ title: 'Interview cancelled' });
      setSelectedInterview(null);
    } catch {
      toast({ title: 'Failed to cancel interview', variant: 'destructive' });
    }
  };

  const handleSubmitFeedback = async (data: SubmitFeedbackDto) => {
    try {
      await submitFeedback(data).unwrap();
      toast({ title: 'Feedback submitted successfully' });
      setShowFeedbackForm(false);
    } catch {
      toast({ title: 'Failed to submit feedback', variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Interviews</h1>
          <p className="text-muted-foreground mt-1">
            Schedule and manage candidate interviews
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowScheduleModal(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Schedule Interview
          </Button>
        </div>
      </div>

      {/* Calendar */}
      {isLoading ? (
        <div className="flex-1 rounded-lg border p-4 space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <InterviewCalendar
            interviews={interviews}
            onSelectInterview={setSelectedInterview}
            onSelectSlot={handleSelectSlot}
          />
        </div>
      )}

      {/* Interview Detail Sheet */}
      <Sheet
        open={!!selectedInterview}
        onOpenChange={(open) => !open && setSelectedInterview(null)}
      >
        <SheetContent className="w-full sm:max-w-[520px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Interview Details</SheetTitle>
          </SheetHeader>
          {selectedInterview && (
            <div className="mt-4">
              <InterviewDetail
                interview={selectedInterview}
                onReschedule={() => {
                  setInitialSlotDate(new Date(selectedInterview.scheduledAt));
                  setShowScheduleModal(true);
                }}
                onCancel={handleCancel}
                onSubmitFeedback={() => setShowFeedbackForm(true)}
                isLoading={isCancelling}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Schedule Modal */}
      <ScheduleInterviewModal
        open={showScheduleModal}
        onOpenChange={setShowScheduleModal}
        candidateName="Candidate"
        candidateId=""
        jobId=""
        applicationId=""
        existingInterviews={interviews.map((iv) => ({
          scheduledAt: iv.scheduledAt,
          duration: iv.duration,
        }))}
        onSchedule={handleSchedule}
        isLoading={isScheduling}
        initialDate={initialSlotDate}
      />

      {/* Feedback Form */}
      {selectedInterview && (
        <FeedbackForm
          open={showFeedbackForm}
          onOpenChange={setShowFeedbackForm}
          interviewId={selectedInterview.id}
          candidateName="Candidate"
          onSubmit={handleSubmitFeedback}
          isLoading={isSubmittingFeedback}
        />
      )}
    </div>
  );
}
