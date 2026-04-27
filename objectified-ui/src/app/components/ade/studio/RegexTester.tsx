'use client';

import React, { useMemo, useState } from 'react';
import { CheckCircle, XCircle, ChevronDown, ChevronUp, AlertTriangle, FlaskConical } from 'lucide-react';

interface RegexTesterProps {
  pattern: string;
}

type Flag = 'i' | 'm' | 's' | 'u';

const FLAG_LABELS: Record<Flag, string> = {
  i: 'case-insensitive',
  m: 'multi-line',
  s: 'dotall',
  u: 'unicode',
};

interface CompiledResult {
  regex?: RegExp;
  error?: string;
}

const compile = (pattern: string, flags: string): CompiledResult => {
  if (!pattern.trim()) return {};
  try {
    return { regex: new RegExp(pattern, flags) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Invalid regex' };
  }
};

interface MatchSpan {
  start: number;
  end: number;
  text: string;
}

const collectMatches = (regex: RegExp, input: string): MatchSpan[] => {
  if (!input) return [];
  const sticky = regex.global || regex.sticky;
  const re = sticky ? regex : new RegExp(regex.source, regex.flags + 'g');
  const out: MatchSpan[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    if (m[0].length === 0) re.lastIndex += 1;
    if (out.length > 50) break;
  }
  return out;
};

const renderHighlight = (input: string, matches: MatchSpan[]): React.ReactNode => {
  if (matches.length === 0) {
    return <span className="text-slate-600 dark:text-slate-300">{input}</span>;
  }
  const out: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.start > cursor) {
      out.push(
        <span key={`pre-${i}`} className="text-slate-600 dark:text-slate-300">
          {input.slice(cursor, m.start)}
        </span>,
      );
    }
    out.push(
      <span
        key={`hl-${i}`}
        className="bg-emerald-200/70 text-emerald-900 dark:bg-emerald-500/30 dark:text-emerald-100 rounded px-0.5"
      >
        {input.slice(m.start, m.end) || '∅'}
      </span>,
    );
    cursor = m.end;
  });
  if (cursor < input.length) {
    out.push(
      <span key="tail" className="text-slate-600 dark:text-slate-300">
        {input.slice(cursor)}
      </span>,
    );
  }
  return <>{out}</>;
};

export const RegexTester: React.FC<RegexTesterProps> = ({ pattern }) => {
  const [testString, setTestString] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [flags, setFlags] = useState<Set<Flag>>(new Set());

  const compiled = useMemo(
    () => compile(pattern, Array.from(flags).join('')),
    [pattern, flags],
  );

  const matches = useMemo(() => {
    if (!compiled.regex || !testString) return [];
    try {
      return collectMatches(compiled.regex, testString);
    } catch {
      return [];
    }
  }, [compiled.regex, testString]);

  const fullMatch = useMemo(() => {
    if (!compiled.regex) return false;
    if (!testString) return false;
    try {
      const anchored = new RegExp(`^(?:${compiled.regex.source})$`, compiled.regex.flags);
      return anchored.test(testString);
    } catch {
      return false;
    }
  }, [compiled.regex, testString]);

  if (!pattern.trim()) return null;

  const toggleFlag = (f: Flag) => {
    setFlags((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };

  const hasError = !!compiled.error;
  const hasResult = testString.length > 0 && !hasError;
  const matchCount = matches.length;

  return (
    <div className="mb-4 mt-2">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <FlaskConical className="w-3.5 h-3.5 text-violet-500" />
          Test Regex
        </button>

        {hasError ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
            <AlertTriangle className="w-3.5 h-3.5" />
            Invalid pattern
          </span>
        ) : hasResult ? (
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
              fullMatch
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : matchCount > 0
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
            }`}
          >
            {fullMatch ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : matchCount > 0 ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : (
              <XCircle className="w-3.5 h-3.5" />
            )}
            {fullMatch
              ? 'Full match'
              : matchCount > 0
                ? `${matchCount} partial ${matchCount === 1 ? 'match' : 'matches'}`
                : 'No match'}
          </span>
        ) : null}

        {expanded && (
          <div className="ml-auto inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/60">
            {(['i', 'm', 's', 'u'] as Flag[]).map((f) => {
              const active = flags.has(f);
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFlag(f)}
                  title={FLAG_LABELS[f]}
                  className={`px-1.5 py-0.5 text-[11px] font-mono rounded transition-colors ${
                    active
                      ? 'bg-violet-500 text-white'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {f}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {expanded && (
        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center flex-wrap gap-1.5">
            Pattern:
            <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono">
              /{pattern}/{Array.from(flags).join('')}
            </code>
          </div>

          {compiled.error && (
            <div className="py-2 px-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-200 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-mono text-[12px]">{compiled.error}</span>
            </div>
          )}

          <input
            type="text"
            aria-label="Test String"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-mono"
            placeholder="Enter text to test against the pattern"
            value={testString}
            onChange={(e) => setTestString(e.target.value)}
          />

          {testString && !compiled.error && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-[13px] font-mono whitespace-pre-wrap break-all">
              {renderHighlight(testString, matches)}
            </div>
          )}

          {testString && !compiled.error && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
              {fullMatch ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="w-3 h-3" /> Anchored match (entire input).
                </span>
              ) : matchCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <CheckCircle className="w-3 h-3" />
                  {matchCount} partial {matchCount === 1 ? 'match' : 'matches'} found — JSON Schema
                  requires the entire string to match.
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> No matches.
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
