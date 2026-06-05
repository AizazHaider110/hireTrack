import { api } from '@/app/api';
import type { Candidate, CandidateFilters } from '@ats/types';

export interface CandidateDetail extends Candidate {
  applications: Array<{
    id: string;
    jobId: string;
    jobTitle: string;
    status: string;
    stageId: string;
    stageName: string;
    score?: number;
    appliedAt: string;
    updatedAt: string;
  }>;
  notes?: string;
}

export interface PaginatedCandidates {
  data: Candidate[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface UpdateCandidateDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  location?: string;
  skills?: string[];
  tags?: string[];
  notes?: string;
}

export interface CreateCandidateDto {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  location?: string;
  skills?: string[];
  tags?: string[];
  source?: string;
}

export const candidateApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get paginated, filtered candidates
    getCandidates: builder.query<PaginatedCandidates, CandidateFilters>({
      query: (params) => ({
        url: '/candidates',
        params: {
          page: params.page || 1,
          limit: params.limit || 20,
          search: params.search,
          skills: params.skills?.join(','),
          location: params.location,
          source: params.source,
          tags: params.tags?.join(','),
          sortBy: params.sortBy || 'createdAt',
          sortOrder: params.sortOrder || 'desc',
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: 'Candidates' as const, id })),
              { type: 'Candidates', id: 'LIST' },
            ]
          : [{ type: 'Candidates', id: 'LIST' }],
      transformResponse: (response: any): PaginatedCandidates => {
        const data = response.data || response;
        const items = Array.isArray(data) ? data : data.data || [];
        const total = response.total || response.meta?.total || items.length;
        const page = response.page || response.meta?.page || 1;
        const limit = response.limit || response.meta?.limit || 20;
        const totalPages = Math.ceil(total / limit);
        return {
          data: items,
          meta: {
            total,
            page,
            limit,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          },
        };
      },
    }),

    // Get single candidate with full details
    getCandidate: builder.query<CandidateDetail, string>({
      query: (id) => `/candidates/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Candidates', id }],
      transformResponse: (response: any): CandidateDetail => {
        return {
          ...response,
          applications: response.applications?.map((app: any) => ({
            id: app.id,
            jobId: app.jobId,
            jobTitle: app.job?.title || 'Unknown Position',
            status: app.status,
            stageId: app.stageId,
            stageName: app.stage?.name || 'Unknown Stage',
            score: app.score,
            appliedAt: app.appliedAt || app.createdAt,
            updatedAt: app.updatedAt,
          })) || [],
        };
      },
    }),

    // Create a new candidate
    createCandidate: builder.mutation<Candidate, CreateCandidateDto>({
      query: (data) => ({
        url: '/candidates',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [{ type: 'Candidates', id: 'LIST' }],
    }),

    // Update candidate
    updateCandidate: builder.mutation<Candidate, { id: string; data: UpdateCandidateDto }>({
      query: ({ id, data }) => ({
        url: `/candidates/${id}`,
        method: 'PATCH',
        body: data,
      }),
      // Optimistic update
      async onQueryStarted({ id, data }, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          candidateApi.util.updateQueryData('getCandidate', id, (draft) => {
            Object.assign(draft, data);
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Candidates', id },
        { type: 'Candidates', id: 'LIST' },
      ],
    }),

    // Delete candidate
    deleteCandidate: builder.mutation<void, string>({
      query: (id) => ({
        url: `/candidates/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Candidates', id },
        { type: 'Candidates', id: 'LIST' },
      ],
    }),

    // Get candidate timeline/history
    getCandidateTimeline: builder.query<any[], string>({
      query: (candidateId) => `/candidates/${candidateId}/timeline`,
      providesTags: (_result, _error, id) => [{ type: 'Candidates', id: `timeline-${id}` }],
      transformResponse: (response: any): any[] => {
        return Array.isArray(response) ? response : response.data || [];
      },
    }),
  }),
});

export const {
  useGetCandidatesQuery,
  useGetCandidateQuery,
  useCreateCandidateMutation,
  useUpdateCandidateMutation,
  useDeleteCandidateMutation,
  useGetCandidateTimelineQuery,
} = candidateApi;
