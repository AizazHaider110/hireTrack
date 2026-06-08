import { useState } from 'react';
import { Star } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { SubmitFeedbackDto } from '../interviewApi';

type Recommendation = 'STRONG_YES' | 'YES' | 'NEUTRAL' | 'NO' | 'STRONG_NO';

interface FeedbackFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interviewId: string;
  candidateName: string;
  onSubmit: (data: SubmitFeedbackDto) => void;
  isLoading?: boolean;
}

const RECOMMENDATIONS: Array<{
  value: Recommendation;
  label: string;
  description: string;
  colorClass: string;
  activeClass: string;
}> = [
  {
    value: 'STRONG_YES',
    label: 'Strong Yes',
    description: 'Exceptional candidate, highly recommend',
    colorClass: 'border-green-300 text-green-700',
    activeClass: 'bg-green-500 border-green-500 text-white',
  },
  {
    value: 'YES',
    label: 'Yes',
    description: 'Good candidate, recommend moving forward',
    colorClass: 'border-emerald-300 text-emerald-700',
    activeClass: 'bg-emerald-500 border-emerald-500 text-white',
  },
  {
    value: 'NEUTRAL',
    label: 'Neutral',
    description: 'Mixed impressions, needs discussion',
    colorClass: 'border-gray-300 text-gray-700',
    activeClass: 'bg-gray-500 border-gray-500 text-white',
  },
  {
    value: 'NO',
    label: 'No',
    description: 'Does not meet requirements',
    colorClass: 'border-red-300 text-red-700',
    activeClass: 'bg-red-500 border-red-500 text-white',
  },
  {
    value: 'STRONG_NO',
    label: 'Strong No',
    description: 'Significant concerns, do not proceed',
    colorClass: 'border-red-400 text-red-800',
    activeClass: 'bg-red-700 border-red-700 text-white',
  },
];

interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
}

function StarRating({ value, onChange, label }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => {
          const starValue = i + 1;
          const filled = starValue <= (hovered || value);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(starValue)}
              onMouseEnter={() => setHovered(starValue)}
              onMouseLeave={() => setHovered(0)}
              className="focus:outline-none"
              aria-label={`Rate ${starValue} out of 5`}
            >
              <Star
                className={cn(
                  'h-6 w-6 transition-colors',
                  filled ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'
                )}
              />
            </button>
          );
        })}
        <span className="text-sm text-muted-foreground ml-2">
          {value > 0 ? `${value}/5` : 'Not rated'}
        </span>
      </div>
    </div>
  );
}

export function FeedbackForm({
  open,
  onOpenChange,
  interviewId,
  candidateName,
  onSubmit,
  isLoading = false,
}: FeedbackFormProps) {
  const [rating, setRating] = useState(0);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (rating === 0) newErrors.rating = 'Please provide an overall rating';
    if (!recommendation) newErrors.recommendation = 'Please select a recommendation';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit({
      interviewId,
      rating,
      recommendation: recommendation!,
      strengths: strengths || undefined,
      weaknesses: weaknesses || undefined,
      notes: notes || undefined,
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    setRating(0);
    setRecommendation(null);
    setStrengths('');
    setWeaknesses('');
    setNotes('');
    setErrors({});
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Interview Feedback</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Submitting feedback for <span className="font-medium">{candidateName}</span>
          </p>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Overall Rating */}
          <div className="space-y-1">
            <StarRating
              value={rating}
              onChange={setRating}
              label="Overall Rating *"
            />
            {errors.rating && (
              <p className="text-xs text-destructive">{errors.rating}</p>
            )}
          </div>

          {/* Recommendation */}
          <div className="space-y-2">
            <Label className="text-sm">Hiring Recommendation *</Label>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              {RECOMMENDATIONS.map((rec) => (
                <button
                  key={rec.value}
                  type="button"
                  onClick={() => {
                    setRecommendation(rec.value);
                    setErrors((prev) => ({ ...prev, recommendation: '' }));
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 text-center transition-all',
                    recommendation === rec.value
                      ? rec.activeClass
                      : `${rec.colorClass} hover:opacity-80`
                  )}
                >
                  <span className="text-xs font-semibold">{rec.label}</span>
                </button>
              ))}
            </div>
            {recommendation && (
              <p className="text-xs text-muted-foreground">
                {RECOMMENDATIONS.find((r) => r.value === recommendation)?.description}
              </p>
            )}
            {errors.recommendation && (
              <p className="text-xs text-destructive">{errors.recommendation}</p>
            )}
          </div>

          {/* Strengths */}
          <div className="space-y-2">
            <Label htmlFor="strengths" className="text-sm">
              Strengths
            </Label>
            <Textarea
              id="strengths"
              placeholder="What did the candidate do well? Technical skills, communication, problem-solving..."
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              rows={3}
            />
          </div>

          {/* Weaknesses */}
          <div className="space-y-2">
            <Label htmlFor="weaknesses" className="text-sm">
              Areas for Improvement
            </Label>
            <Textarea
              id="weaknesses"
              placeholder="What areas could the candidate improve? Gaps in knowledge, experience, or skills..."
              value={weaknesses}
              onChange={(e) => setWeaknesses(e.target.value)}
              rows={3}
            />
          </div>

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm">
              Additional Notes
            </Label>
            <Textarea
              id="notes"
              placeholder="Any other observations, context, or notes for the hiring team..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
