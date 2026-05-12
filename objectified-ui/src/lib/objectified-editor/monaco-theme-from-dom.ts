import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

export const OBJECTIFIED_MONACO_THEME_LIGHT = 'objectified-tailwind-light';
export const OBJECTIFIED_MONACO_THEME_DARK = 'objectified-tailwind-dark';

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw || fallback;
}

/** Build Monaco `IStandaloneThemeData` colors from app CSS variables (`globals.css`). */
export function objectifiedMonacoThemeColors(isDark: boolean): editor.IStandaloneThemeData['colors'] {
  const bg = cssVar('--background', isDark ? '#0a0a0a' : '#ffffff');
  const fg = cssVar('--foreground', isDark ? '#ededed' : '#171717');
  const surface = cssVar('--surface', isDark ? '#111827' : '#ffffff');
  const muted = cssVar('--surface-muted', isDark ? '#0f172a' : '#f8fafc');
  const border = cssVar('--border-subtle', isDark ? '#334155' : '#e2e8f0');
  const textMuted = cssVar('--text-muted', isDark ? '#cbd5e1' : '#475569');
  const focus = cssVar('--focus-ring', '#6366f1');

  return {
    'editor.background': muted,
    'editor.foreground': fg,
    'editorLineNumber.foreground': textMuted,
    'editorLineNumber.activeForeground': fg,
    'editorCursor.foreground': focus,
    'editor.selectionBackground': `${focus}44`,
    'editor.inactiveSelectionBackground': `${focus}22`,
    'editorWhitespace.foreground': textMuted,
    'editorIndentGuide.background': border,
    'editorIndentGuide.activeBackground': textMuted,
    'editorLineHighlightBackground': isDark ? '#1e293b55' : '#e2e8f033',
    'scrollbarSlider.background': `${textMuted}66`,
    'scrollbarSlider.hoverBackground': `${textMuted}99`,
    'scrollbarSlider.activeBackground': `${textMuted}cc`,
    'minimap.background': surface,
    'editorWidget.background': surface,
    'editorWidget.border': border,
    'editorError.foreground': '#ef4444',
    'editorWarning.foreground': '#f59e0b',
    'editorInfo.foreground': '#3b82f6',
    'diffEditor.insertedTextBackground': isDark ? '#16653444' : '#bbf7d055',
    'diffEditor.removedTextBackground': isDark ? '#991b1b44' : '#fecaca55',
    'editorGutter.background': bg,
  };
}

/** Register light/dark themes from the current DOM tokens and return the active theme id. */
export function registerObjectifiedMonacoThemesFromDom(monaco: Monaco, isDark: boolean): string {
  const baseLight: editor.BuiltinTheme = 'vs';
  const baseDark: editor.BuiltinTheme = 'vs-dark';

  monaco.editor.defineTheme(OBJECTIFIED_MONACO_THEME_LIGHT, {
    base: baseLight,
    inherit: true,
    rules: [],
    colors: objectifiedMonacoThemeColors(false),
  });
  monaco.editor.defineTheme(OBJECTIFIED_MONACO_THEME_DARK, {
    base: baseDark,
    inherit: true,
    rules: [],
    colors: objectifiedMonacoThemeColors(true),
  });

  const id = isDark ? OBJECTIFIED_MONACO_THEME_DARK : OBJECTIFIED_MONACO_THEME_LIGHT;
  monaco.editor.setTheme(id);
  return id;
}
