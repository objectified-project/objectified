'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTheme, specThemes, SpecTheme } from './ThemeProvider';

interface SpecViewerProps {
  tenantSlug: string;
  projectSlug: string;
  versionSlug: string;
  restApiBaseUrl: string;
}

type SpecFormat = 'openapi' | 'arazzo' | 'jsonschema';

// Syntax highlighting component
function SyntaxHighlighter({ json, theme }: { json: string; theme: SpecTheme }) {
  const themeColors = specThemes[theme];

  const highlighted = useMemo(() => {
    const lines = json.split('\n');
    return lines.map((line, lineIndex) => {
      const parts: { text: string; className: string }[] = [];
      let remaining = line;
      let lastIndex = 0;

      // Match patterns for JSON syntax
      const patterns = [
        { regex: /("(?:\\.|[^"\\])*")\s*:/g, className: themeColors.property }, // property names
        { regex: /:\s*("(?:\\.|[^"\\])*")/g, className: themeColors.string }, // string values
        { regex: /:\s*(-?\d+\.?\d*)/g, className: themeColors.number }, // numbers
        { regex: /:\s*(true|false|null)/g, className: themeColors.keyword }, // keywords
        { regex: /([{}\[\]])/g, className: themeColors.bracket }, // brackets
      ];

      // Simple approach: just colorize the whole line based on content
      let colorClass = themeColors.text;
      if (line.includes('":')) {
        colorClass = themeColors.text;
      }

      return (
        <div key={lineIndex} className={`${colorClass} whitespace-pre`}>
          {line || '\u00A0'}
        </div>
      );
    });
  }, [json, theme, themeColors]);

  return <>{highlighted}</>;
}

export function SpecViewer({ tenantSlug, projectSlug, versionSlug, restApiBaseUrl }: SpecViewerProps) {
  const { specTheme, setSpecTheme } = useTheme();
  const [format, setFormat] = useState<SpecFormat>('openapi');
  const [spec, setSpec] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [lineNumbers, setLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState(false);

  useEffect(() => {
    loadSpec();
  }, [format]);

  const loadSpec = async () => {
    setLoading(true);
    setError(null);

    try {
      let url = '';
      switch (format) {
        case 'openapi':
          url = `${restApiBaseUrl}/schema/${tenantSlug}/${projectSlug}/${versionSlug}`;
          break;
        case 'arazzo':
          url = `${restApiBaseUrl}/arazzo/${tenantSlug}/${projectSlug}/${versionSlug}`;
          break;
        case 'jsonschema':
          url = `${restApiBaseUrl}/json/${tenantSlug}/${projectSlug}/${versionSlug}`;
          break;
      }

      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load specification (${response.status}): ${response.statusText}${errorText ? `. ${errorText.substring(0, 100)}` : ''}`);
      }

      const data = await response.json();
      setSpec(data);
    } catch (err: any) {
      if (err.message.includes('Failed to fetch')) {
        setError(`Cannot connect to API. Please ensure the REST API is running at ${restApiBaseUrl} and CORS is configured.`);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadSpec = () => {
    if (!spec) return;
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectSlug}-${versionSlug}-${format}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
    if (!spec) return;
    await navigator.clipboard.writeText(JSON.stringify(spec, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const specJson = spec ? JSON.stringify(spec, null, 2) : '';
  const lineCount = specJson.split('\n').length;
  const themeColors = specThemes[specTheme];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
        {/* Format Tabs */}
        <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
          {(['openapi', 'arazzo', 'jsonschema'] as SpecFormat[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                format === f
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
              }`}
            >
              {f === 'openapi' ? 'OpenAPI' : f === 'arazzo' ? 'Arazzo' : 'JSON Schema'}
            </button>
          ))}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* View Options */}
          <div className="flex items-center gap-1 border-r border-zinc-200 pr-2 dark:border-zinc-700">
            <button
              onClick={() => setLineNumbers(!lineNumbers)}
              className={`rounded-md p-2 text-sm transition-colors ${
                lineNumbers
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
              title="Toggle line numbers"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setWordWrap(!wordWrap)}
              className={`rounded-md p-2 text-sm transition-colors ${
                wordWrap
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
              title="Toggle word wrap"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h11m-11 6h7" />
              </svg>
            </button>
          </div>

          {/* Theme Picker */}
          <div className="relative">
            <button
              onClick={() => setShowThemePicker(!showThemePicker)}
              className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <div className={`h-4 w-4 rounded ${themeColors.bg}`}></div>
              <span>{specThemes[specTheme].name}</span>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showThemePicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowThemePicker(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  <div className="text-xs font-medium text-zinc-500 px-2 py-1 uppercase tracking-wider mb-1">
                    Code Theme
                  </div>
                  {(Object.entries(specThemes) as [SpecTheme, typeof specThemes.default][]).map(([key, value]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSpecTheme(key);
                        setShowThemePicker(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-sm ${
                        specTheme === key
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className={`h-4 w-4 rounded ${value.bg} border border-zinc-200 dark:border-zinc-700`}></div>
                      {value.name}
                      {specTheme === key && (
                        <svg className="ml-auto h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Copy Button */}
          <button
            onClick={copyToClipboard}
            disabled={!spec}
            className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            {copied ? (
              <>
                <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </>
            )}
          </button>

          {/* Download Button */}
          <button
            onClick={downloadSpec}
            disabled={!spec}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </button>
        </div>
      </div>

      {/* Content Area */}
      {loading && (
        <div className="flex items-center justify-center rounded-lg border border-zinc-200 bg-white p-16 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-zinc-600 dark:text-zinc-400">Loading specification...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/20">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-300 mb-1">Error Loading Specification</h3>
              <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && spec && (
        <div
          className="rounded-lg border border-zinc-200 overflow-hidden dark:border-zinc-800"
          style={{ backgroundColor: themeColors.bgColor }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {format === 'openapi' ? 'openapi.json' : format === 'arazzo' ? 'arazzo.json' : 'schema.json'}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {lineCount} lines
              </span>
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {format === 'openapi' && spec.info?.version && `v${spec.info.version}`}
              {format === 'openapi' && spec.openapi && ` • OpenAPI ${spec.openapi}`}
            </div>
          </div>

          {/* Code Area */}
          <div className="overflow-auto max-h-[700px]">
            <div className="flex min-w-max">
              {/* Line Numbers */}
              {lineNumbers && (
                <div className="sticky left-0 select-none bg-zinc-100/80 dark:bg-zinc-900/80 backdrop-blur-sm border-r border-zinc-200 dark:border-zinc-800 text-right pr-3 pl-3 py-4 font-mono text-xs text-zinc-400 dark:text-zinc-600">
                  {specJson.split('\n').map((_, i) => (
                    <div key={i} className="leading-6">{i + 1}</div>
                  ))}
                </div>
              )}

              {/* Code */}
              <pre
                className={`flex-1 p-4 font-mono text-sm leading-6 ${wordWrap ? 'whitespace-pre-wrap' : 'whitespace-pre'}`}
                style={{ color: themeColors.textColor }}
              >
                <code>{specJson}</code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

