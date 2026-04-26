'use client';

/**
 * Right-panel spec viewer on the project Classes tab.
 *
 * Drops a Monaco editor in place of the old "Properties list" panel — when a
 * class is picked from the left list, the right panel renders that class's
 * spec in the user's chosen format. Heavy lifting (per-class slicing,
 * format generators, JSON↔YAML conversion) lives in `classSpecGenerators`
 * so this file stays UI-only.
 *
 * Behaviour notes:
 *
 *   - Generators are async (Handlebars-templated for OpenAPI / Arazzo /
 *     GraphQL), so we run them in an effect with a cancellation flag and
 *     surface a small loading row instead of flashing stale text.
 *   - Monaco is dynamic-imported with SSR off — same pattern the studio
 *     code page uses. Read-only, no minimap, syntax highlighting per format.
 *   - The serialization toggle (JSON / YAML) is hidden for formats that
 *     have a single canonical wire form (JSON Schema, GraphQL, SQL).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Check, Copy, Download, Loader2 } from 'lucide-react';
import {
  generateClassSpec,
  SPEC_FORMATS,
  type GenerateSpecResult,
  type Serialization,
  type SpecFormat,
} from './classSpecGenerators';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-gray-500">
      Loading editor…
    </div>
  ),
});

interface ClassLike {
  id: string;
  name: string;
  description?: string | null;
  schema?: unknown;
  properties?: Array<{
    id: string;
    name: string;
    description?: string | null;
    data?: unknown;
  }>;
}

export interface ClassSpecViewerProps {
  selected: ClassLike;
  allClasses: ClassLike[];
  projectName: string;
  versionId: string;
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'spec'
  );
}

function buildFilename(
  className: string,
  versionId: string,
  format: SpecFormat,
  serialization: Serialization
): string {
  const fmtMeta = SPEC_FORMATS.find((f) => f.id === format)!;
  const ext = fmtMeta.fileExtension(serialization);
  const base = `${slugify(className)}-v${versionId.replace(/\./g, '-')}-${format}`;
  return `${base}.${ext}`;
}

export function ClassSpecViewer({
  selected,
  allClasses,
  projectName,
  versionId,
}: ClassSpecViewerProps) {
  const [format, setFormat] = useState<SpecFormat>('openapi');
  const [serialization, setSerialization] = useState<Serialization>('yaml');
  const [result, setResult] = useState<GenerateSpecResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const formatMeta = useMemo(
    () => SPEC_FORMATS.find((f) => f.id === format)!,
    [format]
  );

  /* Regenerate whenever the inputs change. The cancellation flag stops a
   * slow generator (e.g. OpenAPI's Handlebars render) from clobbering a
   * fresher result if the user flips formats mid-render. */
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    (async () => {
      try {
        const out = await generateClassSpec({
          format,
          serialization,
          selected,
          allClasses,
          projectName,
          versionId,
        });
        if (cancelled) return;
        setResult(out);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to generate spec');
        setResult(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [format, serialization, selected, allClasses, projectName, versionId]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard write can fail in non-secure contexts; swallow silently */
    }
  }, [result]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const filename = buildFilename(selected.name, versionId, format, serialization);
    const mime =
      result.language === 'json'
        ? 'application/json'
        : result.language === 'yaml'
        ? 'text/yaml'
        : 'text/plain';
    const blob = new Blob([result.content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [result, selected.name, versionId, format, serialization]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Format + serialization toolbar. Lives just under the panel header
          so the viewer reads as a single connected surface. */}
      <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700/60 flex items-center gap-2 flex-wrap">
        <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
          Format
        </label>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as SpecFormat)}
          className="h-8 px-2 text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 font-medium"
        >
          {SPEC_FORMATS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>

        {formatMeta.supportsSerialization && (
          <div className="flex items-center text-xs rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            {(['yaml', 'json'] as Serialization[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSerialization(s)}
                className={`px-2.5 py-1 uppercase tracking-wide ${
                  serialization === s
                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!result || isLoading}
            title="Copy to clipboard"
            className="h-8 px-2.5 text-xs inline-flex items-center gap-1.5 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Copy
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!result || isLoading}
            title="Download as file"
            className="h-8 px-2.5 text-xs inline-flex items-center gap-1.5 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" /> Download
          </button>
        </div>
      </div>

      {/* Editor surface. Errors and the loading row collapse onto the same
          slot so the panel doesn't jump around between states. */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-xs text-gray-500 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Generating {formatMeta.label}…
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-xs text-rose-600 dark:text-rose-400 px-6 text-center">
            {error}
          </div>
        ) : result ? (
          <MonacoEditor
            height="100%"
            language={result.language}
            value={result.content}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 12,
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              renderWhitespace: 'none',
              folding: true,
              lineNumbers: 'on',
              automaticLayout: true,
              padding: { top: 12, bottom: 12 },
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
