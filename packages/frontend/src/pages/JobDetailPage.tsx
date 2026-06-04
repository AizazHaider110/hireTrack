import { useParams } from 'react-router-dom';
import { JobDetail } from '@/features/jobs';

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) return null;

  return (
    <div className="p-6">
      <JobDetail jobId={id} />
    </div>
  );
}
