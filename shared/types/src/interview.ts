// Interview Types

export type InterviewType = 'PHONE' | 'VIDEO' | 'ONSITE' | 'PANEL';
export type InterviewStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface InterviewParticipant {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'INTERVIEWER' | 'ORGANIZER' | 'OBSERVER';
}

export interface Feedback {
  id: string;
  interviewId: string;
  interviewerId: string;
  rating: number;
  strengths?: string;
  weaknesses?: string;
  notes?: string;
  recommendation: 'STRONG_YES' | 'YES' | 'NEUTRAL' | 'NO' | 'STRONG_NO';
  submittedAt: string;
}

export interface Interview {
  id: string;
  candidateId: string;
  jobId: string;
  applicationId: string;
  type: InterviewType;
  status: InterviewStatus;
  scheduledAt: string;
  duration: number;
  timezone: string;
  location?: string;
  meetingLink?: string;
  agenda?: string;
  participants: InterviewParticipant[];
  feedback: Feedback[];
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleInterviewDto {
  candidateId: string;
  jobId: string;
  applicationId: string;
  type: InterviewType;
  scheduledAt: string;
  duration: number;
  timezone: string;
  location?: string;
  meetingLink?: string;
  agenda?: string;
  participantIds: string[];
}

export interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
}
