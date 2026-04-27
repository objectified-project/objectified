'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
} from '../../ui/Dialog';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { useDarkMode } from '@/app/hooks/useDarkMode';
import { PropertyFormData } from './PropertyFormFields';
import { cn } from '../../../../../lib/utils';
import {
  Search,
  X,
  Shield,
  User,
  Sparkles,
  Database,
  Loader2,
  CornerDownLeft,
  Link2Off,
  History,
} from 'lucide-react';

export interface Primitive {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  category: string;
  schema: Record<string, unknown>;
  tags: string[];
  created_by: string | null;
  is_system: boolean;
  is_public: boolean;
  usage_count: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface PrimitiveSelectorProps {
  formData: PropertyFormData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (field: keyof PropertyFormData, value: any) => void;
  propertyType: string;
  onPrimitiveApplied?: (primitive: Primitive) => void;
  /** Notified when the palette opens or closes (e.g. to dim the parent form). */
  onOpenChange?: (open: boolean) => void;
  /** Trigger button size. */
  size?: 'small' | 'medium';
  /** When true, hides the trigger button (palette must be opened via the global ⌘K shortcut or a controlled open prop). */
  hideTrigger?: boolean;
  /** Controlled palette-open state. When provided, the component is fully controlled. */
  open?: boolean;
  /** Override the trigger button label. */
  triggerLabel?: string;
}

const propertyTypeToPrimitiveCategory: Record<string, string> = {
  string: 'string',
  number: 'number',
  integer: 'integer',
  boolean: 'boolean',
  array: 'array',
  object: 'object',
};

const RECENT_STORAGE_KEY = 'property-dialog-recent-primitives';
const MAX_RECENT = 6;

const loadRecent = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
};

const saveRecent = (ids: string[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
  } catch {
    /* ignore */
  }
};

const summarizeSchema = (schema: Record<string, unknown>): string => {
  const parts: string[] = [];
  if (schema.format) parts.push(`format=${schema.format}`);
  if (schema.pattern) parts.push('pattern');
  if (schema.minLength !== undefined || schema.maxLength !== undefined) {
    parts.push(`len ${schema.minLength ?? '·'}–${schema.maxLength ?? '·'}`);
  }
  if (schema.minimum !== undefined || schema.maximum !== undefined) {
    parts.push(`range ${schema.minimum ?? '·'}–${schema.maximum ?? '·'}`);
  }
  if (schema.enum && Array.isArray(schema.enum)) parts.push(`enum(${schema.enum.length})`);
  if (schema.multipleOf !== undefined) parts.push(`×${schema.multipleOf}`);
  return parts.join(' · ') || 'no constraints';
};

export const PrimitiveSelector: React.FC<PrimitiveSelectorProps> = ({
  formData,
  onChange,
  propertyType,
  onPrimitiveApplied,
  onOpenChange,
  size = 'small',
  hideTrigger = false,
  open: controlledOpen,
  triggerLabel = 'Apply primitive…',
}) => {
  const isDark = useDarkMode();

  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
    },
    [isControlled],
  );
  const [loading, setLoading] = useState(false);
  const [primitives, setPrimitives] = useState<Primitive[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const setOpenState = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
      if (next) {
        setSearchQuery('');
        setActiveIndex(0);
      }
    },
    [onOpenChange, setOpen],
  );

  const fetchPrimitives = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const category = propertyTypeToPrimitiveCategory[propertyType];
      const url = category ? `/api/primitives?category=${category}` : '/api/primitives';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch primitives');
      const data = await response.json();
      if (data.success) {
        setPrimitives(data.primitives || []);
      } else {
        setError(data.error || 'Failed to load primitives');
      }
    } catch (err) {
      console.error('Error fetching primitives:', err);
      setError(err instanceof Error ? err.message : 'Failed to load primitives');
    } finally {
      setLoading(false);
    }
  }, [propertyType]);

  useEffect(() => {
    if (open) {
      fetchPrimitives();
      setRecentIds(loadRecent());
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, fetchPrimitives]);

  // Global ⌘K / Ctrl+K shortcut to open the palette.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpenState(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setOpenState]);

  // Filter + group results.
  const { filtered, groups } = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matches = primitives.filter((p) => {
      if (!query) return true;
      return (
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    });

    const sorted = [...matches].sort((a, b) => {
      if (a.is_system !== b.is_system) return a.is_system ? 1 : -1;
      return a.name.localeCompare(b.name);
    });

    const recents = recentIds
      .map((id) => sorted.find((p) => p.id === id))
      .filter((p): p is Primitive => Boolean(p));

    const recentSet = new Set(recents.map((p) => p.id));
    const rest = sorted.filter((p) => !recentSet.has(p.id));

    const ordered: Primitive[] = !query ? [...recents, ...rest] : sorted;

    const grouped: Array<{ id: string; label: string; items: Primitive[] }> = [];
    if (!query && recents.length > 0) {
      grouped.push({ id: 'recent', label: 'Recently used', items: recents });
    }
    if (rest.length > 0 || query) {
      const items = !query ? rest : sorted;
      const byCategory = new Map<string, Primitive[]>();
      for (const p of items) {
        const key = p.category || 'other';
        const arr = byCategory.get(key) ?? [];
        arr.push(p);
        byCategory.set(key, arr);
      }
      const categories = Array.from(byCategory.keys()).sort();
      for (const cat of categories) {
        grouped.push({
          id: `cat-${cat}`,
          label: cat.charAt(0).toUpperCase() + cat.slice(1),
          items: byCategory.get(cat) ?? [],
        });
      }
    }

    return { filtered: ordered, groups: grouped };
  }, [primitives, searchQuery, recentIds]);

  useEffect(() => {
    if (activeIndex >= filtered.length) {
      setActiveIndex(filtered.length === 0 ? 0 : Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, activeIndex]);

  // Keep the active row in view.
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(
      `[data-primitive-index="${activeIndex}"]`,
    );
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const applyPrimitive = (primitive: Primitive) => {
    const schema = primitive.schema;

    onChange('format', '');
    onChange('pattern', '');
    onChange('minLength', '');
    onChange('maxLength', '');
    onChange('minimum', '');
    onChange('maximum', '');
    onChange('minimumType', undefined);
    onChange('maximumType', undefined);
    onChange('multipleOf', '');
    onChange('minItems', '');
    onChange('maxItems', '');
    onChange('uniqueItems', false);
    onChange('enum', []);
    onChange('default', '');
    onChange('const', '');

    if (schema.format !== undefined) onChange('format', schema.format as string);
    if (schema.pattern !== undefined) onChange('pattern', schema.pattern as string);
    if (schema.minLength !== undefined) onChange('minLength', String(schema.minLength));
    if (schema.maxLength !== undefined) onChange('maxLength', String(schema.maxLength));
    if (schema.minimum !== undefined) {
      onChange('minimum', String(schema.minimum));
      onChange('minimumType', 'inclusive');
    }
    if (schema.exclusiveMinimum !== undefined) {
      onChange('minimum', String(schema.exclusiveMinimum));
      onChange('minimumType', 'exclusive');
    }
    if (schema.maximum !== undefined) {
      onChange('maximum', String(schema.maximum));
      onChange('maximumType', 'inclusive');
    }
    if (schema.exclusiveMaximum !== undefined) {
      onChange('maximum', String(schema.exclusiveMaximum));
      onChange('maximumType', 'exclusive');
    }
    if (schema.multipleOf !== undefined) onChange('multipleOf', String(schema.multipleOf));
    if (schema.minItems !== undefined) onChange('minItems', String(schema.minItems));
    if (schema.maxItems !== undefined) onChange('maxItems', String(schema.maxItems));
    if (schema.uniqueItems !== undefined) onChange('uniqueItems', schema.uniqueItems);
    if (schema.enum !== undefined && Array.isArray(schema.enum)) {
      onChange('enum', schema.enum.map(String));
    }
    if (schema.default !== undefined) onChange('default', String(schema.default));
    if (schema.const !== undefined) {
      onChange(
        'const',
        typeof schema.const === 'string' ? schema.const : JSON.stringify(schema.const),
      );
    }
    if (schema.description && !formData.description) {
      onChange('description', schema.description as string);
    }

    onChange('appliedPrimitive', primitive.name);

    const nextRecent = [primitive.id, ...recentIds.filter((id) => id !== primitive.id)].slice(
      0,
      MAX_RECENT,
    );
    setRecentIds(nextRecent);
    saveRecent(nextRecent);

    onPrimitiveApplied?.(primitive);
    setOpenState(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filtered[activeIndex];
      if (target) applyPrimitive(target);
    }
  };

  const flatToIndex = (groupIdx: number, itemIdx: number) => {
    let n = 0;
    for (let i = 0; i < groupIdx; i += 1) {
      n += groups[i].items.length;
    }
    return n + itemIdx;
  };

  return (
    <>
      {!hideTrigger && (
        <Button
          variant="outline"
          size={size === 'small' ? 'sm' : 'default'}
          onClick={() => setOpenState(true)}
          className="gap-1.5 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/40"
          type="button"
        >
          <Search className="h-3.5 w-3.5" /> {triggerLabel}
          <kbd className="ml-1 hidden sm:inline-flex items-center gap-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1 py-0 text-[10px] font-mono text-slate-500 dark:text-slate-400">
            ⌘K
          </kbd>
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) setOpenState(false);
        }}
        modal={true}
      >
        <DialogPortal>
          <DialogOverlay className="z-[10000] bg-slate-950/40 backdrop-blur-sm" />
          <DialogPrimitive.Content
            className={cn(
              'fixed left-[50%] top-[15%] z-[10001] w-full translate-x-[-50%]',
              'max-w-2xl p-0 flex flex-col overflow-hidden',
              'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl rounded-xl',
            )}
            aria-describedby={undefined}
          >
            <DialogPrimitive.Title className="sr-only">Apply primitive</DialogPrimitive.Title>

            {/* Search input */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <Search className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
              <Input
                ref={inputRef}
                placeholder="Search primitives by name, description, or tags…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onKeyDown}
                className="border-0 shadow-none focus-visible:ring-0 px-0 h-7 text-sm"
                aria-label="Search primitives"
              />
              <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1 py-0 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[420px] overflow-y-auto" onKeyDown={onKeyDown}>
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                </div>
              ) : error ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-sm text-rose-500 mb-3">{error}</p>
                  <Button onClick={fetchPrimitives} variant="outline" size="sm">
                    Retry
                  </Button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <Database className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {searchQuery
                      ? 'No primitives match your search.'
                      : `No ${propertyType} primitives available.`}
                  </p>
                </div>
              ) : (
                <div className="py-1">
                  {groups.map((group, gi) => (
                    <div key={group.id} className="pb-1">
                      <div
                        className={cn(
                          'flex items-center gap-1.5 px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
                          group.id === 'recent'
                            ? 'text-violet-500 dark:text-violet-400'
                            : 'text-slate-400 dark:text-slate-500',
                        )}
                      >
                        {group.id === 'recent' && <History className="h-3 w-3" />}
                        {group.label}
                      </div>
                      {group.items.map((primitive, ii) => {
                        const flatIdx = flatToIndex(gi, ii);
                        const active = flatIdx === activeIndex;
                        return (
                          <button
                            key={primitive.id}
                            type="button"
                            data-primitive-index={flatIdx}
                            onMouseMove={() => setActiveIndex(flatIdx)}
                            onClick={() => applyPrimitive(primitive)}
                            className={cn(
                              'w-full text-left px-4 py-2 flex items-start gap-3 transition-colors',
                              active
                                ? 'bg-violet-50 dark:bg-violet-900/30'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                            )}
                          >
                            <span
                              className={cn(
                                'mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded',
                                primitive.is_system
                                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300'
                                  : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300',
                              )}
                              title={primitive.is_system ? 'System' : 'Tenant'}
                            >
                              {primitive.is_system ? (
                                <Shield className="h-3 w-3" />
                              ) : (
                                <User className="h-3 w-3" />
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[13px] text-slate-900 dark:text-slate-100 truncate">
                                  {primitive.name}
                                </span>
                                <span
                                  className={cn(
                                    'shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded',
                                    'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
                                  )}
                                >
                                  {primitive.category}
                                </span>
                                {primitive.usage_count > 0 && (
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 ml-auto">
                                    {primitive.usage_count}×
                                  </span>
                                )}
                              </div>
                              {primitive.description && (
                                <p className="text-[12px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                  {primitive.description}
                                </p>
                              )}
                              <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                {summarizeSchema(primitive.schema)}
                              </p>
                            </div>
                            {active && (
                              <CornerDownLeft className="h-3.5 w-3.5 mt-1 text-violet-500 dark:text-violet-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className={cn(
                'px-4 py-2 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400',
                isDark ? 'bg-slate-900/60' : 'bg-slate-50/80',
              )}
            >
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1 font-mono text-[10px]">
                  ↑↓
                </kbd>
                Navigate
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1 font-mono text-[10px]">
                  ↵
                </kbd>
                Apply
              </span>
              <span className="ml-auto inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-violet-500" /> {filtered.length} primitive
                {filtered.length === 1 ? '' : 's'}
              </span>
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </>
  );
};

export interface PrimitiveInheritanceBadgeProps {
  primitiveName: string;
  onDetach: () => void;
  onChange?: () => void;
}

/**
 * Compact badge displayed when a property is currently inheriting from a primitive.
 * Offers a Change action (re-open palette) and a Detach action (cut the link).
 */
export const PrimitiveInheritanceBadge: React.FC<PrimitiveInheritanceBadgeProps> = ({
  primitiveName,
  onDetach,
  onChange,
}) => (
  <div className="rounded-xl border border-violet-200 bg-violet-50/70 px-3 py-2 dark:border-violet-900/50 dark:bg-violet-950/30 flex items-center gap-3">
    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300 shrink-0">
      <Sparkles className="h-3.5 w-3.5" />
    </span>
    <div className="min-w-0 flex-1 text-[12px]">
      <div className="text-slate-600 dark:text-slate-400">Inheriting from</div>
      <div className="font-mono text-[13px] text-violet-700 dark:text-violet-300 truncate">
        {primitiveName}
      </div>
    </div>
    {onChange && (
      <Button type="button" variant="ghost" size="sm" onClick={onChange} className="h-7 text-[11px]">
        Change
      </Button>
    )}
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onDetach}
      className="h-7 text-[11px] text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20"
      title="Stop inheriting from this primitive (constraint values are kept as-is)"
    >
      <Link2Off className="h-3 w-3" /> Detach
    </Button>
  </div>
);

export default PrimitiveSelector;
