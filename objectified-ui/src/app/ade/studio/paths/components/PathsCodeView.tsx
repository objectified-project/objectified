'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import YAML from 'yaml';
import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useStudio } from '../../StudioContext';
import { loadPathsCodeSpec } from '../lib/load-paths-code-spec';
import { markersForParsedText } from '../lib/paths-code-markers';
import { sortProjectsForSelector } from '@/app/utils/project-selector-sort';
import { useDeveloperMode } from '@/app/providers/DeveloperModeProvider';
import {
  countDiagnosticsFromMarkers,
  DeveloperModeVirtualFileTree,
  DeveloperModeWorkspaceChrome,
  sumDiagnosticSummaries,
  type DeveloperModeWorkspaceTab,
  type VirtualTreeNode,
} from '@/components/developer-mode';
import { AlertTriangle } from 'lucide-react';

const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <p className="text-sm text-gray-500 dark:text-gray-400">Loading editor…</p>
    </div>
  ),
});

type CodeFormat = 'json' | 'yaml';

interface ProjectRow {
  id: string;
  name: string;
  slug: string;
}

interface VersionRow {
  id: string;
  version_id: string;
  description: string;
}

const TAB_PATHS = 'paths-fragment';
const TAB_MERGED = 'merged-openapi';

export interface PathsCodeViewProps {
  /** Bumps when the Paths canvas or sidebar refreshes operations / layout saves. */
  refreshKey: number;
}

export default function PathsCodeView({ refreshKey }: PathsCodeViewProps) {
  const { selectedProjectId, selectedVersionId } = useStudio();
  const developerModeCtx = useDeveloperMode();
  const developerWorkspaceChrome = Boolean(developerModeCtx?.developerModeEnabled);

  const [codeFormat, setCodeFormat] = useState<CodeFormat>('yaml');
  const [isDark, setIsDark] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pathsObject, setPathsObject] = useState<Record<string, unknown>>({});
  const [mergedSpecJson, setMergedSpecJson] = useState<string>('{}');
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [versions, setVersions] = useState<VersionRow[]>([]);

  const pathsEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const mergedEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const pathsParseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mergedParseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [openTabIds, setOpenTabIds] = useState<string[]>([TAB_PATHS, TAB_MERGED]);
  const [activeTabId, setActiveTabId] = useState<string>(TAB_PATHS);

  useEffect(() => {
    setOpenTabIds([TAB_PATHS, TAB_MERGED]);
    setActiveTabId(TAB_PATHS);
  }, [selectedProjectId, selectedVersionId]);

  useEffect(() => {
    const sync = () => setIsDark(document.documentElement.classList.contains('dark'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/projects');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.success && data.projects) {
          setProjects(sortProjectsForSelector(data.projects));
        }
      } catch {
        if (!cancelled) setProjects([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/versions?projectId=${selectedProjectId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.success && data.versions) {
          setVersions(data.versions);
        }
      } catch {
        if (!cancelled) setVersions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedVersionId || !selectedProjectId) {
      setPathsObject({});
      setMergedSpecJson('{}');
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const project = projects.find((p) => p.id === selectedProjectId);
        const version = versions.find((v) => v.id === selectedVersionId);
        const { pathsObject: po, mergedSpecJson: merged } = await loadPathsCodeSpec({
          versionId: selectedVersionId,
          projectName: project?.name || 'API',
          versionLabel: version?.version_id || '1.0.0',
          versionDescription: version?.description || '',
        });
        if (!cancelled) {
          setPathsObject(po);
          setMergedSpecJson(merged);
        }
      } catch (err) {
        console.error('[PathsCodeView] load failed:', err);
        if (!cancelled) {
          setPathsObject({});
          setMergedSpecJson('{}');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedVersionId, selectedProjectId, refreshKey, projects, versions]);

  const pathsDisplay = useMemo(() => {
    try {
      return codeFormat === 'json'
        ? JSON.stringify(pathsObject, null, 2)
        : YAML.stringify(pathsObject);
    } catch {
      return '';
    }
  }, [pathsObject, codeFormat]);

  const mergedDisplay = useMemo(() => {
    try {
      const mergedObj = JSON.parse(mergedSpecJson) as Record<string, unknown>;
      return codeFormat === 'json'
        ? JSON.stringify(mergedObj, null, 2)
        : YAML.stringify(mergedObj);
    } catch {
      return mergedSpecJson;
    }
  }, [mergedSpecJson, codeFormat]);

  const pathsMarkers = useMemo(
    () => markersForParsedText(pathsDisplay, codeFormat),
    [pathsDisplay, codeFormat],
  );
  const mergedMarkers = useMemo(
    () => markersForParsedText(mergedDisplay, codeFormat),
    [mergedDisplay, codeFormat],
  );

  // Refs so the debounced timers always apply the latest computed markers
  // without re-running the effects on every render.
  const pathsMarkersRef = useRef(pathsMarkers);
  pathsMarkersRef.current = pathsMarkers;
  const mergedMarkersRef = useRef(mergedMarkers);
  mergedMarkersRef.current = mergedMarkers;

  useEffect(() => {
    if (pathsParseTimerRef.current) clearTimeout(pathsParseTimerRef.current);
    pathsParseTimerRef.current = setTimeout(() => {
      const editorInst = pathsEditorRef.current;
      const model = editorInst?.getModel();
      if (!model || !monacoRef.current) return;
      monacoRef.current.editor.setModelMarkers(model, 'paths-code-parse', pathsMarkersRef.current);
    }, 320);
    return () => {
      if (pathsParseTimerRef.current) clearTimeout(pathsParseTimerRef.current);
    };
  }, [pathsDisplay, codeFormat]);

  useEffect(() => {
    if (mergedParseTimerRef.current) clearTimeout(mergedParseTimerRef.current);
    mergedParseTimerRef.current = setTimeout(() => {
      const editorInst = mergedEditorRef.current;
      const model = editorInst?.getModel();
      if (!model || !monacoRef.current) return;
      monacoRef.current.editor.setModelMarkers(model, 'paths-code-parse', mergedMarkersRef.current);
    }, 320);
    return () => {
      if (mergedParseTimerRef.current) clearTimeout(mergedParseTimerRef.current);
    };
  }, [mergedDisplay, codeFormat]);

  const diagnosticSummary = useMemo(
    () =>
      sumDiagnosticSummaries(
        countDiagnosticsFromMarkers(pathsMarkers),
        countDiagnosticsFromMarkers(mergedMarkers),
      ),
    [pathsMarkers, mergedMarkers],
  );

  const ext = codeFormat === 'json' ? 'json' : 'yaml';

  const workspaceTabs = useMemo<DeveloperModeWorkspaceTab[]>(
    () => [
      {
        id: TAB_PATHS,
        label: `paths-fragment.${ext}`,
        dirty: pathsMarkers.length > 0,
        closable: true,
      },
      {
        id: TAB_MERGED,
        label: `merged-openapi.${ext}`,
        dirty: mergedMarkers.length > 0,
        closable: true,
      },
    ],
    [ext, pathsMarkers.length, mergedMarkers.length],
  );

  const treeRoots = useMemo<VirtualTreeNode[]>(
    () => [
      {
        kind: 'folder',
        id: 'openapi',
        name: 'openapi',
        defaultOpen: true,
        children: [
          { kind: 'file', id: TAB_PATHS, name: `paths-fragment.${ext}` },
          { kind: 'file', id: TAB_MERGED, name: `merged-openapi.${ext}` },
        ],
      },
    ],
    [ext],
  );

  const handleTreeSelect = useCallback((fileId: string) => {
    setOpenTabIds((prev) => (prev.includes(fileId) ? prev : [...prev, fileId]));
    setActiveTabId(fileId);
  }, []);

  const handleTabClose = useCallback((id: string) => {
    setOpenTabIds((prev) => {
      const next = prev.filter((x) => x !== id);
      const final = next.length > 0 ? next : [TAB_PATHS];
      setActiveTabId((cur) => {
        if (cur !== id) return cur;
        return final[0] ?? TAB_PATHS;
      });
      return final;
    });
  }, []);

  useEffect(() => {
    if (!openTabIds.includes(activeTabId)) {
      setActiveTabId(openTabIds[0] ?? TAB_PATHS);
    }
  }, [openTabIds, activeTabId]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const selectedVersion = versions.find((v) => v.id === selectedVersionId);

  const onPathsMount = useCallback((ed: editor.IStandaloneCodeEditor, monacoInstance: Monaco) => {
    pathsEditorRef.current = ed;
    monacoRef.current = monacoInstance;
  }, []);

  const onMergedMount = useCallback((ed: editor.IStandaloneCodeEditor, monacoInstance: Monaco) => {
    mergedEditorRef.current = ed;
    monacoRef.current = monacoInstance;
  }, []);

  const toolbar = (
    <div className="shrink-0 border-b border-gray-200 bg-white/90 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/90">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Paths code</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {selectedProject?.name ?? 'Project'} · {selectedVersion?.version_id ?? 'version'}
          </p>
        </div>
        <ToggleGroup.Root
          type="single"
          value={codeFormat}
          onValueChange={(v) => {
            if (v === 'json' || v === 'yaml') setCodeFormat(v);
          }}
          className="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-gray-700/50"
        >
          <ToggleGroup.Item
            value="yaml"
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-gray-600 transition-all data-[state=on]:bg-white data-[state=on]:text-indigo-600 data-[state=on]:shadow-sm dark:text-gray-400 dark:data-[state=on]:bg-gray-600 dark:data-[state=on]:text-indigo-400"
          >
            YAML
          </ToggleGroup.Item>
          <ToggleGroup.Item
            value="json"
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-gray-600 transition-all data-[state=on]:bg-white data-[state=on]:text-indigo-600 data-[state=on]:shadow-sm dark:text-gray-400 dark:data-[state=on]:bg-gray-600 dark:data-[state=on]:text-indigo-400"
          >
            JSON
          </ToggleGroup.Item>
        </ToggleGroup.Root>
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          <span className="font-medium">Read-only (MVP).</span> Paths are generated from the canvas and database.
          Editing code here does not update the canvas. Switch to Canvas to design; merged preview updates when the
          version or paths refresh.
        </p>
      </div>
    </div>
  );

  const branchLabel =
    selectedVersion?.version_id != null ? `v${selectedVersion.version_id}` : '—';

  const activeLabel =
    activeTabId === TAB_MERGED ? `merged-openapi.${ext}` : activeTabId === TAB_PATHS ? `paths-fragment.${ext}` : '—';

  const breadcrumbs = ['Studio', 'Paths', 'Code', activeLabel];

  const editorPane =
    loading ? (
      <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        Loading…
      </div>
    ) : activeTabId === TAB_PATHS ? (
      <Editor
        path="obj/openapi/paths-fragment"
        height="100%"
        language={codeFormat === 'json' ? 'json' : 'yaml'}
        value={pathsDisplay}
        theme={isDark ? 'vs-dark' : 'light'}
        onMount={onPathsMount}
        options={{
          readOnly: true,
          minimap: { enabled: true },
          fontSize: 13,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          padding: { top: 12, bottom: 12 },
        }}
      />
    ) : activeTabId === TAB_MERGED ? (
      <Editor
        path="obj/openapi/merged-openapi"
        height="100%"
        language={codeFormat === 'json' ? 'json' : 'yaml'}
        value={mergedDisplay}
        theme={isDark ? 'vs-dark' : 'light'}
        onMount={onMergedMount}
        options={{
          readOnly: true,
          minimap: { enabled: true },
          fontSize: 13,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          padding: { top: 12, bottom: 12 },
        }}
      />
    ) : (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
        <p>Select a file in the tree or open a tab.</p>
      </div>
    );

  if (developerWorkspaceChrome) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-gray-50 dark:bg-gray-900">
        {toolbar}
        <DeveloperModeWorkspaceChrome
          tabs={workspaceTabs}
          openTabIds={openTabIds}
          activeTabId={activeTabId}
          onTabSelect={setActiveTabId}
          onTabClose={handleTabClose}
          onTabsReorder={setOpenTabIds}
          breadcrumbs={breadcrumbs}
          branchLabel={branchLabel}
          diagnostics={diagnosticSummary}
          fileTree={
            <DeveloperModeVirtualFileTree
              key={ext}
              roots={treeRoots}
              selectedFileId={activeTabId}
              onSelectFile={handleTreeSelect}
            />
          }
        >
          {editorPane}
        </DeveloperModeWorkspaceChrome>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gray-50 dark:bg-gray-900">
      {toolbar}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-h-[240px] flex-1 flex-col border-b border-gray-200 md:min-h-0 md:border-r md:border-b-0 dark:border-gray-700">
          <div className="shrink-0 bg-gray-100/80 px-3 py-2 text-xs font-medium text-gray-600 dark:bg-gray-800/80 dark:text-gray-300">
            OpenAPI paths (fragment)
          </div>
          <div className="min-h-0 flex-1">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                Loading…
              </div>
            ) : (
              <Editor
                path="paths-fragment"
                height="100%"
                language={codeFormat === 'json' ? 'json' : 'yaml'}
                value={pathsDisplay}
                theme={isDark ? 'vs-dark' : 'light'}
                onMount={onPathsMount}
                options={{
                  readOnly: true,
                  minimap: { enabled: true },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  automaticLayout: true,
                  padding: { top: 12, bottom: 12 },
                }}
              />
            )}
          </div>
        </div>
        <div className="flex min-h-[240px] flex-1 flex-col md:min-h-0">
          <div className="shrink-0 bg-gray-100/80 px-3 py-2 text-xs font-medium text-gray-600 dark:bg-gray-800/80 dark:text-gray-300">
            Merged OpenAPI (paths + components/schemas)
          </div>
          <div className="min-h-0 flex-1">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                Loading…
              </div>
            ) : (
              <Editor
                path="merged-preview"
                height="100%"
                language={codeFormat === 'json' ? 'json' : 'yaml'}
                value={mergedDisplay}
                theme={isDark ? 'vs-dark' : 'light'}
                onMount={onMergedMount}
                options={{
                  readOnly: true,
                  minimap: { enabled: true },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  automaticLayout: true,
                  padding: { top: 12, bottom: 12 },
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
