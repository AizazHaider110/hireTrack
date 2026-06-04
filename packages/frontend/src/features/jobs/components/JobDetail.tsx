import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Briefcase, Users, Eye, Calendar,
  Edit, Globe, Copy, Trash2, MoreHorizontal,
  TrendingUp, Clock, DollarSign, Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  useGetJobQuery, useGetJobMetricsQuery, usePublishJobMutation,
  useCloseJobMutation, useDuplicateJobMutation, useDeleteJobMutation,
  useUpdateJobPipelineStagesMutation,
} from '../jobApi';
import { JobForm } from './JobForm';
import { PipelineStageEditor } from './PipelineStageEditor';
import type { PipelineStageInput } from '../jobApi';
import type { JobStatus } from '@ats/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<JobStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  PUBLISHED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CLOSED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  ARCHIVED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricItem({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="p-2 rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface JobDetailProps {
  jobId: string;
}

export function JobDetail({ jobId }: JobDetailProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPipelineDialog, setShowPipelineDialog] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<PipelineStageInput[]>([]);

  const { data: job, isLoading } = useGetJobQuery(jobId);
  const { data: metrics } = useGetJobMetricsQuery(jobId);

  const [publishJob, { isLoading: isPublishing }] = usePublishJobMutation();
  const [closeJob, { isLoading: isClosing }] = useCloseJobMutation();
  const [duplicateJob] = useDuplicateJobMutation();
  const [deleteJob, { isLoading: isDeleting }] = useDeleteJobMutation();
  const [updatePipeline, { isLoading: isSavingPipeline }] = useUpdateJobPipelineStagesMutation();

  const handlePublish = async () => {
    try {
      await publishJob(jobId).unwrap();
      toast({ title: 'Job published successfully' });
    } catch {
      toast({ title: 'Failed to publish job', variant: 'destructive' });
    }
  };

  const handleClose = async () => {
    try {
      await closeJob(jobId).unwrap();
      toast({ title: 'Job closed' });
    } catch {
      toast({ title: 'Failed to close job', variant: 'destructive' });
    }
  };

  const handleDuplicate = async () => {
    try {
      const newJob = await duplicateJob(jobId).unwrap();
      toast({ title: 'Job duplicated' });
      navigate(`/jobs/${newJob.id}`);
    } catch {
      toast({ title: 'Failed to duplicate job', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteJob(jobId).unwrap();
      toast({ title: 'Job deleted' });
      navigate('/jobs');
    } catch {
      toast({ title: 'Failed to delete job', variant: 'destructive' });
    }
  };

  const handleOpenPipeline = () => {
    // Initialize with default stages if no pipeline data
    setPipelineStages([
      { name: 'Applied', order: 0, color: '#6366f1' },
      { name: 'Screening', order: 1, color: '#8b5cf6' },
      { name: 'Interview', order: 2, color: '#3b82f6' },
      { name: 'Offer', order: 3, color: '#22c55e' },
    ]);
    setShowPipelineDialog(true);
  };

  const handleSavePipeline = async () => {
    try {
      await updatePipeline({ jobId, stages: pipelineStages }).unwrap();
      toast({ title: 'Pipeline updated' });
      setShowPipelineDialog(false);
    } catch {
      toast({ title: 'Failed to update pipeline', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Job not found</p>
        <Button variant="link" onClick={() => navigate('/jobs')}>Back to jobs</Button>
      </div>
    );
  }

  const salaryText = job.salaryRange
    ? `${job.salaryRange.currency} ${job.salaryRange.min.toLocaleString()} – ${job.salaryRange.max.toLocaleString()}`
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/jobs')} className="mt-0.5">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{job.title}</h1>
              <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', STATUS_STYLES[job.status])}>
                {job.status.charAt(0) + job.status.slice(1).toLowerCase()}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5" />{job.department}
              </span>
              {job.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />{job.location}
                </span>
              )}
              <span>{job.type.replace('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</span>
              {job.publishedAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Published {new Date(job.publishedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {job.status === 'DRAFT' && (
            <Button size="sm" onClick={handlePublish} disabled={isPublishing}>
              <Globe className="h-4 w-4 mr-1.5" />
              {isPublishing ? 'Publishing...' : 'Publish'}
            </Button>
          )}
          {job.status === 'PUBLISHED' && (
            <Button size="sm" variant="outline" onClick={handleClose} disabled={isClosing}>
              {isClosing ? 'Closing...' : 'Close Job'}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowEditDialog(true)}>
            <Edit className="h-4 w-4 mr-1.5" />Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="px-2">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleOpenPipeline}>
                <Settings className="h-3.5 w-3.5 mr-2" />Configure Pipeline
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy className="h-3.5 w-3.5 mr-2" />Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <MetricItem icon={Users} label="Applications" value={job.applicationCount} />
        </Card>
        <Card>
          <MetricItem icon={Eye} label="Views" value={job.views} />
        </Card>
        <Card>
          <MetricItem
            icon={TrendingUp}
            label="Conversion Rate"
            value={metrics ? `${metrics.conversionRate.toFixed(1)}%` : '—'}
          />
        </Card>
        <Card>
          <MetricItem
            icon={Clock}
            label="Avg. Time to Hire"
            value={metrics ? `${metrics.averageTimeToHire}d` : '—'}
          />
        </Card>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Description */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <h2 className="font-semibold">Job Description</h2>
            </CardHeader>
            <CardContent>
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: job.description }}
              />
            </CardContent>
          </Card>

          {job.requirements?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <h2 className="font-semibold">Requirements</h2>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {job.requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      {req}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Job Details */}
          <Card>
            <CardHeader className="pb-3">
              <h2 className="font-semibold text-sm">Job Details</h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Department</span>
                <span className="font-medium">{job.department}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">
                  {job.type.replace('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium">{job.location || '—'}</span>
              </div>
              {salaryText && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5" />Salary
                    </span>
                    <span className="font-medium text-xs">{salaryText}</span>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium">{new Date(job.createdAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Skills */}
          {job.skills?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <h2 className="font-semibold text-sm">Required Skills</h2>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {job.skills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Source Breakdown */}
          {metrics?.sourceBreakdown && metrics.sourceBreakdown.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <h2 className="font-semibold text-sm">Application Sources</h2>
              </CardHeader>
              <CardContent className="space-y-2">
                {metrics.sourceBreakdown.map((s) => (
                  <div key={s.source} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{s.source}</span>
                    <span className="font-medium">{s.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this job?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{job.title}" and all associated data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Job</DialogTitle>
          </DialogHeader>
          <JobForm
            initialData={{
              title: job.title,
              department: job.department,
              location: job.location,
              type: job.type,
              description: job.description,
              requirements: job.requirements || [],
              skills: job.skills || [],
              salaryMin: job.salaryRange?.min?.toString() || '',
              salaryMax: job.salaryRange?.max?.toString() || '',
              salaryCurrency: job.salaryRange?.currency || 'USD',
            }}
            onSubmit={async (_data) => {
              // Update handled by parent or inline
              setShowEditDialog(false);
              toast({ title: 'Job updated' });
            }}
            onCancel={() => setShowEditDialog(false)}
            submitLabel="Save Changes"
          />
        </DialogContent>
      </Dialog>

      {/* Pipeline Configuration Dialog */}
      <Dialog open={showPipelineDialog} onOpenChange={setShowPipelineDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configure Pipeline Stages</DialogTitle>
          </DialogHeader>
          <DndProvider backend={HTML5Backend}>
            <PipelineStageEditor stages={pipelineStages} onChange={setPipelineStages} />
          </DndProvider>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowPipelineDialog(false)}>Cancel</Button>
            <Button onClick={handleSavePipeline} disabled={isSavingPipeline}>
              {isSavingPipeline ? 'Saving...' : 'Save Pipeline'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
