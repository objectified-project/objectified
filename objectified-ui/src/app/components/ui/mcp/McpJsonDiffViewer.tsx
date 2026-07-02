'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { cn } from '../../../../../lib/utils';

const MonacoDiffEditor = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.DiffEditor),
  { ssr: false },
);

/** Monaco line height at the viewer's 12px font size. */
const LINE_HEIGHT_PX = 19;
/** Vertical padding Monaco adds inside the viewport (matches the `padding` option below). */
const EDITOR_PADDING_PX = 16;

/** How the two sides are laid out: `split` (side-by-side) or `unified` (inline). */
export type McpDiffMode = 'split' | 'unified';

export interface McpJsonDiffViewerProps {
  /** Pretty-printed JSON for the base (left / "before") side. */
  original: string;
  /** Pretty-printed JSON for the target (right / "after") side. */
  modified: string;
  mode?: McpDiffMode;
  /** Never auto-size below this many visible lines, so short diffs keep a workable viewport. */
  minLines?: number;
  /** Clamp the auto-sized editor to this many visible lines (content beyond it scrolls). */
  maxLines?: number;
  className?: string;
}

/**
 * `<McpJsonDiffViewer>` — a read-only JSON diff backed by monaco's DiffEditor, used by the MCP
 * version-history diff rows. Renders side-by-side (`split`) or inline (`unified`) per `mode`,
 * auto-sizes to the content (clamped to `maxLines`), collapses long unchanged regions, and follows
 * the app's light/dark theme.
 */
export function McpJsonDiffViewer({
  original,
  modified,
  mode = 'split',
  minLines = 8,
  maxLines = 30,
  className,
}: McpJsonDiffViewerProps) {
  const [isDark, setIsDark] = React.useState(false);

  // Follow the app theme switch (the `.dark` class on <html>) so Monaco re-themes live.
  React.useEffect(() => {
    const sync = () => setIsDark(document.documentElement.classList.contains('dark'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const lineCount = Math.max(
    original ? original.split('\n').length : 1,
    modified ? modified.split('\n').length : 1,
  );
  const height =
    Math.min(Math.max(lineCount, minLines), maxLines) * LINE_HEIGHT_PX + EDITOR_PADDING_PX;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#1e1e1e]',
        className,
      )}
    >
      <MonacoDiffEditor
        height={height}
        language="json"
        theme={isDark ? 'vs-dark' : 'light'}
        original={original}
        modified={modified}
        options={{
          readOnly: true,
          domReadOnly: true,
          renderSideBySide: mode === 'split',
          minimap: { enabled: false },
          lineNumbers: 'on',
          lineNumbersMinChars: 3,
          folding: false,
          fontSize: 12,
          lineHeight: LINE_HEIGHT_PX,
          padding: { top: 8, bottom: 8 },
          scrollBeyondLastLine: false,
          diffWordWrap: 'on',
          wordWrap: 'on',
          renderLineHighlight: 'none',
          renderOverviewRuler: false,
          hideCursorInOverviewRuler: true,
          enableSplitViewResizing: false,
          hideUnchangedRegions: { enabled: true },
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
            alwaysConsumeMouseWheel: false,
          },
          contextmenu: false,
          links: false,
          automaticLayout: true,
        }}
      />
    </div>
  );
}
