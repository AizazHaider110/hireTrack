import { KanbanBoard } from '@/features/pipeline';

export function PipelinePage() {
  // For now, we'll use a hardcoded job ID
  // In a real app, this would come from route params or a job selector
  const jobId = 'demo-job-id';

  return (
    <div className="flex flex-col h-full p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Pipeline</h1>
        <p className="text-muted-foreground">
          Manage candidates through your hiring pipeline
        </p>
      </div>

      <div className="flex-1 overflow-hidden">
        <KanbanBoard jobId={jobId} />
      </div>
    </div>
  );
}
