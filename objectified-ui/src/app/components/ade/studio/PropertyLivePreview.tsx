'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Braces,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  Info,
  Copy,
  Check,
  FileJson2,
  TestTube2,
  ListChecks,
} from 'lucide-react';
import { cn } from '../../../../../lib/utils';
import { PropertyFormData } from './PropertyFormFields';
import { PropertyLintDiagnostic } from './propertyLint';
import { generateSampleValue } from './propertySample';

const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center text-xs text-slate-400">
      Loading editor…
    </div>
  ),
});

type RailTab = 'schema' | 'sample' | 'lint';

export interface PropertyLivePreviewProps {
  schema: Record<string, unknown>;
  formData: PropertyFormData;
  propertyType: string;
  propertyIsArray: boolean;
  diagnostics: PropertyLintDiagnostic[];
  isDark: boolean;
  /** When true, the rail is rendered as the only column (JSON-only view mode). */
  fullWidth: boolean;
  /** Click handler for clicking a diagnostic — typically scrolls to the section. */
  onSelectDiagnostic?: (diagnostic: PropertyLintDiagnostic) => void;
}

const TAB_DEFS: Array<{ id: RailTab; label: string; icon: React.ReactNode }> = [
  { id: 'schema', label: 'Schema', icon: <FileJson2 className="h-3 w-3" /> },
  { id: 'sample', label: 'Sample', icon: <TestTube2 className="h-3 w-3" /> },
  { id: 'lint', label: 'Lint', icon: <ListChecks className="h-3 w-3" /> },
];

const LEVEL_STYLES: Record<
  PropertyLintDiagnostic['level'],
  { icon: React.ReactNode; tone: string; label: string }
> = {
  error: {
    icon: <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />,
    tone: 'border-rose-200 bg-rose-50/60 dark:border-rose-900/50 dark:bg-rose-950/30',
    label: 'Error',
  },
  warning: {
    icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />,
    tone: 'border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/30',
    label: 'Warning',
  },
  info: {
    icon: <Info className="h-3.5 w-3.5 text-sky-500 shrink-0" />,
    tone: 'border-sky-200 bg-sky-50/60 dark:border-sky-900/50 dark:bg-sky-950/30',
    label: 'Info',
  },
};

export const PropertyLivePreview: React.FC<PropertyLivePreviewProps> = ({
  schema,
  formData,
  propertyType,
  propertyIsArray,
  diagnostics,
  isDark,
  fullWidth,
  onSelectDiagnostic,
}) => {
  const [tab, setTab] = useState<RailTab>('schema');
  const [copied, setCopied] = useState<RailTab | null>(null);

  const schemaJson = useMemo(() => JSON.stringify(schema, null, 2), [schema]);
  const sample = useMemo(
    () => generateSampleValue(formData, propertyType, propertyIsArray),
    [formData, propertyType, propertyIsArray],
  );
  const sampleJson = useMemo(() => JSON.stringify(sample, null, 2), [sample]);

  const errorCount = diagnostics.filter((d) => d.level === 'error').length;
  const warningCount = diagnostics.filter((d) => d.level === 'warning').length;

  const copy = async (which: RailTab) => {
    try {
      const value = which === 'schema' ? schemaJson : sampleJson;
      await navigator.clipboard.writeText(value);
      setCopied(which);
      window.setTimeout(() => setCopied((prev) => (prev === which ? null : prev)), 1400);
    } catch {
      /* ignore */
    }
  };

  return (
    <aside
      className={cn(
        'flex flex-col min-h-0 bg-white dark:bg-slate-900',
        !fullWidth && 'border-l border-slate-200 dark:border-slate-800',
      )}
    >
      {/* Header: tabs + count chips */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div
          role="tablist"
          aria-label="Live preview"
          className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/60"
        >
          {TAB_DEFS.map(({ id, label, icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                  active
                    ? 'bg-white text-violet-600 shadow-sm dark:bg-slate-900 dark:text-violet-300 font-semibold'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
                )}
              >
                {icon}
                {label}
                {id === 'lint' && diagnostics.length > 0 && (
                  <span
                    className={cn(
                      'ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold',
                      errorCount > 0
                        ? 'bg-rose-500 text-white'
                        : warningCount > 0
                          ? 'bg-amber-400 text-white'
                          : 'bg-slate-300 text-white dark:bg-slate-600',
                    )}
                  >
                    {diagnostics.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
          {tab === 'schema' ? '2020-12' : tab === 'sample' ? 'JSON' : 'rules'}
        </span>

        {(tab === 'schema' || tab === 'sample') && (
          <button
            type="button"
            onClick={() => copy(tab)}
            title="Copy"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            {copied === tab ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0">
        {tab === 'schema' && (
          <Editor
            height="100%"
            defaultLanguage="json"
            value={schemaJson}
            theme={isDark ? 'vs-dark' : 'vs-light'}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 12,
              lineNumbers: fullWidth ? 'on' : 'off',
              renderWhitespace: 'none',
              automaticLayout: true,
              wordWrap: 'on',
              folding: true,
              contextmenu: false,
              roundedSelection: false,
              cursorStyle: 'line',
              scrollbar: { vertical: 'auto', horizontal: 'auto' },
            }}
          />
        )}

        {tab === 'sample' && (
          <div className="h-full flex flex-col">
            <div className="px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/60 flex items-center gap-1.5 shrink-0">
              <Sparkles className="h-3 w-3 text-violet-500" />
              Generated from current type, format, enum/const, and range constraints.
            </div>
            <div className="flex-1 min-h-0">
              <Editor
                height="100%"
                defaultLanguage="json"
                value={sampleJson}
                theme={isDark ? 'vs-dark' : 'vs-light'}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 12,
                  lineNumbers: 'off',
                  renderWhitespace: 'none',
                  automaticLayout: true,
                  wordWrap: 'on',
                  folding: true,
                  contextmenu: false,
                }}
              />
            </div>
          </div>
        )}

        {tab === 'lint' && (
          <div className="h-full overflow-y-auto px-3 py-3 space-y-2">
            {diagnostics.length === 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/30 px-3 py-3 flex items-center gap-2 text-[12px] text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
                No issues detected. Schema is well-formed.
              </div>
            ) : (
              diagnostics.map((d, idx) => {
                const style = LEVEL_STYLES[d.level];
                return (
                  <button
                    key={`${d.code}-${idx}`}
                    type="button"
                    onClick={() => onSelectDiagnostic?.(d)}
                    className={cn(
                      'w-full text-left rounded-lg border px-3 py-2 transition-colors',
                      style.tone,
                      onSelectDiagnostic && 'hover:brightness-95 dark:hover:brightness-110',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {style.icon}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] font-semibold text-slate-500 dark:text-slate-400">
                          {style.label}
                          <span className="text-slate-300 dark:text-slate-600">·</span>
                          <span className="font-mono normal-case tracking-normal">{d.section}</span>
                          {d.field && (
                            <>
                              <span className="text-slate-300 dark:text-slate-600">·</span>
                              <span className="font-mono normal-case tracking-normal">
                                {d.field}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="mt-0.5 text-[12px] text-slate-700 dark:text-slate-200">
                          {d.message}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Footer summary (split mode only) */}
      {!fullWidth && (
        <div className="border-t border-slate-200 dark:border-slate-800 px-3 py-2 shrink-0 flex items-center gap-3 text-[11px]">
          <span
            className={cn(
              'inline-flex items-center gap-1',
              errorCount > 0 ? 'text-rose-600 dark:text-rose-400 font-medium' : 'text-slate-500 dark:text-slate-400',
            )}
          >
            <AlertCircle className="h-3 w-3" /> {errorCount}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1',
              warningCount > 0
                ? 'text-amber-600 dark:text-amber-400 font-medium'
                : 'text-slate-500 dark:text-slate-400',
            )}
          >
            <AlertTriangle className="h-3 w-3" /> {warningCount}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-slate-400 dark:text-slate-500">
            <Braces className="h-3 w-3" /> {schemaJson.split('\n').length} lines
          </span>
        </div>
      )}
    </aside>
  );
};

export default PropertyLivePreview;
