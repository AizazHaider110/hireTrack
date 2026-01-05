// Candidate Types

export interface ExperienceEntry {
  id: string;
  company: string;
  title: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description?: string;
}

export interface EducationEntry {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate?: string;
  current: boolean;
}

export interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  location?: string;
  avatar?: string;
  resumeUrl?: string;
  skills: string[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  tags: string[];
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateScore {
  overall: number;
  skillsMatch: number;
  experienceMatch: number;
  educationMatch: number;
}

export interface CandidateCard {
  id: string;
  candidateId: string;
  name: string;
  email: string;
  avatar?: string;
  score?: number;
  stageId: string;
  appliedAt: string;
  tags: string[];
}

export interface CandidateFilters {
  search?: string;
  skills?: string[];
  location?: string;
  source?: string;
  tags?: string[];
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
