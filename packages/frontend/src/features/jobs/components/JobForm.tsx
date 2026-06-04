import { useState } from 'react';
import { X, Plus, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { RichTextEditor } from './RichTextEditor';
import type { CreateJobDto, JobType } from '@ats/types';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JobFormData {
  title: string;
  department: string;
  location: string;
  type: JobType;
  description: string;
  requirements: string[];
  skills: string[];
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  teamId?: string;
}

const INITIAL_FORM: JobFormData = {
  title: '',
  department: '',
  location: '',
  type: 'FULL_TIME',
  description: '',
  requirements: [],
  skills: [],
  salaryMin: '',
  salaryMax: '',
  salaryCurrency: 'USD',
};

const JOB_TYPES: Array<{ value: JobType; label: string }> = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERNSHIP', label: 'Internship' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

const STEPS = [
  { id: 1, label: 'Basic Info' },
  { id: 2, label: 'Description' },
  { id: 3, label: 'Requirements' },
  { id: 4, label: 'Compensation' },
];

// ─── Tag Input ────────────────────────────────────────────────────────────────

interface TagInputProps {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

function TagInput({ label, tags, onChange, placeholder }: TagInputProps) {
  const [input, setInput] = useState('');

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
  };

  const removeTag = (tag: string) => onChange(tags.filter((t) => t !== tag));

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); addTag(); }
          }}
          placeholder={placeholder || `Add ${label.toLowerCase()}...`}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={addTag} disabled={!input.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step Components ──────────────────────────────────────────────────────────

interface StepProps {
  form: JobFormData;
  onChange: (updates: Partial<JobFormData>) => void;
  errors: Partial<Record<keyof JobFormData, string>>;
}

function StepBasicInfo({ form, onChange, errors }: StepProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Job Title <span className="text-destructive">*</span></Label>
        <Input
          id="title"
          value={form.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g. Senior Software Engineer"
          className={cn(errors.title && 'border-destructive')}
        />
        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="department">Department <span className="text-destructive">*</span></Label>
          <Input
            id="department"
            value={form.department}
            onChange={(e) => onChange({ department: e.target.value })}
            placeholder="e.g. Engineering"
            className={cn(errors.department && 'border-destructive')}
          />
          {errors.department && <p className="text-xs text-destructive">{errors.department}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location <span className="text-destructive">*</span></Label>
          <Input
            id="location"
            value={form.location}
            onChange={(e) => onChange({ location: e.target.value })}
            placeholder="e.g. New York, NY or Remote"
            className={cn(errors.location && 'border-destructive')}
          />
          {errors.location && <p className="text-xs text-destructive">{errors.location}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Employment Type <span className="text-destructive">*</span></Label>
        <Select value={form.type} onValueChange={(v) => onChange({ type: v as JobType })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {JOB_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function StepDescription({ form, onChange, errors }: StepProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Job Description <span className="text-destructive">*</span></Label>
        <p className="text-xs text-muted-foreground">
          Describe the role, responsibilities, and what makes this position exciting.
        </p>
        <RichTextEditor
          value={form.description}
          onChange={(v) => onChange({ description: v })}
          placeholder="Describe the role and responsibilities..."
          minHeight="280px"
          className={cn(errors.description && 'border-destructive')}
        />
        {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
      </div>
    </div>
  );
}

function StepRequirements({ form, onChange }: StepProps) {
  return (
    <div className="space-y-6">
      <TagInput
        label="Requirements"
        tags={form.requirements}
        onChange={(requirements) => onChange({ requirements })}
        placeholder="e.g. 5+ years of experience"
      />
      <TagInput
        label="Skills"
        tags={form.skills}
        onChange={(skills) => onChange({ skills })}
        placeholder="e.g. React, TypeScript"
      />
    </div>
  );
}

function StepCompensation({ form, onChange }: StepProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 block">Salary Range (optional)</Label>
        <p className="text-xs text-muted-foreground mb-3">
          Adding a salary range increases application rates by up to 30%.
        </p>
        <div className="flex items-center gap-3">
          <Select value={form.salaryCurrency} onValueChange={(v) => onChange({ salaryCurrency: v })}>
            <SelectTrigger className="w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            type="number"
            value={form.salaryMin}
            onChange={(e) => onChange({ salaryMin: e.target.value })}
            placeholder="Min"
            className="flex-1"
            min={0}
          />
          <span className="text-muted-foreground text-sm">–</span>
          <Input
            type="number"
            value={form.salaryMax}
            onChange={(e) => onChange({ salaryMax: e.target.value })}
            placeholder="Max"
            className="flex-1"
            min={0}
          />
        </div>
        {form.salaryMin && form.salaryMax && Number(form.salaryMin) > Number(form.salaryMax) && (
          <p className="text-xs text-destructive mt-1">Minimum salary cannot exceed maximum</p>
        )}
      </div>
    </div>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────

interface JobFormProps {
  initialData?: Partial<JobFormData>;
  onSubmit: (data: CreateJobDto) => void;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export function JobForm({ initialData, onSubmit, onCancel, isLoading, submitLabel = 'Create Job' }: JobFormProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<JobFormData>({ ...INITIAL_FORM, ...initialData });
  const [errors, setErrors] = useState<Partial<Record<keyof JobFormData, string>>>({});

  const updateForm = (updates: Partial<JobFormData>) => {
    setForm((prev) => ({ ...prev, ...updates }));
    // Clear errors for updated fields
    const clearedErrors = { ...errors };
    Object.keys(updates).forEach((k) => delete clearedErrors[k as keyof JobFormData]);
    setErrors(clearedErrors);
  };

  const validateStep = (s: number): boolean => {
    const newErrors: Partial<Record<keyof JobFormData, string>> = {};
    if (s === 1) {
      if (!form.title.trim()) newErrors.title = 'Job title is required';
      if (!form.department.trim()) newErrors.department = 'Department is required';
      if (!form.location.trim()) newErrors.location = 'Location is required';
    }
    if (s === 2) {
      const stripped = form.description.replace(/<[^>]*>/g, '').trim();
      if (!stripped) newErrors.description = 'Job description is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) setStep((s) => s + 1);
  };

  const handleBack = () => setStep((s) => s - 1);

  const handleSubmit = () => {
    if (!validateStep(step)) return;

    const dto: CreateJobDto = {
      title: form.title.trim(),
      department: form.department.trim(),
      location: form.location.trim(),
      type: form.type,
      description: form.description,
      requirements: form.requirements,
      skills: form.skills,
    };

    if (form.salaryMin && form.salaryMax) {
      dto.salaryRange = {
        min: Number(form.salaryMin),
        max: Number(form.salaryMax),
        currency: form.salaryCurrency,
      };
    }

    onSubmit(dto);
  };

  const stepProps: StepProps = { form, onChange: updateForm, errors };

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors',
                step > s.id ? 'bg-primary text-primary-foreground' :
                step === s.id ? 'bg-primary text-primary-foreground' :
                'bg-muted text-muted-foreground'
              )}>
                {step > s.id ? <Check className="h-4 w-4" /> : s.id}
              </div>
              <span className={cn(
                'text-xs mt-1 whitespace-nowrap',
                step === s.id ? 'text-foreground font-medium' : 'text-muted-foreground'
              )}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                'flex-1 h-px mx-2 mb-4 transition-colors',
                step > s.id ? 'bg-primary' : 'bg-border'
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {step === 1 && <StepBasicInfo {...stepProps} />}
          {step === 2 && <StepDescription {...stepProps} />}
          {step === 3 && <StepRequirements {...stepProps} />}
          {step === 4 && <StepCompensation {...stepProps} />}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" onClick={step === 1 ? onCancel : handleBack}>
          {step === 1 ? 'Cancel' : (
            <><ChevronLeft className="h-4 w-4 mr-1" />Back</>
          )}
        </Button>
        {step < STEPS.length ? (
          <Button type="button" onClick={handleNext}>
            Next<ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Saving...' : submitLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
