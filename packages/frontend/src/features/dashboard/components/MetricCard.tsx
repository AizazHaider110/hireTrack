import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  LucideIcon 
} from 'lucide-react';

export interface MetricCardProps {
  title: string;
  value: number | string;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon: LucideIcon;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  loading?: boolean;
}

const variantStyles = {
  default: 'border-border',
  primary: 'border-primary/20 bg-primary/5',
  success: 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950',
  warning: 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950',
  danger: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950',
};

const iconVariantStyles = {
  default: 'text-muted-foreground',
  primary: 'text-primary',
  success: 'text-green-600 dark:text-green-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
  danger: 'text-red-600 dark:text-red-400',
};

export const MetricCard = ({
  title,
  value,
  change,
  trend = 'neutral',
  icon: Icon,
  onClick,
  variant = 'default',
  loading = false,
}: MetricCardProps) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-600 dark:text-green-400';
      case 'down':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <Card className={cn('transition-all', variantStyles[variant])}>
        <CardContent className="p-6">
          <div className="space-y-3">
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            <div className="h-8 w-32 bg-muted animate-pulse rounded" />
            <div className="h-3 w-16 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'transition-all',
        variantStyles[variant],
        onClick && 'cursor-pointer hover:shadow-md hover:scale-[1.02]'
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <p className="text-sm font-medium text-muted-foreground">
              {title}
            </p>
            <p className="text-3xl font-bold tracking-tight">
              {value}
            </p>
            {change !== undefined && (
              <div className="flex items-center gap-1">
                {getTrendIcon()}
                <span className={cn('text-sm font-medium', getTrendColor())}>
                  {change > 0 ? '+' : ''}{change}%
                </span>
                <span className="text-xs text-muted-foreground">
                  vs last period
                </span>
              </div>
            )}
          </div>
          <div className={cn(
            'p-3 rounded-lg bg-background/50',
            iconVariantStyles[variant]
          )}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
