import { api } from '@/app/api';
import type { Job, CreateJobDto, UpdateJobDto, JobStatus } from '@ats/types';

export interface JobFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: JobStatus;
  department?: string;
  type?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedJobs {
  data: Job[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface JobMetrics {
  views: number;
  applications: number;
  conversionRate: number;
  averageTimeToHire: number;
  sourceBreakdown: Array<{ source: string; count: number }>;
}

export interface JobTemplate {
  id: string;
  name: string;
  title: string;
  department: string;
  description: string;
  requirements: string[];
  skills: string[];
  type: string;
}

export interface PipelineStageInput {
  id?: string;
  name: string;
  order: number;
  color: string;
}

export const jobApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get paginated, filtered jobs
    getJobs: builder.query<PaginatedJobs, JobFilters>({
      query: (params) => ({
        url: '/jobs',
        params: {
          page: params.page || 1,
          limit: params.limit || 20,
          search: params.search,
          status: params.status,
          department: params.department,
          type: params.type,
          sortBy: params.sortBy || 'createdAt',
          sortOrder: params.sortOrder || 'desc',
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: 'Jobs' as const, id })),
              { type: 'Jobs', id: 'LIST' },
            ]
          : [{ type: 'Jobs', id: 'LIST' }],
      transformResponse: (response: any): PaginatedJobs => {
        const items = Array.isArray(response) ? response : response.data || [];
        const total = response.total || response.meta?.total || items.length;
        const page = response.page || response.meta?.page || 1;
        const limit = response.limit || response.meta?.limit || 20;
        const totalPages = Math.ceil(total / limit);
        return {
          data: items,
          meta: { total, page, limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
        };
      },
    }),

    // Get single job with full details
    getJob: builder.query<Job, string>({
      query: (id) => `/jobs/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Jobs', id }],
    }),

    // Get job metrics
    getJobMetrics: builder.query<JobMetrics, string>({
      query: (id) => `/jobs/${id}/metrics`,
      providesTags: (_result, _error, id) => [{ type: 'Jobs', id: `metrics-${id}` }],
      transformResponse: (response: any): JobMetrics => ({
        views: response.views || 0,
        applications: response.applications || response.applicationCount || 0,
        conversionRate: response.conversionRate || 0,
        averageTimeToHire: response.averageTimeToHire || 0,
        sourceBreakdown: response.sourceBreakdown || [],
      }),
    }),

    // Get job templates
    getJobTemplates: builder.query<JobTemplate[], void>({
      query: () => '/jobs/templates',
      providesTags: [{ type: 'Jobs', id: 'TEMPLATES' }],
      transformResponse: (response: any): JobTemplate[] => {
        return Array.isArray(response) ? response : response.data || [];
      },
    }),

    // Create a new job
    createJob: builder.mutation<Job, CreateJobDto>({
      query: (data) => ({
        url: '/jobs',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [{ type: 'Jobs', id: 'LIST' }, 'Dashboard'],
    }),

    // Update job
    updateJob: builder.mutation<Job, { id: string; data: UpdateJobDto }>({
      query: ({ id, data }) => ({
        url: `/jobs/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Jobs', id },
        { type: 'Jobs', id: 'LIST' },
        'Dashboard',
      ],
    }),

    // Publish a job
    publishJob: builder.mutation<Job, string>({
      query: (id) => ({
        url: `/jobs/${id}/publish`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Jobs', id },
        { type: 'Jobs', id: 'LIST' },
        'Dashboard',
      ],
    }),

    // Close a job
    closeJob: builder.mutation<Job, string>({
      query: (id) => ({
        url: `/jobs/${id}/close`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Jobs', id },
        { type: 'Jobs', id: 'LIST' },
        'Dashboard',
      ],
    }),

    // Duplicate a job
    duplicateJob: builder.mutation<Job, string>({
      query: (id) => ({
        url: `/jobs/${id}/duplicate`,
        method: 'POST',
      }),
      invalidatesTags: [{ type: 'Jobs', id: 'LIST' }],
    }),

    // Delete a job
    deleteJob: builder.mutation<void, string>({
      query: (id) => ({
        url: `/jobs/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Jobs', id },
        { type: 'Jobs', id: 'LIST' },
        'Dashboard',
      ],
    }),

    // Update pipeline stages for a job
    updateJobPipelineStages: builder.mutation<void, { jobId: string; stages: PipelineStageInput[] }>({
      query: ({ jobId, stages }) => ({
        url: `/jobs/${jobId}/pipeline`,
        method: 'PUT',
        body: { stages },
      }),
      invalidatesTags: (_result, _error, { jobId }) => [
        { type: 'Jobs', id: jobId },
        { type: 'Pipeline', id: jobId },
      ],
    }),
  }),
});

export const {
  useGetJobsQuery,
  useGetJobQuery,
  useGetJobMetricsQuery,
  useGetJobTemplatesQuery,
  useCreateJobMutation,
  useUpdateJobMutation,
  usePublishJobMutation,
  useCloseJobMutation,
  useDuplicateJobMutation,
  useDeleteJobMutation,
  useUpdateJobPipelineStagesMutation,
} = jobApi;
