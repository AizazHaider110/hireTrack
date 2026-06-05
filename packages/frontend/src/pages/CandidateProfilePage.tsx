import { useParams, Navigate } from 'react-router-dom';
import { CandidateProfile } from '@/features/candidates';

export function CandidateProfilePage() {
  const { id } = useParams<{ id: string }>();

  if (!id) return <Navigate to="/candidates" replace />;

  return (
    <div className="p-6">
      <CandidateProfile candidateId={id} />
    </div>
  );
}
