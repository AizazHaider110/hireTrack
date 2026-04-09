import { useState, useMemo } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Filter, Search } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetPipelineByJobQuery, useMoveCandidateMutation, useBulkMoveCandidatesMutation } from '../pipelineApi';
import { StageColumn } from './StageColumn';
import { StageTransitionModal } from './StageTransitionModal';
import { BulkActionsToolbar } from './BulkActionsToolbar';
import type { CandidateCard } from '@ats/types';
import { useToast } from '@/hooks/use-toast';

interface KanbanBoardProps {
  jobId: string;
  onJobChange?: (jobId: string) => void;
  availableJobs?: Array<{ id: string; title: string }>;
}

export function KanbanBoard({ jobId, onJobChange, availableJobs = [] }: KanbanBoardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [scoreFilter, setScoreFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [transitionModalData, setTransitionModalData] = useState<{
    candidateId: string;
    fromStageId: string;
    toStageId: string;
  } | null>(null);

  const { data: pipeline, isLoading, error } = useGetPipelineByJobQuery(jobId);
  const [moveCandidate, { isLoading: isMoving }] = useMoveCandidateMutation();
  const [bulkMoveCandidates, { isLoading: isBulkMoving }] = useBulkMoveCandidatesMutation();
  const { toast } = useToast();

  const handleDrop = (candidateId: string, fromStageId: string, toStageId: string) => {
    // Check if the stage transition requires a reason
    // For now, we'll open the modal for all transitions
    setTransitionModalData({ candidateId, fromStageId, toStageId });
  };

  const handleCandidateClick = (candidate: CandidateCard) => {
    // Toggle selection for bulk actions
    setSelectedCandidates((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(candidate.id)) {
        newSet.delete(candidate.id);
      } else {
        newSet.add(candidate.id);
      }
      return newSet;
    });
  };

  const handleConfirmTransition = async (reason?: string) => {
    if (!transitionModalData) return;

    const { candidateId, fromStageId, toStageId } = transitionModalData;

    try {
      await moveCandidate({
        applicationId: candidateId,
        candidateId: candidateId, // This should be the actual candidate ID, not application ID
        fromStageId,
        toStageId,
        reason,
      }).unwrap();

      toast({
        title: 'Candidate moved successfully',
        description: `Candidate has been moved to ${pipeline?.stages.find(s => s.id === toStageId)?.name}`,
      });

      setTransitionModalData(null);
    } catch (error) {
      toast({
        title: 'Failed to move candidate',
        description: 'An error occurred while moving the candidate. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const getStageById = (stageId: string) => {
    return pipeline?.stages.find((s) => s.id === stageId) || null;
  };

  const handleBulkMove = async (toStageId: string) => {
    if (selectedCandidates.size === 0) return;

    try {
      await bulkMoveCandidates({
        applicationIds: Array.from(selectedCandidates),
        toStageId,
      }).unwrap();

      toast({
        title: 'Candidates moved successfully',
        description: `${selectedCandidates.size} ${selectedCandidates.size === 1 ? 'candidate has' : 'candidates have'} been moved to ${pipeline?.stages.find(s => s.id === toStageId)?.name}`,
      });

      setSelectedCandidates(new Set());
    } catch (error) {
      toast({
        title: 'Failed to move candidates',
        description: 'An error occurred while moving the candidates. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedCandidates(new Set());
  };

  // Filter candidates based on search and filters
  const filteredCandidates = useMemo(() => {
    if (!pipeline?.candidates) return [];

    return pipeline.candidates.filter((candidate) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          candidate.name.toLowerCase().includes(query) ||
          candidate.email.toLowerCase().includes(query) ||
          candidate.tags.some((tag) => tag.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      // Score filter
      if (scoreFilter !== 'all' && candidate.score !== undefined) {
        const score = candidate.score;
        switch (scoreFilter) {
          case 'high':
            if (score < 80) return false;
            break;
          case 'medium':
            if (score < 50 || score >= 80) return false;
            break;
          case 'low':
            if (score >= 50) return false;
            break;
        }
      }

      // Source filter (would need to be added to CandidateCard type)
      // For now, we'll skip this filter

      return true;
    });
  }, [pipeline?.candidates, searchQuery, scoreFilter, sourceFilter]);

  // Group candidates by stage
  const candidatesByStage = useMemo(() => {
    const grouped: Record<string, CandidateCard[]> = {};
    
    if (pipeline?.stages) {
      pipeline.stages.forEach((stage) => {
        grouped[stage.id] = [];
      });
    }

    filteredCandidates.forEach((candidate) => {
      if (grouped[candidate.stageId]) {
        grouped[candidate.stageId].push(candidate);
      }
    });

    return grouped;
  }, [pipeline?.stages, filteredCandidates]);

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-destructive">Failed to load pipeline data</p>
      </Card>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col h-full">
        {/* Header with job selector and filters */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center gap-4">
            {/* Job Selector */}
            {availableJobs.length > 0 && onJobChange && (
              <Select value={jobId} onValueChange={onJobChange}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Select a job" />
                </SelectTrigger>
                <SelectContent>
                  {availableJobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search candidates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filter Toggle */}
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          {/* Filter Controls */}
          {showFilters && (
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Score:</label>
                <Select value={scoreFilter} onValueChange={setScoreFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Scores</SelectItem>
                    <SelectItem value="high">High (80+)</SelectItem>
                    <SelectItem value="medium">Medium (50-79)</SelectItem>
                    <SelectItem value="low">Low (&lt;50)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setScoreFilter('all');
                  setSourceFilter('all');
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>

        {/* Kanban Board */}
        {isLoading ? (
          <div className="flex gap-4 overflow-x-auto">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-shrink-0 w-80">
                <Skeleton className="h-12 mb-4" />
                <div className="space-y-3">
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {pipeline?.stages.map((stage) => (
              <div
                key={stage.id}
                className="flex-shrink-0 w-80 flex flex-col"
                style={{ maxHeight: 'calc(100vh - 250px)' }}
              >
                {/* Stage Header */}
                <div className="flex items-center justify-between mb-4 p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    <h3 className="font-semibold">{stage.name}</h3>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {candidatesByStage[stage.id]?.length || 0}
                  </span>
                </div>

                {/* Stage Column */}
                <StageColumn
                  stage={stage}
                  candidates={candidatesByStage[stage.id] || []}
                  onDrop={handleDrop}
                  onCandidateClick={handleCandidateClick}
                  selectedCandidates={selectedCandidates}
                />
              </div>
            ))}
          </div>
        )}

        {/* Stage Transition Modal */}
        {transitionModalData && (
          <StageTransitionModal
            open={!!transitionModalData}
            onOpenChange={(open) => !open && setTransitionModalData(null)}
            candidateName={
              pipeline?.candidates.find((c) => c.id === transitionModalData.candidateId)?.name ||
              'Unknown'
            }
            fromStage={getStageById(transitionModalData.fromStageId)}
            toStage={getStageById(transitionModalData.toStageId)}
            onConfirm={handleConfirmTransition}
            isLoading={isMoving}
          />
        )}

        {/* Bulk Actions Toolbar */}
        {pipeline && (
          <BulkActionsToolbar
            selectedCount={selectedCandidates.size}
            stages={pipeline.stages}
            onClearSelection={handleClearSelection}
            onBulkMove={handleBulkMove}
            isLoading={isBulkMoving}
          />
        )}
      </div>
    </DndProvider>
  );
}
