import { api } from '@/app/api';
import type { Interview, ScheduleInterviewDto, TimeSlot, Feedback } from '@ats/types';

export interface InterviewFilters {
  candidateId?: string;
  jobId?: string;
  status?: string;
  type?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface AvailabilityParams {
  participantIds: string[];
  from: string;
  to: string;
  duration: number;
}

export interface SubmitFeedbackDto {
  interviewId: string;
  rating: number;
  strengths?: string;
  weaknesses?: string;
  notes?: string;
  recommendation: 'STRONG_YES' | 'YES' | 'NEUTRAL' | 'NO' | 'STRONG_NO';
}

export interface UpdateInterviewDto {
  scheduledAt?: string;
  duration?: number;
  timezone?: string;
  location?: string;
  meetingLink?: string;
  agenda?: string;
  participantIds?: string[];
}

export const interviewApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get interviews with optional filters
    getInterviews: builder.query<Interview[], InterviewFilters>({
      query: (params) => ({
        url: '/interviews',
        params: {
          candidateId: params.candidateId,
          jobId: params.jobId,
          status: params.status,
          type: params.type,
          from: params.from,
          to: params.to,
          page: params.page || 1,
          limit: params.limit || 50,
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Interviews' as const, id })),
              { type: 'Interviews', id: 'LIST' },
            ]
          : [{ type: 'Interviews', id: 'LIST' }],
      transformResponse: (response: any): Interview[] => {
        return Array.isArray(response) ? response : response.data || [];
      },
    }),

    // Get single interview
    getInterview: builder.query<Interview, string>({
      query: (id) => `/interviews/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Interviews', id }],
    }),

    // Schedule a new interview
    scheduleInterview: builder.mutation<Interview, ScheduleInterviewDto>({
      query: (data) => ({
        url: '/interviews',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [
        { type: 'Interviews', id: 'LIST' },
        'Dashboard',
        'Activities',
      ],
    }),

    // Update an interview
    updateInterview: builder.mutation<Interview, { id: string; data: UpdateInterviewDto }>({
      query: ({ id, data }) => ({
        url: `/interviews/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Interviews', id },
        { type: 'Interviews', id: 'LIST' },
      ],
    }),

    // Cancel an interview
    cancelInterview: builder.mutation<Interview, { id: string; reason?: string }>({
      query: ({ id, reason }) => ({
        url: `/interviews/${id}/cancel`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Interviews', id },
        { type: 'Interviews', id: 'LIST' },
        'Dashboard',
      ],
    }),

    // Get interviewer availability
    getAvailability: builder.query<TimeSlot[], AvailabilityParams>({
      query: (params) => ({
        url: '/interviews/availability',
        params,
      }),
      transformResponse: (response: any): TimeSlot[] => {
        return Array.isArray(response) ? response : response.data || [];
      },
    }),

    // Submit interview feedback
    submitFeedback: builder.mutation<Feedback, SubmitFeedbackDto>({
      query: ({ interviewId, ...data }) => ({
        url: `/interviews/${interviewId}/feedback`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (_result, _error, { interviewId }) => [
        { type: 'Interviews', id: interviewId },
        { type: 'Interviews', id: 'LIST' },
        'Candidates',
      ],
    }),
  }),
});

export const {
  useGetInterviewsQuery,
  useGetInterviewQuery,
  useScheduleInterviewMutation,
  useUpdateInterviewMutation,
  useCancelInterviewMutation,
  useGetAvailabilityQuery,
  useSubmitFeedbackMutation,
} = interviewApi;
