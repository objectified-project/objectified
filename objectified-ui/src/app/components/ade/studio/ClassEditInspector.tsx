'use client';

import * as React from 'react';
import {
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Braces,
  Copy,
  Check,
  Link2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { cn } from '../../../../../lib/utils';

/**
 * Right-pane inspector for ClassEditDialog.
 *
 * Three stacked cards: Validation, Live preview, References / impact.
 * The inspector is render-only — it consumes already-derived data from
 * the parent (lint issues, preview JSON string, reference counts).
 */

export type LintSeverity = 'error' | 'warn' | 'info';

export interface LintIssue {
  id: string;
  severity: LintSeverity;
  message: string;
  detail?: string;
  /** Section id to scroll to / highlight. */
  sectionId?: string;
  /** Optional quick-fix CTA text + handler. */
  quickFix?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
}

export interface ClassReference {
  /** "paths", "classes", "responses", etc. */
  kind: string;
  count: number;
  icon?: React.ReactNode;
}

export interface ClassEditInspectorProps {
  issues: LintIssue[];
  /** Pretty-printed JSON of the live schema (what would be saved). */
  previewJson: string;
  /** "JSON" / "YAML" / etc. */
  previewLanguage?: string;
  /** When the preview is awaiting recompute. */
  previewLoading?: boolean;
  references?: ClassReference[];
  /** Handler when a lint quick-fix wants to focus a section. */
  onJumpToSection?: (sectionId: string) => void;
  /** Optional: open the AI sidekick (used by the "Examples missing" fix). */
  onOpenSidekick?: () => void;
  className?: string;
}

const sevTone = {
  error: {
    icon: AlertOctagon,
    iconClass: 'text-rose-500',
    rowClass: '',
  },
  warn: {
    icon: AlertTriangle,
    iconClass: 'text-amber-500',
    rowClass: '',
  },
  info: {
    icon: CheckCircle2,
    iconClass: 'text-emerald-500',
    rowClass: '',
  },
} as const;

const InspectorCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  toneClass?: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
  bodyClass?: string;
}> = ({ title, icon, toneClass, trailing, children, bodyClass }) => (
  <section
    className={cn(
      'rounded-lg border bg-white dark:bg-slate-800 overflow-hidden',
      toneClass ?? 'border-slate-200 dark:border-slate-700',
    )}
  >
    <header className="px-3 py-2 border-b border-slate-100 dark:border-slate-700/60 flex items-center gap-2">
      {icon}
      <span className="text-xs font-semibold">{title}</span>
      {trailing}
    </header>
    <div className={bodyClass}>{children}</div>
  </section>
);

const ValidationCard: React.FC<{
  issues: LintIssue[];
  onJumpToSection?: (id: string) => void;
  onOpenSidekick?: () => void;
}> = ({ issues, onJumpToSection, onOpenSidekick }) => {
  const errors = issues.filter((i) => i.severity === 'error');
  const warns = issues.filter((i) => i.severity === 'warn');
  const total = errors.length + warns.length;
  const summary =
    errors.length > 0
      ? { label: `${errors.length} error${errors.length === 1 ? '' : 's'}`, cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' }
      : warns.length > 0
        ? { label: `${warns.length} warning${warns.length === 1 ? '' : 's'}`, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' }
        : { label: 'passes', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' };

  const tone =
    errors.length > 0
      ? 'border-rose-200 dark:border-rose-800/50'
      : warns.length > 0
        ? 'border-amber-200/70 dark:border-amber-800/40'
        : undefined;
  const headerIcon =
    errors.length > 0 ? (
      <ShieldX className="w-3.5 h-3.5 text-rose-500" />
    ) : (
      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
    );

  return (
    <InspectorCard
      title="Validation"
      icon={headerIcon}
      toneClass={tone}
      trailing={
        <span
          className={cn(
            'ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold',
            summary.cls,
          )}
        >
          {summary.label}
        </span>
      }
    >
      {total === 0 ? (
        <div className="px-3 py-3 text-xs text-slate-500 flex items-start gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5" />
          <span>No issues so far. Run <span className="font-mono">⌘ ⏎</span> to revalidate.</span>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
          {[...errors, ...warns].map((issue) => {
            const Icon = sevTone[issue.severity].icon;
            return (
              <li key={issue.id} className="px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <Icon className={cn('w-3.5 h-3.5 mt-0.5', sevTone[issue.severity].iconClass)} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{issue.message}</span>
                    {issue.detail && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                        {issue.detail}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      {issue.sectionId && onJumpToSection && (
                        <button
                          type="button"
                          onClick={() => onJumpToSection(issue.sectionId!)}
                          className="text-[11px] text-indigo-600 hover:underline inline-flex items-center gap-0.5"
                        >
                          Jump to section
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                      {issue.quickFix && (
                        <button
                          type="button"
                          onClick={issue.quickFix.onClick}
                          className="text-[11px] text-indigo-600 hover:underline inline-flex items-center gap-1"
                        >
                          {issue.quickFix.icon}
                          {issue.quickFix.label}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
          {/* If sidekick is wired and no examples-related fix already exists, suggest it */}
          {onOpenSidekick && warns.some((w) => /example/i.test(w.message)) && (
            <li className="px-3 py-2 bg-purple-50/40 dark:bg-purple-900/10">
              <button
                type="button"
                onClick={onOpenSidekick}
                className="text-[11px] text-purple-700 dark:text-purple-300 inline-flex items-center gap-1 hover:underline"
              >
                <Sparkles className="w-3 h-3" />
                Ask AI sidekick to generate examples
              </button>
            </li>
          )}
        </ul>
      )}
    </InspectorCard>
  );
};

const LivePreviewCard: React.FC<{
  json: string;
  language?: string;
  loading?: boolean;
}> = ({ json, language = 'JSON', loading }) => {
  const [copied, setCopied] = React.useState(false);
  const onCopy = () => {
    if (!json) return;
    navigator.clipboard.writeText(json);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-900 overflow-hidden">
      <header className="px-3 py-2 border-b border-slate-700 bg-slate-800 flex items-center gap-2">
        <Braces className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-xs font-semibold text-slate-200">Live schema</span>
        <span className="ml-auto inline-flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-400">{language}</span>
          <button
            type="button"
            onClick={onCopy}
            className="text-slate-400 hover:text-slate-200 inline-flex items-center gap-1 text-[11px]"
            title="Copy schema"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" /> Copy
              </>
            )}
          </button>
        </span>
      </header>
      <pre
        className={cn(
          'p-3 text-[11px] font-mono leading-relaxed text-slate-300 overflow-auto max-h-[280px]',
          loading && 'opacity-50',
        )}
      >
        {loading ? '// Updating preview…' : json || '// (empty)'}
      </pre>
    </section>
  );
};

const ImpactCard: React.FC<{ references: ClassReference[] }> = ({ references }) => {
  const totalCount = references.reduce((sum, r) => sum + r.count, 0);
  return (
    <InspectorCard
      title="Used by"
      icon={<Link2 className="w-3.5 h-3.5 text-indigo-500" />}
      trailing={
        <span className="ml-auto text-[10px] font-mono text-slate-400">
          {totalCount === 0
            ? 'no references'
            : references
                .filter((r) => r.count > 0)
                .map((r) => `${r.count} ${r.kind}`)
                .join(' · ')}
        </span>
      }
    >
      {totalCount === 0 ? (
        <p className="px-3 py-2 text-[11px] text-slate-500 leading-relaxed">
          Nothing references this class yet. Saving it will make it available to other classes and operations.
        </p>
      ) : (
        <p className="px-3 py-2 text-[11px] text-slate-500 leading-relaxed">
          Saving will revalidate downstream consumers.
        </p>
      )}
    </InspectorCard>
  );
};

export const ClassEditInspector: React.FC<ClassEditInspectorProps> = ({
  issues,
  previewJson,
  previewLanguage,
  previewLoading,
  references = [],
  onJumpToSection,
  onOpenSidekick,
  className,
}) => {
  return (
    <aside
      className={cn(
        'border-l border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-900/30 overflow-y-auto p-4 space-y-4 shrink-0',
        className,
      )}
      aria-label="Class inspector"
    >
      <ValidationCard
        issues={issues}
        onJumpToSection={onJumpToSection}
        onOpenSidekick={onOpenSidekick}
      />
      <LivePreviewCard
        json={previewJson}
        language={previewLanguage}
        loading={previewLoading}
      />
      <ImpactCard references={references} />
    </aside>
  );
};
