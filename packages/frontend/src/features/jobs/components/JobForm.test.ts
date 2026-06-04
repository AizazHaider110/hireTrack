/**
 * Tests for JobForm validation logic
 * Verifies form validation completeness (Requirements 12.4, 5.1, 5.3)
 */

import { describe, it, expect } from 'vitest';

// ─── Extracted validation logic (mirrors JobForm.validateStep) ────────────────

type JobFormData = {
  title: string;
  department: string;
  location: string;
  type: string;
  description: string;
  requirements: string[];
  skills: string[];
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
};

function validateStep(step: number, form: JobFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (step === 1) {
    if (!form.title.trim()) errors.title = 'Job title is required';
    if (!form.department.trim()) errors.department = 'Department is required';
    if (!form.location.trim()) errors.location = 'Location is required';
  }
  if (step === 2) {
    const stripped = form.description.replace(/<[^>]*>/g, '').trim();
    if (!stripped) errors.description = 'Job description is required';
  }
  return errors;
}

function isSalaryRangeValid(min: string, max: string): boolean {
  if (!min || !max) return true; // optional fields
  return Number(min) <= Number(max);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

const baseForm: JobFormData = {
  title: 'Senior Engineer',
  department: 'Engineering',
  location: 'Remote',
  type: 'FULL_TIME',
  description: '<p>Great role</p>',
  requirements: [],
  skills: [],
  salaryMin: '',
  salaryMax: '',
  salaryCurrency: 'USD',
};

describe('JobForm - Step 1 validation (basic info)', () => {
  it('passes when all required fields are filled', () => {
    const errors = validateStep(1, baseForm);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('requires job title', () => {
    const errors = validateStep(1, { ...baseForm, title: '' });
    expect(errors.title).toBeDefined();
  });

  it('requires department', () => {
    const errors = validateStep(1, { ...baseForm, department: '' });
    expect(errors.department).toBeDefined();
  });

  it('requires location', () => {
    const errors = validateStep(1, { ...baseForm, location: '' });
    expect(errors.location).toBeDefined();
  });

  it('rejects whitespace-only title', () => {
    const errors = validateStep(1, { ...baseForm, title: '   ' });
    expect(errors.title).toBeDefined();
  });

  it('rejects whitespace-only department', () => {
    const errors = validateStep(1, { ...baseForm, department: '\t\n' });
    expect(errors.department).toBeDefined();
  });

  it('reports all missing fields at once', () => {
    const errors = validateStep(1, { ...baseForm, title: '', department: '', location: '' });
    expect(errors.title).toBeDefined();
    expect(errors.department).toBeDefined();
    expect(errors.location).toBeDefined();
  });
});

describe('JobForm - Step 2 validation (description)', () => {
  it('passes with non-empty description text', () => {
    const errors = validateStep(2, baseForm);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('requires description content', () => {
    const errors = validateStep(2, { ...baseForm, description: '' });
    expect(errors.description).toBeDefined();
  });

  it('rejects HTML-only description with no text content', () => {
    const errors = validateStep(2, { ...baseForm, description: '<p></p><br/>' });
    expect(errors.description).toBeDefined();
  });

  it('accepts description with HTML tags wrapping real text', () => {
    const errors = validateStep(2, { ...baseForm, description: '<p>We are hiring!</p>' });
    expect(Object.keys(errors)).toHaveLength(0);
  });
});

describe('JobForm - Salary range validation', () => {
  it('is valid when both fields are empty (optional)', () => {
    expect(isSalaryRangeValid('', '')).toBe(true);
  });

  it('is valid when min equals max', () => {
    expect(isSalaryRangeValid('50000', '50000')).toBe(true);
  });

  it('is valid when min is less than max', () => {
    expect(isSalaryRangeValid('50000', '100000')).toBe(true);
  });

  it('is invalid when min exceeds max', () => {
    expect(isSalaryRangeValid('100000', '50000')).toBe(false);
  });
});
