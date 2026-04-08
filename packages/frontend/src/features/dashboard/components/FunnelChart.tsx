import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { FunnelStage } from '@ats/types';

export interface FunnelChartProps {
  data: FunnelStage[];
  onStageClick?: (stage: FunnelStage) => void;
  loading?: boolean;
}

export const FunnelChart: React.FC<FunnelChartProps> = ({
  data,
  onStageClick,
  loading = false,
}) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recruitment Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recruitment Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No funnel data available
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...data.map((stage) => stage.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recruitment Funnel</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((stage, index) => {
            const widthPercent = (stage.count / maxCount) * 100;
            const isClickable = !!onStageClick;

            return (
              <div
                key={stage.name}
                className={cn(
                  'group relative',
                  isClickable && 'cursor-pointer'
                )}
                onClick={() => onStageClick?.(stage)}
              >
                {/* Stage bar */}
                <div
                  className={cn(
                    'relative h-16 rounded-lg transition-all duration-300',
                    'bg-gradient-to-r from-primary/80 to-primary/60',
                    'hover:from-primary hover:to-primary/80',
                    'shadow-sm hover:shadow-md'
                  )}
                  style={{ width: `${widthPercent}%`, minWidth: '200px' }}
                >
                  {/* Content */}
                  <div className="absolute inset-0 flex items-center justify-between px-4">
                    <div className="flex-1">
                      <p className="font-semibold text-white text-sm">
                        {stage.name}
                      </p>
                      <p className="text-xs text-white/90">
                        {stage.count} candidates ({stage.percentage.toFixed(1)}%)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-white">
                        {stage.count}
                      </p>
                      {stage.dropOffRate && stage.dropOffRate > 0 && (
                        <p className="text-xs text-white/90">
                          -{stage.dropOffRate.toFixed(1)}% drop
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Tooltip on hover */}
                  {isClickable && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs text-white/80">
                        Click for details
                      </span>
                    </div>
                  )}
                </div>

                {/* Drop-off indicator */}
                {index < data.length - 1 && stage.dropOffRate && stage.dropOffRate > 0 && (
                  <div className="flex items-center gap-2 mt-1 ml-4">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground">
                      {stage.dropOffRate.toFixed(1)}% drop-off
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Conversion</span>
            <span className="font-semibold">
              {data.length > 0 && data[0].count > 0
                ? ((data[data.length - 1].count / data[0].count) * 100).toFixed(1)
                : 0}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
