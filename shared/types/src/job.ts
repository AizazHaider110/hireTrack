// Job Types

export type JobStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
export type JobType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP';

export interface SalaryRange {
  min: number;
  max: number;
  currency: string;
}

export interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: JobType;
  status: JobStatus;
  description: string;
  requirements: string[];
  skills: string[];
  salaryRange?: SalaryRange;
  teamId?: string;
  applicationCount: number;
  views: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface CreateJobDto {
  title: string;
  department: string;
  location: string;
  type: JobType;
  description: string;
  requirements?: string[];
  skills?: string[];
  salaryRange?: SalaryRange;
  teamId?: string;
}

export interface UpdateJobDto extends Partial<CreateJobDto> {
  status?: JobStatus;
}
