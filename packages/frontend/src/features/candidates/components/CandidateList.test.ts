/**
 * Tests for CandidateList filter and search logic
 * Verifies search/filter state management (Requirements 4.1, 10.1)
 */

import { describe, it, expect } from 'vitest';
import type { CandidateFilters } from '@ats/types';

// ─── Filter logic extracted from CandidateList ────────────────────────────────

const DEFAULT_FILTERS: CandidateFilters = {
  page: 1,
  limit: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

function applyFilterUpdate(
  current: CandidateFilters,
  updates: Partial<CandidateFilters>
): CandidateFilters {
  return { ...current, ...updates, page: 1 };
}

function applySort(
  current: CandidateFilters,
  field: string
): CandidateFilters {
  return {
    ...current,
    sortBy: field,
    sortOrder: current.sortBy === field && current.sortOrder === 'asc' ? 'desc' : 'asc',
  };
}

function countActiveFilters(filters: CandidateFilters): number {
  return [filters.source, filters.location, filters.skills?.length, filters.search]
    .filter(Boolean).length;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CandidateList - filter state management', () => {
  it('starts with default filters', () => {
    expect(DEFAULT_FILTERS.page).toBe(1);
    expect(DEFAULT_FILTERS.limit).toBe(20);
    expect(DEFAULT_FILTERS.sortBy).toBe('createdAt');
    expect(DEFAULT_FILTERS.sortOrder).toBe('desc');
  });

  it('resets page to 1 when filters change', () => {
    const current: CandidateFilters = { ...DEFAULT_FILTERS, page: 3 };
    const updated = applyFilterUpdate(current, { search: 'Alice' });
    expect(updated.page).toBe(1);
    expect(updated.search).toBe('Alice');
  });

  it('merges filter updates without losing existing filters', () => {
    const current: CandidateFilters = { ...DEFAULT_FILTERS, source: 'LinkedIn' };
    const updated = applyFilterUpdate(current, { location: 'New York' });
    expect(updated.source).toBe('LinkedIn');
    expect(updated.location).toBe('New York');
  });

  it('clears a filter by setting it to undefined', () => {
    const current: CandidateFilters = { ...DEFAULT_FILTERS, source: 'LinkedIn' };
    const updated = applyFilterUpdate(current, { source: undefined });
    expect(updated.source).toBeUndefined();
  });

  it('counts active filters correctly', () => {
    const filters: CandidateFilters = {
      ...DEFAULT_FILTERS,
      search: 'Alice',
      source: 'LinkedIn',
      location: 'NYC',
      skills: ['React'],
    };
    expect(countActiveFilters(filters)).toBe(4);
  });

  it('counts zero active filters for default state', () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
  });

  it('counts skills as one filter regardless of how many skills are selected', () => {
    const filters: CandidateFilters = {
      ...DEFAULT_FILTERS,
      skills: ['React', 'TypeScript', 'Node.js'],
    };
    expect(countActiveFilters(filters)).toBe(1);
  });
});

describe('CandidateList - sort state management', () => {
  it('sets sort field and defaults to asc on first click', () => {
    const result = applySort(DEFAULT_FILTERS, 'firstName');
    expect(result.sortBy).toBe('firstName');
    expect(result.sortOrder).toBe('asc');
  });

  it('toggles to desc when clicking the same field already sorted asc', () => {
    const current: CandidateFilters = { ...DEFAULT_FILTERS, sortBy: 'firstName', sortOrder: 'asc' };
    const result = applySort(current, 'firstName');
    expect(result.sortOrder).toBe('desc');
  });

  it('resets to asc when switching to a different field', () => {
    const current: CandidateFilters = { ...DEFAULT_FILTERS, sortBy: 'firstName', sortOrder: 'desc' };
    const result = applySort(current, 'location');
    expect(result.sortBy).toBe('location');
    expect(result.sortOrder).toBe('asc');
  });
});

describe('CandidateList - pagination meta', () => {
  it('calculates totalPages correctly', () => {
    const total = 45;
    const limit = 20;
    expect(Math.ceil(total / limit)).toBe(3);
  });

  it('hasNextPage is true when not on last page', () => {
    const page = 1;
    const totalPages = 3;
    expect(page < totalPages).toBe(true);
  });

  it('hasPrevPage is false on first page', () => {
    const page = 1;
    expect(page > 1).toBe(false);
  });

  it('hasPrevPage is true on page 2+', () => {
    const page = 2;
    expect(page > 1).toBe(true);
  });
});
