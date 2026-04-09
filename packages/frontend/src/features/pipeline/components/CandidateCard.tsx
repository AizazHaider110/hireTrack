import { useDrag } from 'react-dnd';
import { GripVertical, Mail, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { CandidateCard as CandidateCardType } from '@ats/types';

interface CandidateCardProps {
  candidate: CandidateCardType;
  onClick?: () => void;
  isSelected?: boolean;
}

const DRAG_TYPE = 'CANDIDATE_CARD';

export function CandidateCard({ candidate, onClick, isSelected = false }: CandidateCardProps) {
  const [{ isDragging }, drag, preview] = useDrag(() => ({
    type: DRAG_TYPE,
    item: { candidate },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const getScoreColor = (score?: number) => {
    if (!score) return 'bg-gray-500';
    if (score >= 80) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreLabel = (score?: number) => {
    if (!score) return 'N/A';
    return score.toString();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  };

  return (
    <div ref={preview}>
      <Card
        className={`
          group relative p-4 cursor-pointer transition-all hover:shadow-md
          ${isDragging ? 'opacity-50 rotate-2' : 'opacity-100'}
          ${isSelected ? 'ring-2 ring-primary' : ''}
        `}
        onClick={onClick}
      >
        {/* Drag Handle */}
        <div
          ref={drag}
          className="absolute left-2 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Card Content */}
        <div className="pl-4">
          {/* Header with Avatar and Score */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={candidate.avatar} alt={candidate.name} />
                <AvatarFallback>{getInitials(candidate.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm truncate">{candidate.name}</h4>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <span className="truncate">{candidate.email}</span>
                </div>
              </div>
            </div>

            {/* Score Badge */}
            {candidate.score !== undefined && (
              <div className="flex-shrink-0">
                <div
                  className={`
                    ${getScoreColor(candidate.score)}
                    text-white text-xs font-bold px-2 py-1 rounded-full
                  `}
                >
                  {getScoreLabel(candidate.score)}
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          {candidate.tags && candidate.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {candidate.tags.slice(0, 3).map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {candidate.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{candidate.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Footer with Applied Date */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>Applied {formatDate(candidate.appliedAt)}</span>
          </div>
        </div>

        {/* Hover Preview Overlay */}
        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none" />
      </Card>
    </div>
  );
}

export { DRAG_TYPE };
