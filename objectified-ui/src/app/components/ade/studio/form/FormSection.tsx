'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { cn } from '../../../../../../lib/utils';

/**
 * Form design-system primitives used across the Class and Property dialogs.
 *
 * Visual contract:
 * - Sections use an uppercase tracked eyebrow + an h3 title. One indigo accent
 *   by default; other accents ("amber", "orange", "purple") are reserved for
 *   semantic callouts (e.g. XML, oneOf) and must be used sparingly.
 * - Subsections are cards inside a section. They inherit the same rhythm but
 *   use a smaller icon/title and a subtle border.
 * - FieldGroup is the standard label + input + helper/error wrapper. It
 *   replaces the ad-hoc `<div className="space-y-2"><Label/>...</div>`
 *   pattern.
 */

const ACCENT_ICON: Record<AccentColor, string> = {
  indigo: 'text-indigo-500 dark:text-indigo-400',
  amber: 'text-amber-500 dark:text-amber-400',
  orange: 'text-orange-500 dark:text-orange-400',
  purple: 'text-purple-500 dark:text-purple-400',
  violet: 'text-violet-500 dark:text-violet-400',
  emerald: 'text-emerald-500 dark:text-emerald-400',
  sky: 'text-sky-500 dark:text-sky-400',
  rose: 'text-rose-500 dark:text-rose-400',
  slate: 'text-slate-500 dark:text-slate-400',
};

const ACCENT_EYEBROW: Record<AccentColor, string> = {
  indigo: 'text-indigo-600 dark:text-indigo-400',
  amber: 'text-amber-600 dark:text-amber-400',
  orange: 'text-orange-600 dark:text-orange-400',
  purple: 'text-purple-600 dark:text-purple-400',
  violet: 'text-violet-600 dark:text-violet-300',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  sky: 'text-sky-600 dark:text-sky-300',
  rose: 'text-rose-600 dark:text-rose-400',
  slate: 'text-slate-500 dark:text-slate-400',
};

/**
 * Background + text classes for the small icon swatch tile that sits at
 * the start of every section header. Tints are intentionally muted so a
 * dialog full of swatches doesn't read as "every section is a callout".
 */
const ACCENT_SWATCH: Record<AccentColor, string> = {
  indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
  orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300',
  purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300',
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300',
  rose: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

export type AccentColor =
  | 'indigo'
  | 'amber'
  | 'orange'
  | 'purple'
  | 'violet'
  | 'emerald'
  | 'sky'
  | 'rose'
  | 'slate';

/**
 * Per-section status used by the dot-state nav and the collapsed-stub
 * affordance. `empty` is the default for untouched optional sections;
 * `filled` means the user has changed at least one default; `warn` and
 * `error` come from the lint pass and dominate over filled.
 */
export type FormSectionStatus = 'empty' | 'filled' | 'warn' | 'error';

export interface FormSectionProps {
  /** Stable id used by the sidebar nav and scroll-spy. */
  id?: string;
  /** Lucide icon node (14-16px) rendered before the title. */
  icon?: React.ReactNode;
  /** Uppercase tracked eyebrow label (e.g. "Step 1", "Essentials"). */
  eyebrow?: string;
  /** Section title (h3). */
  title: string;
  /** Optional one-line description shown under the title. */
  description?: React.ReactNode;
  /** Small pill rendered to the right of the title (e.g. "Optional", "OpenAPI 3.1"). */
  badge?: React.ReactNode;
  /** Right-aligned header slot, typically an "Add" button. */
  action?: React.ReactNode;
  /**
   * Tiny right-aligned summary rendered next to (or instead of) `action`.
   * Use for at-a-glance counts like `2 of 4 fields` or `2 base · 0 alt`.
   * Rendered in mono so it matches the mockup's "stat" treatment.
   */
  stat?: React.ReactNode;
  /** Subtle amber ring and dot signalling this section contains non-default values. */
  changed?: boolean;
  /**
   * Richer status replacing the boolean `changed`. When provided, drives the
   * header dot color (rose / amber / indigo / outline) and the collapsed-stub
   * call-to-action copy. `changed` is still respected for backwards-compat
   * with sections that haven't been migrated yet.
   */
  status?: FormSectionStatus;
  /** Color accent applied to icon and eyebrow. Defaults to indigo. */
  accent?: AccentColor;
  /** Tightens vertical padding. Use inside already-padded containers. */
  dense?: boolean;
  /**
   * Lets the section render as a collapsed stub (header only) until clicked.
   * Use sparingly — required sections should always render expanded.
   */
  collapsible?: boolean;
  /** Controlled expanded state. When provided, `defaultExpanded` is ignored. */
  expanded?: boolean;
  /** Initial expanded state for the uncontrolled case. Defaults to true. */
  defaultExpanded?: boolean;
  /** Fires when the user clicks the collapsed-stub header to toggle. */
  onExpandedChange?: (next: boolean) => void;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

const STATUS_DOT: Record<FormSectionStatus, string> = {
  empty:
    'border-2 border-slate-300 dark:border-slate-600 bg-transparent',
  filled: 'bg-amber-400',
  warn: 'bg-amber-500 ring-2 ring-amber-400/30',
  error: 'bg-rose-500 ring-2 ring-rose-400/30',
};

const STATUS_LABEL: Record<FormSectionStatus, string> = {
  empty: 'Empty section',
  filled: 'Contains non-default values',
  warn: 'Section has a lint warning',
  error: 'Section has a validation error',
};

export const FormSection = React.forwardRef<HTMLElement, FormSectionProps>(
  (
    {
      id,
      icon,
      eyebrow,
      title,
      description,
      badge,
      action,
      stat,
      changed,
      status,
      accent = 'indigo',
      dense,
      collapsible,
      expanded: controlledExpanded,
      defaultExpanded = true,
      onExpandedChange,
      className,
      headerClassName,
      bodyClassName,
      children,
    },
    ref,
  ) => {
    const [internalExpanded, setInternalExpanded] = React.useState(defaultExpanded);
    const isControlled = controlledExpanded !== undefined;
    const expanded = collapsible ? (isControlled ? controlledExpanded : internalExpanded) : true;
    const toggle = React.useCallback(() => {
      const next = !expanded;
      if (!isControlled) setInternalExpanded(next);
      onExpandedChange?.(next);
    }, [expanded, isControlled, onExpandedChange]);

    // Derive an effective status. If a caller still passes the legacy
    // `changed` boolean we treat it as `filled` so old call-sites keep
    // working without touching them.
    const effectiveStatus: FormSectionStatus = status ?? (changed ? 'filled' : 'empty');
    // Only show the dot when a caller has opted into status semantics
    // (status prop or legacy changed=true). Untouched legacy call-sites
    // continue to render with no dot.
    const showDot = status !== undefined || !!changed;

    const renderDot = () =>
      showDot ? (
        <span
          className={cn(
            'inline-flex h-2 w-2 rounded-full shrink-0',
            STATUS_DOT[effectiveStatus],
          )}
          aria-label={STATUS_LABEL[effectiveStatus]}
          title={STATUS_LABEL[effectiveStatus]}
        />
      ) : null;

    // Card chrome varies with status so warn/error sections read as
    // callouts (matching the amber Examples card in the mockup) and empty
    // collapsed stubs read as dashed placeholders.
    const isCollapsedStub = collapsible && !expanded;
    const cardChrome = isCollapsedStub
      ? 'border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-900/30 hover:border-indigo-300 dark:hover:border-indigo-700/60'
      : effectiveStatus === 'error'
        ? 'border-rose-200 dark:border-rose-800/50 bg-rose-50/40 dark:bg-rose-900/10'
        : effectiveStatus === 'warn'
          ? 'border-amber-200 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-900/10'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60';

    const headerBandPadding = dense ? 'px-4 py-3' : 'px-5 py-3.5';
    const stubHeaderPadding = dense ? 'px-4 py-2.5' : 'px-5 py-3';
    const bodyPadding = dense ? 'p-4' : 'p-5';

    const swatchTone = isCollapsedStub
      ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
      : ACCENT_SWATCH[accent];

    const renderSwatch = () =>
      icon ? (
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
            swatchTone,
          )}
          aria-hidden
        >
          <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
        </span>
      ) : null;

    const titleBlock = (
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {renderSwatch()}
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <span
              className={cn(
                'block text-[10px] font-semibold uppercase tracking-[0.12em] leading-none mb-0.5',
                ACCENT_EYEBROW[accent],
              )}
            >
              {eyebrow}
            </span>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={cn(
                'text-sm font-semibold leading-5 tracking-[-0.005em]',
                isCollapsedStub
                  ? 'text-slate-700 dark:text-slate-300'
                  : 'text-slate-900 dark:text-slate-100',
              )}
            >
              {title}
            </h3>
            {renderDot()}
            {badge && <span className="ml-0.5 flex items-center">{badge}</span>}
          </div>
          {description && !isCollapsedStub && (
            <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {description}
            </p>
          )}
          {description && isCollapsedStub && (
            <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400 line-clamp-1">
              {description}
            </p>
          )}
        </div>
      </div>
    );

    const renderStat = () =>
      stat ? (
        <span className="hidden sm:inline-flex shrink-0 items-center text-[10px] font-mono text-slate-400 dark:text-slate-500">
          {stat}
        </span>
      ) : null;

    return (
      <section
        ref={ref}
        id={id}
        data-section-id={id}
        data-section-status={effectiveStatus}
        data-section-collapsed={isCollapsedStub ? 'true' : undefined}
        className={cn(
          'relative scroll-mt-24 rounded-xl border transition-colors',
          cardChrome,
          className,
        )}
      >
        {isCollapsedStub ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={false}
            className={cn(
              'group flex w-full items-center justify-between gap-3 text-left rounded-xl',
              stubHeaderPadding,
              'hover:bg-white/60 dark:hover:bg-slate-800/40 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60',
              headerClassName,
            )}
          >
            {titleBlock}
            <span className="flex shrink-0 items-center gap-2">
              {renderStat()}
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
                  effectiveStatus === 'empty'
                    ? 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 group-hover:border-indigo-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-300'
                    : effectiveStatus === 'error'
                      ? 'border-rose-300 dark:border-rose-700/60 text-rose-600 dark:text-rose-300'
                      : effectiveStatus === 'warn'
                        ? 'border-amber-300 dark:border-amber-700/60 text-amber-700 dark:text-amber-300'
                        : 'border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-300',
                )}
              >
                {effectiveStatus === 'empty' ? (
                  <>
                    <Plus className="h-3 w-3" />
                    Configure
                  </>
                ) : effectiveStatus === 'error' ? (
                  'Fix'
                ) : effectiveStatus === 'warn' ? (
                  'Review'
                ) : (
                  'Edit'
                )}
              </span>
              <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        ) : (
          <>
            <header
              className={cn(
                'flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b',
                effectiveStatus === 'error'
                  ? 'border-rose-100 dark:border-rose-800/40'
                  : effectiveStatus === 'warn'
                    ? 'border-amber-100 dark:border-amber-800/40'
                    : 'border-slate-100 dark:border-slate-700/60',
                headerBandPadding,
                collapsible &&
                  'cursor-pointer hover:bg-slate-50/40 dark:hover:bg-slate-800/30 transition-colors rounded-t-xl',
                headerClassName,
              )}
              onClick={collapsible ? toggle : undefined}
              role={collapsible ? 'button' : undefined}
              aria-expanded={collapsible ? expanded : undefined}
            >
              {titleBlock}
              <div
                className="flex shrink-0 items-center gap-3"
                onClick={(e) => e.stopPropagation()}
              >
                {renderStat()}
                {action && <div className="flex items-center gap-2">{action}</div>}
                {collapsible && (
                  <button
                    type="button"
                    onClick={toggle}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                    aria-label="Collapse section"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                )}
              </div>
            </header>
            <div className={cn(bodyPadding, 'space-y-4', bodyClassName)}>{children}</div>
          </>
        )}
      </section>
    );
  },
);
FormSection.displayName = 'FormSection';

export interface FormSubsectionProps {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  changed?: boolean;
  accent?: AccentColor;
  /** Slightly stronger background for chromeless fields; defaults to 'card'. */
  tone?: 'card' | 'subtle' | 'flat';
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

const TONE_CLASSES: Record<NonNullable<FormSubsectionProps['tone']>, string> = {
  card: 'bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm',
  subtle: 'bg-slate-50 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-800/70',
  flat: 'bg-transparent border border-dashed border-slate-300 dark:border-slate-700',
};

export const FormSubsection = React.forwardRef<HTMLDivElement, FormSubsectionProps>(
  (
    {
      icon,
      title,
      description,
      badge,
      action,
      changed,
      accent = 'indigo',
      tone = 'card',
      className,
      bodyClassName,
      children,
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl p-5 transition-colors',
          TONE_CLASSES[tone],
          changed && 'ring-1 ring-amber-400/70 dark:ring-amber-400/60',
          className,
        )}
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              {icon && (
                <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center', ACCENT_ICON[accent])}>
                  {icon}
                </span>
              )}
              <h4 className="text-sm font-semibold leading-5 text-slate-900 dark:text-slate-100">
                {title}
              </h4>
              {changed && (
                <span
                  className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400"
                  aria-label="Contains non-default values"
                />
              )}
              {badge && <span className="ml-1 flex items-center">{badge}</span>}
            </div>
            {description && (
              <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
            )}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
        <div className={cn('space-y-4', bodyClassName)}>{children}</div>
      </div>
    );
  },
);
FormSubsection.displayName = 'FormSubsection';

export interface FormFieldGroupProps {
  label?: React.ReactNode;
  htmlFor?: string;
  helper?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  /** Render label and field on a single row when true. */
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const FormFieldGroup = React.forwardRef<HTMLDivElement, FormFieldGroupProps>(
  ({ label, htmlFor, helper, error, required, inline, className, children }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          inline ? 'flex flex-wrap items-center gap-3' : 'flex flex-col gap-1.5',
          className,
        )}
      >
        {label && (
          <label
            htmlFor={htmlFor}
            className="text-sm font-medium leading-none tracking-[0.01em] text-slate-700 dark:text-slate-300"
          >
            {label}
            {required && <span className="ml-1 text-red-600 dark:text-red-400">*</span>}
          </label>
        )}
        <div className={cn(inline ? 'flex-1' : 'w-full')}>{children}</div>
        {(helper || error) && (
          <p
            className={cn(
              'text-xs leading-5',
              error ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400',
              inline && 'basis-full',
            )}
          >
            {error || helper}
          </p>
        )}
      </div>
    );
  },
);
FormFieldGroup.displayName = 'FormFieldGroup';

export interface FormGridProps {
  /** Column count on md+ screens. Caller controls mobile layout via className. */
  cols?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
  children: React.ReactNode;
}

const COL_CLASS: Record<NonNullable<FormGridProps['cols']>, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
};
const GAP_CLASS: Record<NonNullable<FormGridProps['gap']>, string> = {
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-5',
};

/** Simple grid wrapper that keeps the dialog forms on the same rhythm. */
export const FormGrid: React.FC<FormGridProps> = ({ cols = 2, gap = 'md', className, children }) => (
  <div className={cn('grid grid-cols-1', COL_CLASS[cols], GAP_CLASS[gap], className)}>{children}</div>
);

export interface FormEmptyStateProps {
  title?: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const FormEmptyState: React.FC<FormEmptyStateProps> = ({
  title = 'Nothing here yet',
  description,
  icon,
  action,
  className,
}) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 px-6 py-8 text-center',
      className,
    )}
  >
    {icon && <div className="text-slate-400 dark:text-slate-500">{icon}</div>}
    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</p>
    {description && (
      <p className="max-w-md text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
    )}
    {action && <div className="pt-1">{action}</div>}
  </div>
);
