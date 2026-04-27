'use client';

import React from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../../../../../lib/utils';
import { PropertyLintDiagnostic } from './propertyLint';

interface SectionLintBannerProps {
  section: string;
  diagnostics: PropertyLintDiagnostic[];
  /** Optional click handler — called when a diagnostic is clicked. */
  onSelect?: (diagnostic: PropertyLintDiagnostic) => void;
  className?: string;
}

const ICONS = {
  error: <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-px" />,
  warning: <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-px" />,
  info: <Info className="h-3.5 w-3.5 text-sky-500 shrink-0 mt-px" />,
};

/**
 * Compact list of lint diagnostics for a single form section. Renders nothing
 * when the section has no diagnostics, so it can be inlined unconditionally.
 */
export const SectionLintBanner: React.FC<SectionLintBannerProps> = ({
  section,
  diagnostics,
  onSelect,
  className,
}) => {
  const items = diagnostics.filter((d) => d.section === section);
  if (items.length === 0) return null;

  const errorCount = items.filter((d) => d.level === 'error').length;
  const tone =
    errorCount > 0
      ? 'border-rose-200 bg-rose-50/60 dark:border-rose-900/50 dark:bg-rose-950/30'
      : 'border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/30';

  return (
    <div className={cn('rounded-lg border px-3 py-2 space-y-1', tone, className)}>
      {items.map((d, idx) => (
        <button
          key={`${d.code}-${idx}`}
          type="button"
          onClick={() => onSelect?.(d)}
          className={cn(
            'w-full text-left flex items-start gap-2 text-[12px] leading-5',
            onSelect ? 'hover:opacity-80 transition-opacity' : 'cursor-default',
          )}
        >
          {ICONS[d.level]}
          <span className="flex-1 text-slate-700 dark:text-slate-200">
            {d.message}
            {d.field && (
              <span className="ml-1.5 font-mono text-[10px] text-slate-400 dark:text-slate-500">
                {d.field}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
};

export default SectionLintBanner;
