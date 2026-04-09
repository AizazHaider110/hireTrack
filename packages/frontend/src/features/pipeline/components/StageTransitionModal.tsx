import { useState } from 'react';
import { CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { PipelineStage } from '@ats/types';

interface StageTransitionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateName: string;
  fromStage: PipelineStage | null;
  toStage: PipelineStage | null;
  onConfirm: (reason?: string) => void;
  isLoading?: boolean;
}

const QUICK_REASONS = [
  'Skills match',
  'Strong interview performance',
  'Cultural fit',
  'Experience level',
  'Salary expectations',
  'Not a good fit',
  'Position filled',
  'Candidate withdrew',
];

export function StageTransitionModal({
  open,
  onOpenChange,
  candidateName,
  fromStage,
  toStage,
  onConfirm,
  isLoading = false,
}: StageTransitionModalProps) {
  const [reason, setReason] = useState('');
  const [selectedQuickReason, setSelectedQuickReason] = useState<string | null>(null);

  const handleQuickReasonClick = (quickReason: string) => {
    if (selectedQuickReason === quickReason) {
      setSelectedQuickReason(null);
      setReason('');
    } else {
      setSelectedQuickReason(quickReason);
      setReason(quickReason);
    }
  };

  const handleConfirm = () => {
    onConfirm(reason || undefined);
    // Reset state
    setReason('');
    setSelectedQuickReason(null);
  };

  const handleCancel = () => {
    onOpenChange(false);
    // Reset state
    setReason('');
    setSelectedQuickReason(null);
  };

  // Determine if this is a positive or negative transition
  const isPositiveTransition = () => {
    if (!fromStage || !toStage) return true;
    return toStage.order > fromStage.order;
  };

  const getIcon = () => {
    return isPositiveTransition() ? (
      <CheckCircle2 className="h-6 w-6 text-green-500" />
    ) : (
      <XCircle className="h-6 w-6 text-red-500" />
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {getIcon()}
            <DialogTitle>Move Candidate</DialogTitle>
          </div>
          <DialogDescription>
            Moving {candidateName} from{' '}
            <span className="font-semibold">{fromStage?.name || 'Unknown'}</span> to{' '}
            <span className="font-semibold">{toStage?.name || 'Unknown'}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Stage Transition Visual */}
          <div className="flex items-center justify-center gap-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: fromStage?.color || '#gray' }}
              />
              <span className="text-sm font-medium">{fromStage?.name}</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: toStage?.color || '#gray' }}
              />
              <span className="text-sm font-medium">{toStage?.name}</span>
            </div>
          </div>

          {/* Quick Reasons */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Quick Reasons (Optional)</Label>
            <div className="flex flex-wrap gap-2">
              {QUICK_REASONS.map((quickReason) => (
                <Button
                  key={quickReason}
                  type="button"
                  variant={selectedQuickReason === quickReason ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleQuickReasonClick(quickReason)}
                  disabled={isLoading}
                >
                  {quickReason}
                </Button>
              ))}
            </div>
          </div>

          {/* Reason Textarea */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-medium">
              Additional Notes (Optional)
            </Label>
            <Textarea
              id="reason"
              placeholder="Add any additional context or notes about this transition..."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setSelectedQuickReason(null);
              }}
              rows={4}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Adding a reason helps track the candidate's journey and improves team collaboration.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Moving...' : 'Confirm Move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
