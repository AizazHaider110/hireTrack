import { api } from '@/app/api';
import type { 
  DashboardMetrics, 
  ActivityFeedItem, 
  PaginationParams 
} from '@ats/types';

export interface DashboardSummary {
  openJobs: number;
  activeCandidates: number;
  pendingInterviews: number;
  offersExtended: number;
  timeToHire: number;
  conversionRate: number;
}

export interface ActivityFeedResponse {
  data: ActivityFeedItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasNextPage: boolean;
  };
}

export interface UpcomingInterview {
  id: string;
  candidateName: string;
  candidateAvatar?: string;
  jobTitle: string;
  type: string;
  scheduledAt: string;
  duration: number;
  participants: Array<{
    id: string;
    name: string;
    avatar?: string;
  }>;
}

export const dashboardApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get dashboard metrics
    getDashboardMetrics: builder.query<DashboardMetrics, void>({
      query: () => '/analytics/dashboard',
      providesTags: ['Dashboard'],
      // Refetch every 5 minutes
      keepUnusedDataFor: 300,
    }),

    // Get activity feed with pagination
    getActivityFeed: builder.query<ActivityFeedResponse, PaginationParams>({
      query: (params) => ({
        url: '/audit/logs',
        params: {
          limit: params.limit || 20,
          offset: ((params.page || 1) - 1) * (params.limit || 20),
          sortBy: params.sortBy || 'createdAt',
          sortOrder: params.sortOrder || 'desc',
        },
      }),
      providesTags: ['Activities'],
      // Transform backend audit logs to activity feed format
      transformResponse: (response: any): ActivityFeedResponse => {
        return {
          data: response.data.map((log: any) => ({
            id: log.id,
            type: log.action,
            actor: {
              id: log.userId,
              name: log.user?.firstName && log.user?.lastName 
                ? `${log.user.firstName} ${log.user.lastName}`
                : log.user?.email || 'Unknown',
              avatar: log.user?.avatar,
            },
            target: log.resourceId || '',
            description: log.details?.description || `${log.action} on ${log.resource}`,
            metadata: log.details,
            timestamp: log.createdAt,
          })),
          meta: {
            total: response.total || 0,
            page: response.page || 1,
            limit: response.limit || 20,
            hasNextPage: response.hasMore || false,
          },
        };
      },
    }),

    // Get upcoming interviews
    getUpcomingInterviews: builder.query<UpcomingInterview[], { limit?: number }>({
      query: ({ limit = 5 }) => ({
        url: '/interviews',
        params: {
          status: 'SCHEDULED',
          sortBy: 'scheduledAt',
          sortOrder: 'asc',
          limit,
        },
      }),
      providesTags: ['Interviews'],
      // Transform response to match our interface
      transformResponse: (response: any): UpcomingInterview[] => {
        const interviews = response.data || response;
        return interviews.map((interview: any) => ({
          id: interview.id,
          candidateName: interview.candidate?.firstName && interview.candidate?.lastName
            ? `${interview.candidate.firstName} ${interview.candidate.lastName}`
            : 'Unknown Candidate',
          candidateAvatar: interview.candidate?.avatar,
          jobTitle: interview.job?.title || 'Unknown Position',
          type: interview.type,
          scheduledAt: interview.scheduledAt,
          duration: interview.duration || 60,
          participants: interview.participants?.map((p: any) => ({
            id: p.userId,
            name: p.user?.firstName && p.user?.lastName
              ? `${p.user.firstName} ${p.user.lastName}`
              : p.user?.email || 'Unknown',
            avatar: p.user?.avatar,
          })) || [],
        }));
      },
    }),
  }),
});

export const {
  useGetDashboardMetricsQuery,
  useGetActivityFeedQuery,
  useGetUpcomingInterviewsQuery,
} = dashboardApi;
