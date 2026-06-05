import { CandidateList } from '@/features/candidates';

export function CandidatesPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Candidates</h1>
        <p className="text-muted-foreground mt-1">Manage and review all candidates</p>
      </div>
      <CandidateList />
    </div>
  );
}
