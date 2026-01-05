// Application Types

export type ApplicationStatus = 
  | 'NEW'
  | 'SCREENING'
  | 'INTERVIEW'
  | 'OFFER'
  | 'HIRED'
  | 'REJECTED'
  | 'WITHDRAWN';

export interface Application {
  id: string;
  candidateId: string;
  jobId: string;
  status: ApplicationStatus;
  stageId: string;
  score?: number;
  notes?: string;
  appliedAt: string;
  updatedAt: string;
}

export interface ApplicationWithDetails extends Application {
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  };
  job: {
    id: string;
    title: string;
    department: string;
  };
}
