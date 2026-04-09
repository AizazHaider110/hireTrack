import { useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { PipelineStage } from '@ats/types';

interface BulkActionsToolbarProps {
  selectedCount: number;
  stages: PipelineStage[];
  onClearSelection: () => void;
  onBulkMove: (toStageId: string) => void;
  isLoading?: boolean;
}

export function BulkActionsToolbar({
  selectedCount,
  stages,
  onClearSelection,
  onBulkMove,
  isLoading = false,
}: BulkActionsToolbarProps) {
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleMoveClick = () => {
    if (selectedStageId) {
      setShowConfirmDialog(true);
    }
  };

  const handleConfirmMove = () => {
    if (selectedStageId) {
      onBulkMove(selectedStageId);
      setShowConfirmDialog(false);
      setSelectedStageId('');
    }
  };

  const selectedStage = stages.find((s) => s.id === selectedStageId);

  if (selectedCount === 0) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-primary text-primary-foreground rounded-lg shadow-lg p-4 flex items-center gap-4 min-w-[400px]">
          {/* Selection Count */}
          <div className="flex items-center gap-2">
            <div className="bg-primary-foreground/20 rounded-full px-3 py-1">
              <span className="font-semibold">{selectedCount}</span>
            </div>
            <span className="text-sm">
              {selectedCount === 1 ? 'candidate' : 'candidates'} selected
            </span>
          </div>

          {/* Stage Selector */}
          <div className="flex items-center gap-2 flex-1">
            <ArrowRight className="h-4 w-4" />
            <Select value={selectedStageId} onValueChange={setSelectedStageId} disabled={isLoading}>
              <SelectTrigger className="w-[200px] bg-primary-foreground/10 border-primary-foreground/20">
                <SelectValue placeholder="Move to stage..." />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleMoveClick}
              disabled={!selectedStageId || isLoading}
            >
              {isLoading ? 'Moving...' : 'Move'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClearSelection}
              disabled={isLoading}
              className="hover:bg-primary-foreground/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Move</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to move {selectedCount}{' '}
              {selectedCount === 1 ? 'candidate' : 'candidates'} to{' '}
              <span className="font-semibold">{selectedStage?.name}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmMove}>
              Confirm Move
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
