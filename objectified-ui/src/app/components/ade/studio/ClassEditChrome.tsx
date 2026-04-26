'use client';

import * as React from 'react';
import {
  Sparkles,
  Eye,
  ChevronDown,
  FlaskConical,
  Save,
  Undo,
  AlertOctagon,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { cn } from '../../../../../lib/utils';

/**
 * Chrome (header + footer) for ClassEditDialog.
 *
 * The chrome is split out so the dialog body can focus on form rendering.
 * The action callbacks are wired up at the dialog level — this file only
 * cares about layout, accessibility, and visual state.
 */

export interface ClassProgressRingProps {
  /** 0–100. Renders an empty ring at 0 with a muted center label. */
  percent: number;
  /** Tone the ring red when there's a blocking error, amber for warnings. */
  tone?: 'default' | 'warn' | 'error';
  size?: number;
}

export const ClassProgressRing: React.FC<ClassProgressRingProps> = ({
  percent,
  tone = 'default',
  size = 56,
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const radius = 15.5;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 100);
  const stroke =
    tone === 'error' ? '#ef4444' : tone === 'warn' ? '#f59e0b' : '#6366f1';
  const labelClass =
    tone === 'error'
      ? 'text-rose-600 dark:text-rose-300'
      : tone === 'warn'
        ? 'text-amber-700 dark:text-amber-300'
        : 'text-indigo-600 dark:text-indigo-300';
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Class is ${clamped}% filled in`}
    >
      <svg
        viewBox="0 0 36 36"
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          strokeWidth="3"
          stroke="rgba(148, 163, 184, 0.25)"
        />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          stroke={stroke}
          strokeDasharray={circumference.toFixed(2)}
          strokeDashoffset={dashOffset.toFixed(2)}
          style={{ transition: 'stroke-dashoffset 320ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span
          className={cn('text-[13px] font-bold leading-none', clamped === 0 ? 'text-slate-400' : labelClass)}
        >
          {clamped}%
        </span>
        <span className="text-[8px] uppercase tracking-wider text-slate-400 mt-0.5">
          filled
        </span>
      </div>
    </div>
  );
};

export interface ClassTagPill {
  id: string;
  name: string;
  color?: string;
}

export interface ClassEditHeaderProps {
  /** Class name as currently entered. Empty string → "Untitled class". */
  className: string;
  /** Original name for the breadcrumb when editing existing class. */
  originalName?: string;
  /** True when creating a brand-new class. */
  isCreating: boolean;
  isReadOnly: boolean;
  /** Tags currently selected. */
  tags?: ClassTagPill[];
  /** Optional breadcrumb context — e.g. project + version label. */
  contextLabel?: string;
  /** Subtitle line (e.g. "cls_sub · 11 properties · 4 references"). */
  subtitle?: string;
  /** 0–100 fill ring. */
  completenessPercent: number;
  /** Number of unsaved field changes (drives the amber pill). */
  unsavedCount: number;
  /** Lint summary used by the status pills + ring tone. */
  errorCount?: number;
  warnCount?: number;
  /** Toggles the AI sidekick panel. */
  sidekickOpen?: boolean;
  onToggleSidekick?: () => void;
  /** Open the View ▾ side sheet (Schema / YAML / Example / OpenAPI). */
  onOpenViewMenu?: () => void;
  /** Run validation (Cmd+Enter). */
  onValidate?: () => void;
  onClose: () => void;
}

const TONE_FOR = (errors: number, warns: number): 'default' | 'warn' | 'error' =>
  errors > 0 ? 'error' : warns > 0 ? 'warn' : 'default';

export const ClassEditHeader: React.FC<ClassEditHeaderProps> = ({
  className,
  originalName,
  isCreating,
  isReadOnly,
  tags = [],
  contextLabel,
  subtitle,
  completenessPercent,
  unsavedCount,
  errorCount = 0,
  warnCount = 0,
  sidekickOpen,
  onToggleSidekick,
  onOpenViewMenu,
  onValidate,
  onClose,
}) => {
  const tone = TONE_FOR(errorCount, warnCount);
  const displayName = className || (isCreating ? 'Untitled class' : originalName || 'Class');

  return (
    <header
      className={cn(
        'shrink-0 border-b border-slate-200 dark:border-slate-700',
        tone === 'error'
          ? 'bg-gradient-to-r from-rose-50/60 via-white to-amber-50/40 dark:from-rose-950/30 dark:via-slate-900 dark:to-amber-950/20'
          : 'bg-gradient-to-r from-indigo-50/60 via-white to-fuchsia-50/40 dark:from-indigo-950/40 dark:via-slate-900 dark:to-fuchsia-950/30',
      )}
    >
      <div className="px-6 pt-4 pb-3 flex items-start justify-between gap-6">
        <div className="flex items-start gap-4 min-w-0">
          <ClassProgressRing percent={completenessPercent} tone={tone} />

          <div className="min-w-0">
            {/* Breadcrumb / context */}
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{isCreating ? 'New class' : 'Edit class'}</span>
              {contextLabel && (
                <>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <span className="font-mono">{contextLabel}</span>
                </>
              )}
            </div>

            {/* Title row */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <h1
                className={cn(
                  'text-xl font-bold font-mono truncate',
                  !className && 'italic text-slate-400 dark:text-slate-500',
                )}
              >
                {displayName}
              </h1>
              {tags.slice(0, 4).map((tag) => (
                <Badge
                  key={tag.id}
                  variant="secondary"
                  className="gap-1 text-[10px]"
                >
                  {tag.color && <span style={{ color: tag.color }}>●</span>}
                  {tag.name}
                </Badge>
              ))}
              {tags.length > 4 && (
                <span className="text-[10px] text-slate-500">
                  +{tags.length - 4}
                </span>
              )}
              {isReadOnly && (
                <span className="px-2 py-0.5 bg-amber-400 text-black text-xs font-semibold rounded">
                  Read only
                </span>
              )}
              {errorCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 text-[11px] font-semibold">
                  <AlertOctagon className="h-3 w-3" />
                  {errorCount} error{errorCount === 1 ? '' : 's'}
                </span>
              )}
              {warnCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-[11px] font-semibold">
                  <AlertTriangle className="h-3 w-3" />
                  {warnCount} warning{warnCount === 1 ? '' : 's'}
                </span>
              )}
              {unsavedCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {unsavedCount} unsaved
                </span>
              )}
            </div>

            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onToggleSidekick && (
            <Button
              type="button"
              variant={sidekickOpen ? 'default' : 'outline'}
              size="sm"
              onClick={onToggleSidekick}
              className={cn(
                'gap-2',
                !sidekickOpen &&
                  'border-purple-300/60 bg-gradient-to-br from-purple-50 to-indigo-50 text-purple-700 dark:from-purple-900/30 dark:to-indigo-900/30 dark:text-purple-200 dark:border-purple-700/40',
                sidekickOpen &&
                  'bg-gradient-to-br from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700',
              )}
              title={sidekickOpen ? 'Hide AI sidekick' : 'Open AI sidekick'}
            >
              <Sparkles className="h-4 w-4" />
              AI sidekick
            </Button>
          )}
          {onOpenViewMenu && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenViewMenu}
              className="gap-1.5"
              title="View artifacts (JSON, YAML, Example, OpenAPI)"
            >
              <Eye className="h-4 w-4" />
              View
              <ChevronDown className="h-3 w-3" />
            </Button>
          )}
          {onValidate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onValidate}
              className={cn(
                'gap-1.5',
                errorCount > 0 &&
                  'bg-rose-50 dark:bg-rose-900/30 border-rose-300 dark:border-rose-700/50 text-rose-700 dark:text-rose-300',
              )}
              title="Validate (⌘ ⏎)"
            >
              <FlaskConical
                className={cn(
                  'h-4 w-4',
                  errorCount > 0 ? 'text-rose-500' : 'text-emerald-500',
                )}
              />
              {errorCount > 0 ? `${errorCount} error${errorCount === 1 ? '' : 's'}` : 'Validate'}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 text-slate-500"
            aria-label="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export interface ClassEditStatusBarProps {
  unsavedCount: number;
  /** ISO timestamp or human-readable label for last save. */
  lastSavedLabel?: string;
  /** Right-side controls slot — typically the view-mode toggle. */
  rightSlot?: React.ReactNode;
  /** Left-side label slot — typically wizard step indicator. */
  leftLabel?: React.ReactNode;
}

export const ClassEditStatusBar: React.FC<ClassEditStatusBarProps> = ({
  unsavedCount,
  lastSavedLabel,
  rightSlot,
  leftLabel,
}) => {
  return (
    <div className="px-6 py-2 flex items-center justify-between border-t border-slate-200/60 dark:border-slate-700/60 bg-white/40 dark:bg-slate-900/30 shrink-0">
      <div className="text-xs text-slate-500 inline-flex items-center gap-1.5 min-w-0">
        {leftLabel ?? (
          unsavedCount > 0 ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span className="font-medium text-amber-700 dark:text-amber-400">
                Unsaved changes
              </span>
              {lastSavedLabel && (
                <>
                  <span className="text-slate-400">·</span>
                  <span className="truncate">Last saved {lastSavedLabel}</span>
                </>
              )}
            </>
          ) : lastSavedLabel ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="truncate">Saved {lastSavedLabel}</span>
            </>
          ) : null
        )}
      </div>
      <div className="flex items-center gap-2 text-xs">{rightSlot}</div>
    </div>
  );
};

export interface ClassEditFooterProps {
  saving: boolean;
  unsavedCount: number;
  errorCount: number;
  saveLabel: string;
  canSave: boolean;
  onSave: () => void;
  onClose: () => void;
  onDiscard?: () => void;
  /** Show context-aware kbd hints (e.g. include sidekick shortcut when on). */
  showSidekickShortcut?: boolean;
  /** Slot rendered on the left, between the kbd hints and the buttons. */
  leftSlot?: React.ReactNode;
}

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
    {children}
  </span>
);

export const ClassEditFooter: React.FC<ClassEditFooterProps> = ({
  saving,
  unsavedCount,
  errorCount,
  saveLabel,
  canSave,
  onSave,
  onClose,
  onDiscard,
  showSidekickShortcut,
  leftSlot,
}) => {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-3 flex items-center justify-between gap-3 shrink-0">
      <div className="flex items-center gap-3 text-xs text-slate-500 min-w-0">
        <Kbd>⌘ S</Kbd> Save
        <span className="text-slate-300 dark:text-slate-600">·</span>
        <Kbd>⌘ ⏎</Kbd> Validate
        {showSidekickShortcut && (
          <>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <Kbd>⌘ K</Kbd> Sidekick
          </>
        )}
        <span className="text-slate-300 dark:text-slate-600">·</span>
        <Kbd>Esc</Kbd> Close
        {leftSlot}
      </div>
      <div className="flex items-center gap-2">
        {onDiscard && unsavedCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDiscard}
            className="gap-1.5"
          >
            <Undo className="h-3.5 w-3.5" />
            Discard
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        {errorCount > 0 && (
          <span className="text-xs text-rose-600 dark:text-rose-400 font-medium inline-flex items-center gap-1">
            <AlertOctagon className="h-3 w-3" />
            Fix {errorCount} {errorCount === 1 ? 'error' : 'errors'} to save
          </span>
        )}
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={!canSave || saving}
          className="gap-1.5"
        >
          <Save className="h-3.5 w-3.5" />
          {saving
            ? 'Saving…'
            : unsavedCount > 0
              ? `${saveLabel} · ${unsavedCount} change${unsavedCount === 1 ? '' : 's'}`
              : saveLabel}
        </Button>
      </div>
    </footer>
  );
};
