import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, LayoutGrid, List, Briefcase, MapPin, Users,
  Eye, MoreHorizontal, Copy, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useGetJobsQuery, usePublishJobMutation, useCloseJobMutation,
  useDuplicateJobMutation, useDeleteJobMutation,
} from '../jobApi';
import type { Job, JobStatus } from '@ats/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<JobStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  PUBLISHED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CLOSED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  ARCHIVED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', STATUS_STYLES[status])}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// ─── Job Card (Grid View) ─────────────────────────────────────────────────────

interface JobCardProps {
  job: Job;
  onView: () => void;
  onPublish: () => void;
  onClose: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function JobCard({ job, onView, onPublish, onClose, onDuplicate, onDelete }: JobCardProps) {
  return (
    <Card
      className="group hover:shadow-md transition-shadow cursor-pointer"
      onClick={onView}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-tight truncate">{job.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{job.department}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={job.status} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={onView}>View details</DropdownMenuItem>
                {job.status === 'DRAFT' && (
                  <DropdownMenuItem onClick={onPublish}>Publish</DropdownMenuItem>
                )}
                {job.status === 'PUBLISHED' && (
                  <DropdownMenuItem onClick={onClose}>Close job</DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="h-3.5 w-3.5 mr-2" />Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {job.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />{job.location}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Briefcase className="h-3 w-3" />
            {job.type.replace('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-3 w-3" />
            <span className="font-medium text-foreground">{job.applicationCount}</span> applicants
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Eye className="h-3 w-3" />
            <span className="font-medium text-foreground">{job.views}</span> views
          </span>
        </div>

        {job.skills?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {job.skills.slice(0, 3).map((skill) => (
              <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
            ))}
            {job.skills.length > 3 && (
              <Badge variant="outline" className="text-xs">+{job.skills.length - 3}</Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Job Row (List View) ──────────────────────────────────────────────────────

function JobRow({ job, onView, onPublish, onClose, onDuplicate, onDelete }: JobCardProps) {
  return (
    <tr className="border-b hover:bg-muted/40 cursor-pointer transition-colors group" onClick={onView}>
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium">{job.title}</p>
          <p className="text-xs text-muted-foreground">{job.department}</p>
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-sm text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3" />{job.location || '—'}
        </span>
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <StatusBadge status={job.status} />
      </td>
      <td className="px-4 py-3 hidden lg:table-cell text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />{job.applicationCount}
        </span>
      </td>
      <td className="px-4 py-3 hidden xl:table-cell text-sm text-muted-foreground">
        {job.publishedAt ? new Date(job.publishedAt).toLocaleDateString() : '—'}
      </td>
      <td className="px-4 py-3 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={onView}>View details</DropdownMenuItem>
            {job.status === 'DRAFT' && (
              <DropdownMenuItem onClick={onPublish}>Publish</DropdownMenuItem>
            )}
            {job.status === 'PUBLISHED' && (
              <DropdownMenuItem onClick={onClose}>Close job</DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-3.5 w-3.5 mr-2" />Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <>
      {[...Array(6)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="flex justify-between">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <div className="flex gap-1">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'ARCHIVED', label: 'Archived' },
];

interface JobListProps {
  onCreateJob: () => void;
}

export function JobList({ onCreateJob }: JobListProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);

  const { data, isLoading, isFetching } = useGetJobsQuery({
    page,
    limit: 12,
    search: search || undefined,
    status: statusFilter !== 'all' ? (statusFilter as JobStatus) : undefined,
  });

  const [publishJob] = usePublishJobMutation();
  const [closeJob] = useCloseJobMutation();
  const [duplicateJob] = useDuplicateJobMutation();
  const [deleteJob] = useDeleteJobMutation();

  const handlePublish = useCallback(async (id: string) => {
    try {
      await publishJob(id).unwrap();
      toast({ title: 'Job published successfully' });
    } catch {
      toast({ title: 'Failed to publish job', variant: 'destructive' });
    }
  }, [publishJob, toast]);

  const handleClose = useCallback(async (id: string) => {
    try {
      await closeJob(id).unwrap();
      toast({ title: 'Job closed' });
    } catch {
      toast({ title: 'Failed to close job', variant: 'destructive' });
    }
  }, [closeJob, toast]);

  const handleDuplicate = useCallback(async (id: string) => {
    try {
      await duplicateJob(id).unwrap();
      toast({ title: 'Job duplicated' });
    } catch {
      toast({ title: 'Failed to duplicate job', variant: 'destructive' });
    }
  }, [duplicateJob, toast]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteJob(deleteTarget.id).unwrap();
      toast({ title: 'Job deleted' });
    } catch {
      toast({ title: 'Failed to delete job', variant: 'destructive' });
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteJob, toast]);

  const jobs = data?.data || [];
  const meta = data?.meta;

  const jobActions = (job: Job) => ({
    onView: () => navigate(`/jobs/${job.id}`),
    onPublish: () => handlePublish(job.id),
    onClose: () => handleClose(job.id),
    onDuplicate: () => handleDuplicate(job.id),
    onDelete: () => setDeleteTarget(job),
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-9"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center border rounded-md overflow-hidden ml-auto">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-none h-9 px-3"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-none h-9 px-3"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>

        <Button size="sm" onClick={onCreateJob} className="gap-1.5">
          <Plus className="h-4 w-4" />New Job
        </Button>
      </div>

      {/* Content */}
      <div className={cn(isFetching && !isLoading && 'opacity-60 transition-opacity')}>
        {isLoading ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <GridSkeleton />
            </div>
          ) : (
            <Card><CardContent className="p-0">
              <div className="space-y-3 p-4">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            </CardContent></Card>
          )
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Briefcase className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-sm text-muted-foreground">No jobs found</p>
            <Button variant="link" size="sm" onClick={onCreateJob} className="mt-2">
              Create your first job
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} {...jobActions(job)} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Job</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Applicants</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden xl:table-cell">Published</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <JobRow key={job.id} job={job} {...jobActions(job)} />
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {meta.page} of {meta.totalPages} ({meta.total} jobs)
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)}
              disabled={!meta.hasPrevPage} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)}
              disabled={!meta.hasNextPage} className="h-8 w-8 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete job posting?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
