'use client';

import dynamic from 'next/dynamic';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  OBJECTIFIED_MONACO_THEME_DARK,
  OBJECTIFIED_MONACO_THEME_LIGHT,
  registerObjectifiedMonacoThemesFromDom,
} from '@/lib/objectified-editor/monaco-theme-from-dom';
import type { ObjectifiedEditorProps } from '@/lib/objectified-editor/types';
import { usePersistedEditorKeymap } from '@/lib/objectified-editor/use-persisted-editor-keymap';

const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-32 w-full items-center justify-center bg-slate-50 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">
      Loading editor…
    </div>
  ),
});

export function ObjectifiedEditor({
  vfsUri,
  language,
  value,
  onChange,
  readOnly,
  className,
  editorClassName,
  markers,
  markerOwner = 'objectified',
  onSave,
  keymap: keymapProp,
  showKeymapToggle,
  onEditorMount,
}: ObjectifiedEditorProps) {
  const persistKeymap = keymapProp === undefined;
  const { keymap: persistedKeymap, setKeymap, hydrated } = usePersistedEditorKeymap(persistKeymap);
  const effectiveKeymap = keymapProp ?? persistedKeymap;

  const [isDark, setIsDark] = React.useState(false);
  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const vimDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const statusBarHostRef = useRef<HTMLDivElement | null>(null);
  const onSaveRef = useRef(onSave);
  const onEditorMountRef = useRef(onEditorMount);
  const vfsUriRef = useRef(vfsUri);
  const [editorMountId, setEditorMountId] = React.useState(0);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);
  useEffect(() => {
    onEditorMountRef.current = onEditorMount;
  }, [onEditorMount]);
  useEffect(() => {
    vfsUriRef.current = vfsUri;
  }, [vfsUri]);

  useEffect(() => {
    const sync = () => setIsDark(document.documentElement.classList.contains('dark'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onOs = () => sync();
    mq.addEventListener('change', onOs);
    return () => {
      observer.disconnect();
      mq.removeEventListener('change', onOs);
    };
  }, []);

  const disposeVim = useCallback(() => {
    vimDisposableRef.current?.dispose();
    vimDisposableRef.current = null;
  }, []);

  useEffect(() => {
    const monaco = monacoRef.current;
    if (monaco) {
      registerObjectifiedMonacoThemesFromDom(monaco, isDark);
    }
  }, [isDark]);

  const beforeMount = useCallback((monaco: Monaco) => {
    monacoRef.current = monaco;
    const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    registerObjectifiedMonacoThemesFromDom(monaco, dark);
  }, []);

  const handleMount = useCallback((ed: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = ed;
    monacoRef.current = monaco;
    registerObjectifiedMonacoThemesFromDom(monaco, document.documentElement.classList.contains('dark'));

    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const model = ed.getModel();
      if (!model) return;
      void Promise.resolve(
        onSaveRef.current?.({
          vfsUri: vfsUriRef.current,
          value: model.getValue(),
          languageId: model.getLanguageId(),
        }),
      );
    });

    onEditorMountRef.current?.(ed, monaco);
    setEditorMountId((n) => n + 1);
  }, []);

  useEffect(() => {
    const ed = editorRef.current;
    const host = statusBarHostRef.current;
    if (!ed || !host || !hydrated) return;

    disposeVim();
    if (effectiveKeymap !== 'vim') return;

    let cancelled = false;
    void import('monaco-vim').then(({ initVimMode }) => {
      if (cancelled) return;
      vimDisposableRef.current = initVimMode(ed, host) as { dispose: () => void };
    });

    return () => {
      cancelled = true;
      disposeVim();
    };
  }, [effectiveKeymap, hydrated, disposeVim, editorMountId]);

  useEffect(() => {
    return () => disposeVim();
  }, [disposeVim]);

  useEffect(() => {
    const monaco = monacoRef.current;
    const ed = editorRef.current;
    const model = ed?.getModel();
    if (!monaco || !model) return;
    monaco.editor.setModelMarkers(model, markerOwner, markers ?? []);
  }, [markers, markerOwner, editorMountId]);

  const themeId = isDark ? OBJECTIFIED_MONACO_THEME_DARK : OBJECTIFIED_MONACO_THEME_LIGHT;

  return (
    <div className={className ?? 'flex h-full min-h-48 flex-col'}>
      {showKeymapToggle && persistKeymap && hydrated ? (
        <div className="flex shrink-0 items-center justify-end gap-2 border-b border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900">
          <span className="text-xs text-slate-500 dark:text-slate-400">Keys</span>
          <ToggleGroup.Root
            type="single"
            value={effectiveKeymap}
            onValueChange={(v) => {
              if (v === 'vscode' || v === 'vim') void setKeymap(v);
            }}
            className="inline-flex rounded-md border border-slate-200 p-0.5 dark:border-slate-600"
          >
            <ToggleGroup.Item
              value="vscode"
              className="rounded px-2 py-0.5 text-xs text-slate-500 data-[state=on]:bg-slate-100 data-[state=on]:text-slate-900 dark:text-slate-400 dark:data-[state=on]:bg-slate-800 dark:data-[state=on]:text-slate-100"
            >
              VS Code
            </ToggleGroup.Item>
            <ToggleGroup.Item
              value="vim"
              className="rounded px-2 py-0.5 text-xs text-slate-500 data-[state=on]:bg-slate-100 data-[state=on]:text-slate-900 dark:text-slate-400 dark:data-[state=on]:bg-slate-800 dark:data-[state=on]:text-slate-100"
            >
              Vim
            </ToggleGroup.Item>
          </ToggleGroup.Root>
        </div>
      ) : null}
      <div
        ref={statusBarHostRef}
        className={
          effectiveKeymap === 'vim'
            ? 'h-7 shrink-0 border-b border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            : 'sr-only h-0 overflow-hidden p-0'
        }
        aria-hidden={effectiveKeymap !== 'vim'}
      />
      <div className={`min-h-0 min-w-0 flex-1 ${editorClassName ?? ''}`}>
        <Editor
          height="100%"
          path={vfsUri}
          language={language}
          value={value}
          theme={themeId}
          options={{
            readOnly: readOnly ?? false,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            fontFamily: 'var(--app-font-mono)',
          }}
          beforeMount={beforeMount}
          onMount={handleMount}
          onChange={onChange ? (v) => onChange(v ?? '') : undefined}
        />
      </div>
    </div>
  );
}
