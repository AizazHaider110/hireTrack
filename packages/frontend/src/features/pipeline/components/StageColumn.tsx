import { useDrop } from 'react-dnd';
import { CandidateCard, DRAG_TYPE } from './CandidateCard';
import type { CandidateCard as CandidateCardType, PipelineStage } from '@ats/types';

interface StageColumnProps {
  stage: PipelineStage;
  candidates: CandidateCardType[];
  onDrop: (candidateId: string, fromStageId: string, toStageId: string) => void;
  onCandidateClick?: (candidate: CandidateCardType) => void;
  selectedCandidates?: Set<string>;
}

export function StageColumn({
  stage,
  candidates,
  onDrop,
  onCandidateClick,
  selectedCandidates = new Set(),
}: StageColumnProps) {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: DRAG_TYPE,
    drop: (item: { candidate: CandidateCardType }) => {
      const { candidate } = item;
      if (candidate.stageId !== stage.id) {
        onDrop(candidate.id, candidate.stageId, stage.id);
      }
    },
    canDrop: (item: { candidate: CandidateCardType }) => {
      return item.candidate.stageId !== stage.id;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }));

  const isActive = isOver && canDrop;

  return (
    <div
      ref={drop}
      className={`
        flex-1 overflow-y-auto space-y-3 p-3 rounded-lg transition-colors
        ${isActive ? 'bg-primary/10 ring-2 ring-primary' : ''}
        ${isOver && !canDrop ? 'bg-destructive/10' : ''}
        ${!isOver ? 'bg-muted/30' : ''}
      `}
      style={{ minHeight: '200px' }}
    >
      {candidates.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
          {isActive ? 'Drop here' : 'No candidates'}
        </div>
      ) : (
        candidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            onClick={() => onCandidateClick?.(candidate)}
            isSelected={selectedCandidates.has(candidate.id)}
          />
        ))
      )}

      {/* Drop indicator */}
      {isActive && (
        <div className="border-2 border-dashed border-primary rounded-lg p-4 text-center text-sm text-primary font-medium">
          Drop to move candidate
        </div>
      )}
    </div>
  );
}
