import { api } from '@/app/api';
import type { 
  Pipeline, 
  MoveCandidateDto, 
  BulkMoveDto,
  CandidateCard 
} from '@ats/types';

export interface PipelineWithCandidates extends Pipeline {
  candidates: CandidateCard[];
}

export const pipelineApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get pipeline data for a specific job
    getPipelineByJob: builder.query<PipelineWithCandidates, string>({
      query: (jobId) => `/pipelines/job/${jobId}`,
      providesTags: (_result, _error, jobId) => [
        { type: 'Pipeline', id: jobId },
        'Pipeline',
      ],
    }),

    // Move a single candidate to a different stage
    moveCandidate: builder.mutation<CandidateCard, MoveCandidateDto>({
      query: (data) => ({
        url: '/pipelines/candidates/move',
        method: 'POST',
        body: data,
      }),
      // Optimistic update
      async onQueryStarted(
        { applicationId, toStageId },
        { dispatch, queryFulfilled, getState }
      ) {
        // Find the job ID from the current pipeline queries
        const state = getState() as any;
        const pipelineQueries = state.api.queries;
        
        let jobId: string | undefined;
        for (const [key, value] of Object.entries(pipelineQueries)) {
          if (key.startsWith('getPipelineByJob') && value) {
            const data = (value as any).data as PipelineWithCandidates;
            const candidate = data?.candidates?.find(c => c.id === applicationId);
            if (candidate) {
              jobId = data.jobId;
              break;
            }
          }
        }

        if (!jobId) return;

        const patchResult = dispatch(
          pipelineApi.util.updateQueryData('getPipelineByJob', jobId, (draft) => {
            const candidateIndex = draft.candidates.findIndex(c => c.id === applicationId);
            if (candidateIndex !== -1) {
              draft.candidates[candidateIndex].stageId = toStageId;
            }
          })
        );

        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
      invalidatesTags: () => [
        { type: 'Pipeline', id: 'LIST' },
        'Activities',
      ],
    }),

    // Bulk move multiple candidates to a stage
    bulkMoveCandidates: builder.mutation<CandidateCard[], BulkMoveDto>({
      query: (data) => ({
        url: '/pipelines/candidates/bulk-move',
        method: 'POST',
        body: data,
      }),
      // Optimistic update
      async onQueryStarted(
        { applicationIds, toStageId },
        { dispatch, queryFulfilled, getState }
      ) {
        const state = getState() as any;
        const pipelineQueries = state.api.queries;
        
        let jobId: string | undefined;
        for (const [key, value] of Object.entries(pipelineQueries)) {
          if (key.startsWith('getPipelineByJob') && value) {
            const data = (value as any).data as PipelineWithCandidates;
            const hasCandidate = data?.candidates?.some(c => applicationIds.includes(c.id));
            if (hasCandidate) {
              jobId = data.jobId;
              break;
            }
          }
        }

        if (!jobId) return;

        const patchResult = dispatch(
          pipelineApi.util.updateQueryData('getPipelineByJob', jobId, (draft) => {
            draft.candidates.forEach((candidate) => {
              if (applicationIds.includes(candidate.id)) {
                candidate.stageId = toStageId;
              }
            });
          })
        );

        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
      invalidatesTags: ['Pipeline', 'Activities'],
    }),
  }),
});

export const {
  useGetPipelineByJobQuery,
  useMoveCandidateMutation,
  useBulkMoveCandidatesMutation,
} = pipelineApi;
