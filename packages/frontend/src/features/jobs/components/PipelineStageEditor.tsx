import { useState, useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { PipelineStageInput } from '../jobApi';

// ─── Color Picker ─────────────────────────────────────────────────────────────

const STAGE_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#64748b',
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {STAGE_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={cn(
            'w-5 h-5 rounded-full transition-transform hover:scale-110',
            value === color && 'ring-2 ring-offset-1 ring-foreground'
          )}
          style={{ backgroundColor: color }}
          title={color}
        />
      ))}
    </div>
  );
}

// ─── Draggable Stage Row ──────────────────────────────────────────────────────

const DRAG_TYPE = 'PIPELINE_STAGE';

interface StageRowProps {
  stage: PipelineStageInput;
  index: number;
  onUpdate: (index: number, updates: Partial<PipelineStageInput>) => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
  canRemove: boolean;
}

function StageRow({ stage, index, onUpdate, onRemove, onMove, canRemove }: StageRowProps) {
  const [editingColor, setEditingColor] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, dragPreview] = useDrag({
    type: DRAG_TYPE,
    item: { index },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: DRAG_TYPE,
    hover: (item: { index: number }) => {
      if (item.index !== index) {
        onMove(item.index, index);
        item.index = index;
      }
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });

  dragPreview(drop(ref));

  return (
    <div
      ref={ref}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border bg-card transition-all',
        isDragging && 'opacity-40',
        isOver && 'border-primary/50 bg-primary/5'
      )}
    >
      {/* Drag Handle */}
      <div ref={drag as any} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Color Dot + Picker */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setEditingColor(!editingColor)}
          className="w-5 h-5 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform"
          style={{ backgroundColor: stage.color }}
        />
        {editingColor && (
          <div className="absolute top-7 left-0 z-10 p-3 bg-popover border rounded-lg shadow-lg">
            <ColorPicker value={stage.color} onChange={(c) => { onUpdate(index, { color: c }); setEditingColor(false); }} />
          </div>
        )}
      </div>

      {/* Name Input */}
      <Input
        value={stage.name}
        onChange={(e) => onUpdate(index, { name: e.target.value })}
        placeholder="Stage name"
        className="flex-1 h-8 text-sm"
      />

      {/* Order Badge */}
      <span className="text-xs text-muted-foreground w-6 text-center">{index + 1}</span>

      {/* Remove */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(index)}
        disabled={!canRemove}
        title={canRemove ? 'Remove stage' : 'At least 2 stages required'}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const DEFAULT_STAGES: PipelineStageInput[] = [
  { name: 'Applied', order: 0, color: '#6366f1' },
  { name: 'Screening', order: 1, color: '#8b5cf6' },
  { name: 'Interview', order: 2, color: '#3b82f6' },
  { name: 'Offer', order: 3, color: '#22c55e' },
];

interface PipelineStageEditorProps {
  stages?: PipelineStageInput[];
  onChange: (stages: PipelineStageInput[]) => void;
}

export function PipelineStageEditor({ stages = DEFAULT_STAGES, onChange }: PipelineStageEditorProps) {
  const addStage = () => {
    const colors = STAGE_COLORS;
    const nextColor = colors[stages.length % colors.length];
    onChange([
      ...stages,
      { name: '', order: stages.length, color: nextColor },
    ]);
  };

  const updateStage = (index: number, updates: Partial<PipelineStageInput>) => {
    const updated = stages.map((s, i) => (i === index ? { ...s, ...updates } : s));
    onChange(updated);
  };

  const removeStage = (index: number) => {
    const updated = stages.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i }));
    onChange(updated);
  };

  const moveStage = (from: number, to: number) => {
    const updated = [...stages];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    onChange(updated.map((s, i) => ({ ...s, order: i })));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Pipeline Stages</p>
          <p className="text-xs text-muted-foreground">Drag to reorder. Click the color dot to change it.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addStage} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />Add Stage
        </Button>
      </div>

      <div className="space-y-2">
        {stages.map((stage, index) => (
          <StageRow
            key={index}
            stage={stage}
            index={index}
            onUpdate={updateStage}
            onRemove={removeStage}
            onMove={moveStage}
            canRemove={stages.length > 2}
          />
        ))}
      </div>

      {stages.length === 0 && (
        <div className="text-center py-6 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
          No stages yet. Add at least 2 stages.
        </div>
      )}
    </div>
  );
}
