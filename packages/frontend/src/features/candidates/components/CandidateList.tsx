import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, SlidersHorizontal, ChevronLeft, ChevronRight,
  ChevronUp, ChevronDown, ChevronsUpDown, User, X, Mail, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetCandidatesQuery } from '../candidateApi';
import type { Candidate, CandidateFilters } from '@ats/types';
import { cn } from '@/lib/utils';

// ─── Filter Sidebar ───────────────────────────────────────────────────────────

interface FilterSidebarProps {
  filters: CandidateFilters;
  onChange: (filters: Partial<CandidateFilters>) => void;
  onClear: () => void;
  open: boolean;
}

const SOURCES = ['LinkedIn', 'Indeed', 'Referral', 'Career Portal', 'Agency', 'Other'];
const COMMON_SKILLS = ['React', 'TypeScript', 'Node.js', 'Python', 'Java', 'AWS', 'SQL', 'Docker'];

function FilterSidebar({ filters, onChange, onClear, open }: FilterSidebarProps) {
  const activeCount = [filters.source, filters.location, filters.skills?.length].filter(Boolean).length;

  return (
    <div
      className={cn(
        'shrink-0 transition-all duration-200 overflow-hidden',
        open ? 'w-56' : 'w-0'
      )}
    >
      <div className="w-56 space-y-5 pr-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Filters</span>
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onClear} className="h-6 px-2 text-xs">
              Clear all
            </Button>
          )}
        </div>

        {/* Source filter */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Source</p>
          <div className="space-y-1">
            {SOURCES.map((source) => (
              <label key={source} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  name="source"
                  value={source}
                  checked={filters.source === source}
                  onChange={() => onChange({ source: filters.source === source ? undefined : source })}
                  className="accent-primary"
                />
                <span className="text-sm group-hover:text-foreground text-muted-foreground transition-colors">
                  {source}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Skills filter */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Skills</p>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_SKILLS.map((skill) => {
              const active = filters.skills?.includes(skill);
              return (
                <button
                  key={skill}
                  onClick={() => {
                    const current = filters.skills || [];
                    onChange({
                      skills: active ? current.filter((s) => s !== skill) : [...current, skill],
                    });
                  }}
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full border transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  {skill}
                </button>
              );
            })}
          </div>
        </div>

        {/* Location filter */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</p>
          <Input
            placeholder="e.g. New York"
            value={filters.location || ''}
            onChange={(e) => onChange({ location: e.target.value || undefined })}
            className="h-8 text-sm"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Sort Header ──────────────────────────────────────────────────────────────

interface SortHeaderProps {
  label: string;
  field: string;
  currentSort: { field: string; order: 'asc' | 'desc' };
  onSort: (field: string) => void;
}

function SortHeader({ label, field, currentSort, onSort }: SortHeaderProps) {
  const active = currentSort.field === field;
  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
      {active ? (
        currentSort.order === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
      ) : (
        <ChevronsUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  );
}

// ─── Candidate Row ────────────────────────────────────────────────────────────

function CandidateRow({ candidate, onClick }: { candidate: Candidate; onClick: () => void }) {
  const initials = `${candidate.firstName[0]}${candidate.lastName[0]}`.toUpperCase();
  return (
    <tr
      className="border-b hover:bg-muted/40 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={candidate.avatar} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{candidate.firstName} {candidate.lastName}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" />{candidate.email}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        {candidate.location ? (
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />{candidate.location}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <div className="flex flex-wrap gap-1">
          {candidate.skills?.slice(0, 3).map((s) => (
            <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
          ))}
          {(candidate.skills?.length || 0) > 3 && (
            <Badge variant="outline" className="text-xs">+{candidate.skills.length - 3}</Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        {candidate.source ? (
          <Badge variant="outline" className="text-xs">{candidate.source}</Badge>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground hidden xl:table-cell">
        {new Date(candidate.createdAt).toLocaleDateString()}
      </td>
    </tr>
  );
}

function TableSkeleton() {
  return (
    <>
      {[...Array(8)].map((_, i) => (
        <tr key={i} className="border-b">
          <td className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </td>
          <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-24" /></td>
          <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-5 w-40" /></td>
          <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-5 w-20" /></td>
          <td className="px-4 py-3 hidden xl:table-cell"><Skeleton className="h-4 w-20" /></td>
        </tr>
      ))}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const DEFAULT_FILTERS: CandidateFilters = {
  page: 1,
  limit: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

export function CandidateList() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<CandidateFilters>(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data, isLoading, isFetching } = useGetCandidatesQuery(filters);

  const updateFilters = useCallback((updates: Partial<CandidateFilters>) => {
    setFilters((prev) => ({ ...prev, ...updates, page: 1 }));
  }, []);

  const handleSearch = (value: string) => {
    setSearchInput(value);
    updateFilters({ search: value || undefined });
  };

  const handleSort = (field: string) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleClearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSearchInput('');
  };

  const currentSort = { field: filters.sortBy || 'createdAt', order: filters.sortOrder || 'desc' };
  const meta = data?.meta;
  const candidates = data?.data || [];

  const activeFilterCount = [filters.source, filters.location, filters.skills?.length, filters.search]
    .filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search candidates..."
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 h-9"
          />
          {searchInput && (
            <button
              onClick={() => handleSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Button
          variant={filtersOpen ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="gap-1.5"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge className="h-4 w-4 p-0 flex items-center justify-center text-[10px]">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        <Select
          value={`${filters.limit}`}
          onValueChange={(v) => updateFilters({ limit: Number(v) })}
        >
          <SelectTrigger className="w-[100px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 / page</SelectItem>
            <SelectItem value="20">20 / page</SelectItem>
            <SelectItem value="50">50 / page</SelectItem>
          </SelectContent>
        </Select>

        {meta && (
          <span className="text-sm text-muted-foreground ml-auto">
            {meta.total} candidate{meta.total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex gap-4">
        <FilterSidebar
          filters={filters}
          onChange={updateFilters}
          onClear={handleClearFilters}
          open={filtersOpen}
        />

        <div className="flex-1 min-w-0">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-4 py-3 text-left">
                        <SortHeader label="Candidate" field="firstName" currentSort={currentSort} onSort={handleSort} />
                      </th>
                      <th className="px-4 py-3 text-left hidden md:table-cell">
                        <SortHeader label="Location" field="location" currentSort={currentSort} onSort={handleSort} />
                      </th>
                      <th className="px-4 py-3 text-left hidden lg:table-cell">
                        <span className="text-xs font-medium text-muted-foreground">Skills</span>
                      </th>
                      <th className="px-4 py-3 text-left hidden sm:table-cell">
                        <SortHeader label="Source" field="source" currentSort={currentSort} onSort={handleSort} />
                      </th>
                      <th className="px-4 py-3 text-left hidden xl:table-cell">
                        <SortHeader label="Added" field="createdAt" currentSort={currentSort} onSort={handleSort} />
                      </th>
                    </tr>
                  </thead>
                  <tbody className={cn(isFetching && !isLoading && 'opacity-60 transition-opacity')}>
                    {isLoading ? (
                      <TableSkeleton />
                    ) : candidates.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-16 text-center">
                          <User className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                          <p className="text-sm text-muted-foreground">No candidates found</p>
                          {activeFilterCount > 0 && (
                            <Button variant="link" size="sm" onClick={handleClearFilters} className="mt-2">
                              Clear filters
                            </Button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      candidates.map((candidate) => (
                        <CandidateRow
                          key={candidate.id}
                          candidate={candidate}
                          onClick={() => navigate(`/candidates/${candidate.id}`)}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {meta.page} of {meta.totalPages}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilters((p) => ({ ...p, page: (p.page || 1) - 1 }))}
                      disabled={!meta.hasPrevPage}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {/* Page numbers */}
                    {Array.from({ length: Math.min(5, meta.totalPages) }, (_, i) => {
                      const page = Math.max(1, Math.min(meta.page - 2, meta.totalPages - 4)) + i;
                      return (
                        <Button
                          key={page}
                          variant={page === meta.page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setFilters((p) => ({ ...p, page }))}
                          className="h-8 w-8 p-0 text-xs"
                        >
                          {page}
                        </Button>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilters((p) => ({ ...p, page: (p.page || 1) + 1 }))}
                      disabled={!meta.hasNextPage}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
