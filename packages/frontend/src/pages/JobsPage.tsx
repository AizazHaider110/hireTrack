import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { JobList, JobForm, JobTemplateSelector } from '@/features/jobs';
import { useCreateJobMutation } from '@/features/jobs';
import type { JobTemplate } from '@/features/jobs';
import type { CreateJobDto } from '@ats/types';
import { useToast } from '@/hooks/use-toast';

export function JobsPage() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [templateDefaults, setTemplateDefaults] = useState<Partial<any>>({});

  const [createJob, { isLoading }] = useCreateJobMutation();

  const handleCreateJob = () => {
    setTemplateDefaults({});
    setShowTemplateSelector(true);
  };

  const handleTemplateSelect = (template: JobTemplate) => {
    setTemplateDefaults({
      title: template.title,
      department: template.department,
      description: template.description,
      requirements: template.requirements || [],
      skills: template.skills || [],
    });
    setShowCreateDialog(true);
  };

  const handleSubmit = async (data: CreateJobDto) => {
    try {
      await createJob(data).unwrap();
      toast({ title: 'Job created successfully' });
      setShowCreateDialog(false);
      setTemplateDefaults({});
    } catch {
      toast({ title: 'Failed to create job', variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Jobs</h1>
        <p className="text-muted-foreground mt-1">Manage your job postings and pipelines</p>
      </div>

      <JobList onCreateJob={handleCreateJob} />

      {/* Template Selector */}
      <JobTemplateSelector
        open={showTemplateSelector}
        onOpenChange={(open) => {
          setShowTemplateSelector(open);
          if (!open) setShowCreateDialog(true);
        }}
        onSelect={handleTemplateSelect}
      />

      {/* Create Job Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Job</DialogTitle>
          </DialogHeader>
          <JobForm
            initialData={templateDefaults}
            onSubmit={handleSubmit}
            onCancel={() => setShowCreateDialog(false)}
            isLoading={isLoading}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
