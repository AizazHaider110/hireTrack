import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface ScoreCategory {
  label: string;
  score: number;
  maxScore?: number;
  required?: number;
  description?: string;
}

interface ScoreBarProps {
  score: number;
  maxScore?: number;
  required?: number;
  color?: string;
}

function ScoreBar({ score, maxScore = 100, required, color }: ScoreBarProps) {
  const pct = Math.min((score / maxScore) * 100, 100);
  const reqPct = required ? Math.min((required / maxScore) * 100, 100) : undefined;

  const barColor =
    color ||
    (pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500');

  return (
    <div className="relative h-2 w-full rounded-full bg-muted overflow-visible">
      <div
        className={cn('h-full rounded-full transition-all duration-500', barColor)}
        style={{ width: `${pct}%` }}
      />
      {reqPct !== undefined && (
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-foreground/40 rounded-full"
          style={{ left: `${reqPct}%` }}
          title={`Required: ${required}`}
        />
      )}
    </div>
  );
}

function getScoreLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Excellent', color: 'text-emerald-600' };
  if (score >= 60) return { label: 'Good', color: 'text-yellow-600' };
  if (score >= 40) return { label: 'Fair', color: 'text-orange-600' };
  return { label: 'Poor', color: 'text-red-600' };
}

function OverallScoreRing({ score }: { score: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const { label, color } = getScoreLabel(score);

  const strokeColor =
    score >= 80 ? '#10b981' : score >= 60 ? '#eab308' : score >= 40 ? '#f97316' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-24 w-24">
        <svg className="h-24 w-24 -rotate-90" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{score}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      <span className={cn('text-sm font-medium', color)}>{label}</span>
    </div>
  );
}

interface ScoreBreakdownProps {
  overall: number;
  categories: ScoreCategory[];
  jobRequirements?: Record<string, number>;
}

export function ScoreBreakdown({ overall, categories, jobRequirements }: ScoreBreakdownProps) {
  return (
    <div className="space-y-6">
      {/* Overall score */}
      <div className="flex items-center gap-6 p-4 rounded-lg border bg-card">
        <OverallScoreRing score={overall} />
        <div className="flex-1">
          <h3 className="font-semibold text-base">Overall Match Score</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Based on skills, experience, and education alignment
          </p>
          <div className="flex items-center gap-1 mt-2">
            {overall >= 60 ? (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span className="text-xs text-muted-foreground">
              {overall >= 80
                ? 'Strong candidate match'
                : overall >= 60
                ? 'Moderate candidate match'
                : 'Below average match'}
            </span>
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="space-y-4">
        {categories.map((cat) => {
          const required = jobRequirements?.[cat.label.toLowerCase()];
          const diff = required !== undefined ? cat.score - required : undefined;

          return (
            <div key={cat.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{cat.label}</span>
                <div className="flex items-center gap-2">
                  {diff !== undefined && (
                    <span
                      className={cn(
                        'flex items-center gap-0.5 text-xs',
                        diff >= 0 ? 'text-emerald-600' : 'text-red-600'
                      )}
                    >
                      {diff > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : diff < 0 ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : (
                        <Minus className="h-3 w-3" />
                      )}
                      {diff > 0 ? `+${diff}` : diff}
                    </span>
                  )}
                  <span className="font-semibold tabular-nums">
                    {cat.score}
                    <span className="text-muted-foreground font-normal">/{cat.maxScore || 100}</span>
                  </span>
                </div>
              </div>
              <ScoreBar score={cat.score} maxScore={cat.maxScore} required={required} />
              {cat.description && (
                <p className="text-xs text-muted-foreground">{cat.description}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
