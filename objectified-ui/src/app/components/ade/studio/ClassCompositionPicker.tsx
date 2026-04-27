'use client';

import * as React from 'react';
import {
  Layers,
  GitFork,
  Split,
  Combine,
  Box,
  ChevronDown,
  X,
  Check,
  Plus,
} from 'lucide-react';
import { cn } from '../../../../../lib/utils';

/**
 * Composition picker for ClassEditDialog.
 *
 * Replaces the legacy three-up MultiSelect grid with:
 *   1. Four radio cards (Standalone / Extends / Variant / Union) that
 *      reflect the *primary* mode derived from current data.
 *   2. A contextual class-ref picker for the active mode.
 *   3. A "+ Combine modes" disclosure that lets power users layer the
 *      other arrays on top (mirrors the underlying allOf/anyOf/oneOf
 *      data model so existing classes round-trip correctly).
 *
 * The data model is unchanged: the parent owns three `string[]`
 * arrays of class names. We just give the user a clearer mental model
 * for what each array means.
 */

export type CompositionMode = 'standalone' | 'extends' | 'variant' | 'union' | 'mixed';

export interface ClassCompositionValue {
  allOf: string[];
  anyOf: string[];
  oneOf: string[];
}

export interface ClassCompositionPickerProps {
  value: ClassCompositionValue;
  availableClasses: string[];
  disabled?: boolean;
  onChange: (next: ClassCompositionValue) => void;
}

interface CardSpec {
  id: Exclude<CompositionMode, 'mixed'>;
  label: string;
  short: string;
  icon: React.ReactNode;
  blurb: string;
  example: string;
  accent: 'slate' | 'indigo' | 'purple' | 'amber';
}

const CARDS: CardSpec[] = [
  {
    id: 'standalone',
    label: 'Standalone',
    short: 'No composition',
    icon: <Box className="h-4 w-4" />,
    blurb: 'A self-contained class with its own properties.',
    example: 'No relationships',
    accent: 'slate',
  },
  {
    id: 'extends',
    label: 'Extends',
    short: 'allOf',
    icon: <Layers className="h-4 w-4" />,
    blurb: 'Inherits properties from one or more base classes.',
    example: 'User extends Person',
    accent: 'indigo',
  },
  {
    id: 'variant',
    label: 'Variant',
    short: 'oneOf',
    icon: <Split className="h-4 w-4" />,
    blurb: 'Each instance is exactly one of a closed set of types.',
    example: 'Pet = Dog | Cat | Bird',
    accent: 'purple',
  },
  {
    id: 'union',
    label: 'Union',
    short: 'anyOf',
    icon: <Combine className="h-4 w-4" />,
    blurb: 'Each instance satisfies at least one of several schemas.',
    example: 'Contact = Email or Phone',
    accent: 'amber',
  },
];

const ACCENT: Record<CardSpec['accent'], { bg: string; ring: string; pill: string; chip: string }> = {
  slate: {
    bg: 'from-slate-50 to-white dark:from-slate-800/60 dark:to-slate-900',
    ring: 'ring-slate-400 dark:ring-slate-500',
    pill: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    chip: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  },
  indigo: {
    bg: 'from-indigo-50 to-white dark:from-indigo-950/40 dark:to-slate-900',
    ring: 'ring-indigo-400 dark:ring-indigo-500',
    pill: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200',
    chip: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200',
  },
  purple: {
    bg: 'from-purple-50 to-white dark:from-purple-950/40 dark:to-slate-900',
    ring: 'ring-purple-400 dark:ring-purple-500',
    pill: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-200',
    chip: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200',
  },
  amber: {
    bg: 'from-amber-50 to-white dark:from-amber-950/40 dark:to-slate-900',
    ring: 'ring-amber-400 dark:ring-amber-500',
    pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  },
};

const deriveMode = (v: ClassCompositionValue): CompositionMode => {
  const flags = [v.allOf.length > 0, v.anyOf.length > 0, v.oneOf.length > 0];
  const count = flags.filter(Boolean).length;
  if (count === 0) return 'standalone';
  if (count > 1) return 'mixed';
  if (v.allOf.length > 0) return 'extends';
  if (v.oneOf.length > 0) return 'variant';
  return 'union';
};

const KEY_FOR: Record<Exclude<CompositionMode, 'standalone' | 'mixed'>, keyof ClassCompositionValue> = {
  extends: 'allOf',
  variant: 'oneOf',
  union: 'anyOf',
};

const ACCENT_FOR: Record<keyof ClassCompositionValue, CardSpec['accent']> = {
  allOf: 'indigo',
  oneOf: 'purple',
  anyOf: 'amber',
};

const LABEL_FOR: Record<keyof ClassCompositionValue, string> = {
  allOf: 'Bases (allOf)',
  oneOf: 'Variants (oneOf)',
  anyOf: 'Members (anyOf)',
};

const PLACEHOLDER_FOR: Record<keyof ClassCompositionValue, string> = {
  allOf: 'Pick base classes…',
  oneOf: 'Pick variant classes…',
  anyOf: 'Pick member classes…',
};

interface ChipPickerProps {
  label: string;
  accent: CardSpec['accent'];
  values: string[];
  options: string[];
  placeholder: string;
  disabled?: boolean;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  onClear?: () => void;
}

const ChipPicker: React.FC<ChipPickerProps> = ({
  label,
  accent,
  values,
  options,
  placeholder,
  disabled,
  onAdd,
  onRemove,
  onClear,
}) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const accentTokens = ACCENT[accent];

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const remaining = options.filter((o) => !values.includes(o));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
          {label}
        </span>
        {values.length > 0 && onClear && !disabled && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
          >
            Clear
          </button>
        )}
      </div>
      <div ref={ref} className="relative">
        {/* Trigger is rendered as a div (not a button) because it contains
            per-chip remove buttons. Nested <button>s are invalid HTML and
            cause a hydration warning. We restore button semantics with
            role/tabIndex/keydown so it's still keyboard-accessible. */}
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled || undefined}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => {
            if (disabled) return;
            setOpen((v) => !v);
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpen((v) => !v);
            } else if (e.key === 'Escape' && open) {
              setOpen(false);
            }
          }}
          className={cn(
            'w-full min-h-[40px] rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-left flex flex-wrap gap-1 items-center text-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60',
            disabled && 'opacity-60 cursor-not-allowed',
          )}
        >
          {values.length === 0 ? (
            <span className="text-slate-400">{placeholder}</span>
          ) : (
            values.map((v) => (
              <span
                key={v}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium',
                  accentTokens.chip,
                )}
              >
                {v}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(v);
                    }}
                    className="hover:bg-black/10 rounded p-0.5"
                    aria-label={`Remove ${v}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))
          )}
          <ChevronDown className="h-4 w-4 ml-auto text-slate-400 shrink-0" />
        </div>
        {open && remaining.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg max-h-48 overflow-auto">
            {remaining.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onAdd(opt);
                }}
                className="block w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                {opt}
              </button>
            ))}
          </div>
        )}
        {open && remaining.length === 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg px-3 py-2 text-xs text-slate-500">
            {options.length === 0 ? 'No other classes in this version yet.' : 'All classes already selected.'}
          </div>
        )}
      </div>
    </div>
  );
};

export const ClassCompositionPicker: React.FC<ClassCompositionPickerProps> = ({
  value,
  availableClasses,
  disabled,
  onChange,
}) => {
  const derivedMode = deriveMode(value);
  const [pendingMode, setPendingMode] = React.useState<Exclude<CompositionMode, 'mixed'> | null>(null);
  const [combineOpen, setCombineOpen] = React.useState(derivedMode === 'mixed');

  React.useEffect(() => {
    // If data drifts into mixed (e.g. AI patch applied multiple arrays),
    // surface combine UI automatically.
    if (derivedMode === 'mixed') setCombineOpen(true);
  }, [derivedMode]);

  // The "active" card is whatever the user most recently selected, or
  // the derived mode if they haven't requested anything else.
  const activeMode: Exclude<CompositionMode, 'mixed'> =
    pendingMode ?? (derivedMode === 'mixed' ? 'extends' : derivedMode);

  const onCardClick = (mode: Exclude<CompositionMode, 'mixed'>) => {
    if (disabled) return;
    if (mode === 'standalone') {
      const hasAny = value.allOf.length + value.anyOf.length + value.oneOf.length > 0;
      if (hasAny) {
        const ok = typeof window === 'undefined'
          ? true
          : window.confirm(
              'Switch to Standalone? This will clear all composition refs (allOf, anyOf, oneOf).',
            );
        if (!ok) return;
        onChange({ allOf: [], anyOf: [], oneOf: [] });
      }
      setPendingMode('standalone');
      setCombineOpen(false);
      return;
    }
    setPendingMode(mode);
    // If the user explicitly clicks a different mode while data is mixed,
    // keep combine open so they can see/manage the other arrays.
    if (derivedMode === 'mixed') setCombineOpen(true);
  };

  const updateArray = (key: keyof ClassCompositionValue, next: string[]) => {
    onChange({ ...value, [key]: next });
  };

  const renderPicker = (mode: Exclude<CompositionMode, 'standalone' | 'mixed'>) => {
    const key = KEY_FOR[mode];
    const accent = ACCENT_FOR[key];
    const card = CARDS.find((c) => c.id === mode)!;
    return (
      <div
        className={cn(
          'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-3 space-y-2',
        )}
      >
        <div className="flex items-start gap-2">
          <span
            className={cn(
              'inline-flex items-center justify-center w-7 h-7 rounded-md',
              ACCENT[accent].pill,
            )}
          >
            {card.icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {card.label}
              <span className="ml-1.5 text-[11px] font-mono font-normal text-slate-500 dark:text-slate-400">
                {card.short}
              </span>
            </div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 m-0">{card.blurb}</p>
          </div>
        </div>
        <ChipPicker
          label={LABEL_FOR[key]}
          accent={accent}
          values={value[key]}
          options={availableClasses}
          placeholder={PLACEHOLDER_FOR[key]}
          disabled={disabled}
          onAdd={(name) => updateArray(key, [...value[key], name])}
          onRemove={(name) => updateArray(key, value[key].filter((v) => v !== name))}
          onClear={() => updateArray(key, [])}
        />
      </div>
    );
  };

  // Determine which secondary pickers to show in combine mode. We show
  // pickers for any non-empty array plus the active picker, plus any
  // requested mode. Standalone hides all pickers.
  const visibleKeys = (() => {
    if (activeMode === 'standalone') return [] as Array<keyof ClassCompositionValue>;
    const keys = new Set<keyof ClassCompositionValue>();
    keys.add(KEY_FOR[activeMode]);
    if (combineOpen) {
      (Object.keys(KEY_FOR) as Array<Exclude<CompositionMode, 'standalone' | 'mixed'>>).forEach(
        (m) => {
          if (value[KEY_FOR[m]].length > 0) keys.add(KEY_FOR[m]);
        },
      );
    } else {
      // If not combining but other arrays still have content, include
      // them so we don't hide live data.
      (Object.keys(KEY_FOR) as Array<Exclude<CompositionMode, 'standalone' | 'mixed'>>).forEach(
        (m) => {
          if (value[KEY_FOR[m]].length > 0) keys.add(KEY_FOR[m]);
        },
      );
    }
    // Render in canonical order: allOf → oneOf → anyOf
    const order: Array<keyof ClassCompositionValue> = ['allOf', 'oneOf', 'anyOf'];
    return order.filter((k) => keys.has(k));
  })();

  return (
    <div className="space-y-3">
      {/* Radio cards */}
      <div
        role="radiogroup"
        aria-label="Composition mode"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2"
      >
        {CARDS.map((card) => {
          const selected =
            activeMode === card.id ||
            (derivedMode === 'mixed' && pendingMode === null && card.id !== 'standalone' && value[KEY_FOR[card.id as Exclude<CompositionMode, 'standalone' | 'mixed'>] ?? 'allOf']?.length > 0);
          const accent = ACCENT[card.accent];
          return (
            <button
              key={card.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onCardClick(card.id)}
              className={cn(
                'group relative text-left rounded-lg border p-3 transition-all bg-gradient-to-br',
                accent.bg,
                selected
                  ? cn('border-transparent ring-2 shadow-sm', accent.ring)
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
                disabled && 'opacity-60 cursor-not-allowed',
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center justify-center w-7 h-7 rounded-md',
                    accent.pill,
                  )}
                >
                  {card.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    {card.label}
                    {selected && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                  </div>
                  <div className="text-[10.5px] font-mono text-slate-500 dark:text-slate-400">
                    {card.short}
                  </div>
                </div>
              </div>
              <p className="mt-1.5 mb-0 text-[11.5px] text-slate-600 dark:text-slate-300 leading-snug">
                {card.blurb}
              </p>
              <p className="mt-1 mb-0 text-[10.5px] italic text-slate-500 dark:text-slate-400">
                {card.example}
              </p>
            </button>
          );
        })}
      </div>

      {/* Mixed-mode banner */}
      {derivedMode === 'mixed' && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <GitFork className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            This class combines multiple composition modes. Each picker below is editable; pick a card to focus
            one, or remove items to simplify.
          </span>
        </div>
      )}

      {/* Pickers */}
      {visibleKeys.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {visibleKeys.map((key) => {
            const mode = (Object.keys(KEY_FOR) as Array<Exclude<CompositionMode, 'standalone' | 'mixed'>>).find(
              (m) => KEY_FOR[m] === key,
            );
            return mode ? <React.Fragment key={key}>{renderPicker(mode)}</React.Fragment> : null;
          })}
        </div>
      )}

      {/* Combine toggle */}
      {activeMode !== 'standalone' && visibleKeys.length < 3 && !disabled && (
        <button
          type="button"
          onClick={() => setCombineOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200"
        >
          {combineOpen ? (
            <>
              <ChevronDown className="h-3.5 w-3.5 rotate-180" />
              Hide unused composition modes
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" />
              Combine with another mode
            </>
          )}
        </button>
      )}

      {/* Combine pickers (the modes whose arrays are currently empty) */}
      {combineOpen && activeMode !== 'standalone' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
          {(Object.keys(KEY_FOR) as Array<Exclude<CompositionMode, 'standalone' | 'mixed'>>)
            .filter((m) => !visibleKeys.includes(KEY_FOR[m]))
            .map((m) => (
              <React.Fragment key={m}>{renderPicker(m)}</React.Fragment>
            ))}
        </div>
      )}
    </div>
  );
};
