import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Check, X, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ─── Inline Notes Editor ────────────────────────────────────────────────────

interface InlineNotesProps {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  placeholder?: string;
  className?: string;
}

export function InlineNotes({ value, onSave, placeholder = 'Add notes...', className }: InlineNotesProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(draft.length, draft.length);
    }
  }, [editing]);

  const handleSave = async () => {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div
        className={cn(
          'group relative rounded-md border border-transparent p-2 hover:border-border hover:bg-muted/40 cursor-pointer transition-colors',
          className
        )}
        onClick={() => setEditing(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setEditing(true)}
        aria-label="Edit notes"
      >
        {value ? (
          <p className="text-sm whitespace-pre-wrap text-foreground">{value}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">{placeholder}</p>
        )}
        <Pencil className="absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="resize-none text-sm"
        disabled={saving}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 px-3 text-xs">
          <Check className="h-3.5 w-3.5 mr-1" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button size="sm" variant="ghost" onClick={handleCancel} disabled={saving} className="h-7 px-3 text-xs">
          <X className="h-3.5 w-3.5 mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Tag Input with Autocomplete ─────────────────────────────────────────────

interface TagInputProps {
  tags: string[];
  onSave: (tags: string[]) => Promise<void> | void;
  suggestions?: string[];
  placeholder?: string;
  className?: string;
}

export function TagInput({ tags, onSave, suggestions = [], placeholder = 'Add tag...', className }: TagInputProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(tags);
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredSuggestions = suggestions.filter(
    (s) => s.toLowerCase().includes(inputValue.toLowerCase()) && !draft.includes(s)
  );

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !draft.includes(trimmed)) {
      setDraft([...draft, trimmed]);
    }
    setInputValue('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const removeTag = (tag: string) => {
    setDraft(draft.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && inputValue.trim()) {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && draft.length > 0) {
      removeTag(draft[draft.length - 1]);
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(tags);
    setInputValue('');
    setEditing(false);
  };

  if (!editing) {
    return (
      <div
        className={cn(
          'group relative flex flex-wrap gap-1.5 rounded-md border border-transparent p-2 hover:border-border hover:bg-muted/40 cursor-pointer transition-colors min-h-[36px]',
          className
        )}
        onClick={() => setEditing(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setEditing(true)}
        aria-label="Edit tags"
      >
        {tags.length > 0 ? (
          tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))
        ) : (
          <span className="text-sm text-muted-foreground italic">{placeholder}</span>
        )}
        <Plus className="absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap gap-1.5 rounded-md border bg-background p-2 focus-within:ring-2 focus-within:ring-ring">
        {draft.map((tag) => (
          <Badge key={tag} variant="secondary" className="text-xs gap-1 pr-1">
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
        <div className="relative flex-1 min-w-[120px]">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Type and press Enter..."
            className="h-6 border-0 p-0 text-xs shadow-none focus-visible:ring-0 bg-transparent"
            disabled={saving}
          />
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute top-full left-0 z-50 mt-1 w-48 rounded-md border bg-popover shadow-md">
              {filteredSuggestions.slice(0, 6).map((s) => (
                <button
                  key={s}
                  className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent transition-colors"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addTag(s);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Press Enter or comma to add a tag</p>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 px-3 text-xs">
          <Check className="h-3.5 w-3.5 mr-1" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button size="sm" variant="ghost" onClick={handleCancel} disabled={saving} className="h-7 px-3 text-xs">
          <X className="h-3.5 w-3.5 mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
