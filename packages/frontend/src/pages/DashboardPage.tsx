import { useAppSelector } from '@/app/hooks';
import { selectCurrentUser } from '@/features/auth';
import { 
  useGetDashboardMetricsQuery, 
  useGetActivityFeedQuery 
} from '@/features/dashboard';
import { MetricCard } from '../features/dashboard/components/MetricCard';
import { FunnelChart } from '@/features/dashboard/components/FunnelChart';
import { ActivityFeed } from '@/features/dashboard/components/ActivityFeed';
import { 
  Briefcase, 
  Users, 
  Calendar, 
  CheckCircle 
} from 'lucide-react';

export function DashboardPage() {
  const user = useAppSelector(selectCurrentUser);
  
  // Fetch dashboard data
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useGetDashboardMetricsQuery();
  const { data: activityFeed, isLoading: activityLoading } = useGetActivityFeedQuery({ 
    page: 1, 
    limit: 20 
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome back, {user?.firstName}! Here's what's happening with your recruitment.
        </p>
      </div>

      {/* Error state */}
      {metricsError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load dashboard metrics. Please try refreshing the page.
          </p>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Open Jobs"
          value={metrics?.summary?.totalActiveJobs ?? 0}
          icon={Briefcase}
          variant="primary"
          loading={metricsLoading}
        />
        <MetricCard
          title="Active Candidates"
          value={metrics?.summary?.totalApplications ?? 0}
          icon={Users}
          variant="success"
          loading={metricsLoading}
        />
        <MetricCard
          title="Avg. Time to Hire"
          value={`${metrics?.summary?.averageTimeToHire ?? 0} days`}
          icon={Calendar}
          variant="warning"
          loading={metricsLoading}
        />
        <MetricCard
          title="Total Hires"
          value={metrics?.summary?.totalHires ?? 0}
          icon={CheckCircle}
          variant="default"
          loading={metricsLoading}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Funnel Chart */}
        <FunnelChart
          data={metrics?.funnel || []}
          loading={metricsLoading}
        />

        {/* Activity Feed */}
        <ActivityFeed
          activities={activityFeed?.data || []}
          loading={activityLoading}
          hasMore={activityFeed?.meta?.hasNextPage}
        />
      </div>
    </div>
  );
}
