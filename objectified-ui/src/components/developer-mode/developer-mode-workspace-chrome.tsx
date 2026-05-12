'use client';

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Braces,
  Code2,
  GripVertical,
  LayoutDashboard,
  Route,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useCallback, useEffect, useId, useRef } from 'react';
import type { DiagnosticSummary } from './diagnostic-counts';

export type DeveloperModeWorkspaceTab = {
  id: string;
  label: string;
  dirty?: boolean;
  /** When false, middle-click / ⌘W do not remove the tab. */
  closable?: boolean;
};

export type DeveloperModeWorkspaceChromeProps = {
  tabs: DeveloperModeWorkspaceTab[];
  /** Subset of tab ids that are currently open (preserves close + reopen from tree). */
  openTabIds: string[];
  activeTabId: string | null;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabsReorder: (orderedIds: string[]) => void;
  breadcrumbs: string[];
  branchLabel?: string | null;
  encoding?: string;
  diagnostics: DiagnosticSummary;
  fileTree: React.ReactNode;
  children: React.ReactNode;
};

function StudioDeveloperRail() {
  const pathname = usePathname() ?? '';
  const linkCls = (active: boolean) =>
    `flex size-9 items-center justify-center rounded-md border text-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 dark:text-slate-300 ${
      active
        ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-800 dark:border-cyan-500/40 dark:bg-cyan-500/20 dark:text-cyan-200'
        : 'border-transparent hover:border-slate-200 hover:bg-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-800/80'
    }`;

  return (
    <nav
      aria-label="Developer workspace"
      className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-slate-200 bg-slate-50 py-2 dark:border-slate-700 dark:bg-slate-950/80"
    >
      <Link href="/ade/studio/editor" className={linkCls(pathname.includes('/ade/studio/editor'))} title="Designer canvas">
        <LayoutDashboard className="size-4" aria-hidden />
        <span className="sr-only">Designer canvas</span>
      </Link>
      <Link href="/ade/studio/code" className={linkCls(pathname.includes('/ade/studio/code'))} title="Code export">
        <Code2 className="size-4" aria-hidden />
        <span className="sr-only">Code export</span>
      </Link>
      <Link href="/ade/studio/paths" className={linkCls(pathname.includes('/ade/studio/paths'))} title="Paths">
        <Route className="size-4" aria-hidden />
        <span className="sr-only">Paths</span>
      </Link>
      <div className="mt-auto flex flex-col items-center pb-1">
        <span
          className={`${linkCls(false)} pointer-events-none opacity-50`}
          title="Schema tools (soon)"
          aria-hidden
        >
          <Braces className="size-4" />
        </span>
      </div>
    </nav>
  );
}

function SortableTab({
  tab,
  active,
  onSelect,
  onClose,
}: {
  tab: DeveloperModeWorkspaceTab;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
  };
  const closable = tab.closable !== false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex shrink-0 items-stretch rounded-t-md border border-b-0 text-xs ${
        active
          ? 'border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'
          : 'border-transparent bg-slate-100/50 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400'
      }`}
    >
      <button
        type="button"
        className="cursor-grab touch-none px-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        aria-label={`Reorder ${tab.label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active}
        tabIndex={active ? 0 : -1}
        className="flex max-w-[200px] items-center gap-1.5 px-2 py-1.5 font-medium"
        onClick={onSelect}
        onAuxClick={(e) => {
          if (e.button === 1 && closable) {
            e.preventDefault();
            onClose();
          }
        }}
      >
        <span className="truncate">{tab.label}</span>
        {tab.dirty ? (
          <span className="size-1.5 shrink-0 rounded-full bg-amber-500" title="Unsaved or diagnostics" aria-label="Dirty" />
        ) : null}
      </button>
      {closable ? (
        <button
          type="button"
          className="px-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          aria-label={`Close ${tab.label}`}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/**
 * IDE-style shell: icon rail, virtual file tree, sortable tabs, breadcrumbs, editor region, status bar.
 */
export function DeveloperModeWorkspaceChrome({
  tabs,
  openTabIds,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabsReorder,
  breadcrumbs,
  branchLabel,
  encoding = 'UTF-8',
  diagnostics,
  fileTree,
  children,
}: DeveloperModeWorkspaceChromeProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const tabListId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const openTabs = openTabIds
    .map((id) => tabs.find((t) => t.id === id))
    .filter((t): t is DeveloperModeWorkspaceTab => Boolean(t));

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = openTabIds.indexOf(String(active.id));
      const newIndex = openTabIds.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;
      onTabsReorder(arrayMove(openTabIds, oldIndex, newIndex));
    },
    [openTabIds, onTabsReorder],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'w') return;
      if (!root.matches(':focus-within')) return;
      const t = tabs.find((x) => x.id === activeTabId);
      if (!t || t.closable === false) return;
      e.preventDefault();
      e.stopPropagation();
      onTabClose(t.id);
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [activeTabId, onTabClose, tabs]);

  const { errors, warnings, infos } = diagnostics;
  const diagParts: string[] = [];
  if (errors) diagParts.push(`${errors} ${errors === 1 ? 'error' : 'errors'}`);
  if (warnings) diagParts.push(`${warnings} ${warnings === 1 ? 'warning' : 'warnings'}`);
  if (infos) diagParts.push(`${infos} ${infos === 1 ? 'info' : 'infos'}`);

  return (
    <div
      ref={rootRef}
      data-developer-workspace-root
      tabIndex={-1}
      className="flex min-h-0 flex-1 flex-col outline-none"
    >
      <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
        <StudioDeveloperRail />

        <div className="flex w-52 shrink-0 flex-col border-r border-slate-200 dark:border-slate-700">{fileTree}</div>

        <div className="flex min-w-0 min-h-0 flex-1 flex-col bg-white dark:bg-slate-900">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div
              className="flex shrink-0 items-end gap-0.5 overflow-x-auto border-b border-slate-200 bg-slate-100/80 px-1 pt-1 dark:border-slate-700 dark:bg-slate-950/80"
              role="tablist"
              id={tabListId}
            >
              <SortableContext items={openTabIds} strategy={horizontalListSortingStrategy}>
                {openTabs.map((tab) => (
                  <SortableTab
                    key={tab.id}
                    tab={tab}
                    active={tab.id === activeTabId}
                    onSelect={() => onTabSelect(tab.id)}
                    onClose={() => onTabClose(tab.id)}
                  />
                ))}
              </SortableContext>
            </div>
          </DndContext>

          <nav
            aria-label="Breadcrumb"
            className="shrink-0 border-b border-slate-200 px-3 py-1.5 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400"
          >
            <ol className="flex flex-wrap items-center gap-1">
              {breadcrumbs.map((crumb, i) => (
                <li key={`${i}-${crumb}`} className="flex items-center gap-1">
                  {i > 0 ? <span aria-hidden className="text-slate-300 dark:text-slate-600">/</span> : null}
                  <span className={i === breadcrumbs.length - 1 ? 'font-medium text-slate-800 dark:text-slate-200' : ''}>
                    {crumb}
                  </span>
                </li>
              ))}
            </ol>
          </nav>

          <div className="min-h-0 flex-1 overflow-hidden">{children}</div>

          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-3 py-1 font-mono text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
            <span className="truncate">{branchLabel ?? '—'}</span>
            <span className="shrink-0 text-slate-500 dark:text-slate-500">
              {diagParts.length ? diagParts.join(' · ') : 'No diagnostics'}
            </span>
            <span className="shrink-0">{encoding}</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
