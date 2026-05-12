'use client';

import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronRight, ChevronDown, FileJson, Folder } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';

export type VirtualTreeFileNode = {
  kind: 'file';
  id: string;
  name: string;
};

export type VirtualTreeFolderNode = {
  kind: 'folder';
  id: string;
  name: string;
  defaultOpen?: boolean;
  children: VirtualTreeNode[];
};

export type VirtualTreeNode = VirtualTreeFileNode | VirtualTreeFolderNode;

type FlatRow =
  | { type: 'folder'; id: string; name: string; depth: number; expanded: boolean; hasChildren: boolean }
  | { type: 'file'; id: string; name: string; depth: number };

function flattenVisible(nodes: VirtualTreeNode[], expanded: Set<string>, depth = 0): FlatRow[] {
  const out: FlatRow[] = [];
  for (const n of nodes) {
    if (n.kind === 'folder') {
      const isOpen = expanded.has(n.id);
      out.push({
        type: 'folder',
        id: n.id,
        name: n.name,
        depth,
        expanded: isOpen,
        hasChildren: n.children.length > 0,
      });
      if (isOpen) {
        out.push(...flattenVisible(n.children, expanded, depth + 1));
      }
    } else {
      out.push({ type: 'file', id: n.id, name: n.name, depth });
    }
  }
  return out;
}

function initialExpanded(nodes: VirtualTreeNode[]): Set<string> {
  const s = new Set<string>();
  const walk = (list: VirtualTreeNode[]) => {
    for (const n of list) {
      if (n.kind === 'folder' && n.defaultOpen !== false) {
        s.add(n.id);
        walk(n.children);
      }
    }
  };
  walk(nodes);
  return s;
}

export type DeveloperModeVirtualFileTreeProps = {
  roots: VirtualTreeNode[];
  selectedFileId: string | null;
  onSelectFile: (fileId: string) => void;
  'aria-label'?: string;
};

/**
 * Virtual project tree using Radix `Collapsible` for expand/collapse and the
 * WAI-ARIA tree keyboard pattern (↑/↓ focus, ⌥→ expand, ⌥← collapse).
 */
export function DeveloperModeVirtualFileTree({
  roots,
  selectedFileId,
  onSelectFile,
  'aria-label': ariaLabel = 'Project files',
}: DeveloperModeVirtualFileTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => initialExpanded(roots));

  const rows = useMemo(() => flattenVisible(roots, expanded), [roots, expanded]);

  const [focusIndex, setFocusIndex] = useState(0);

  const treeRef = useRef<HTMLUListElement>(null);

  const safeFocusIndex = Math.min(Math.max(0, focusIndex), Math.max(0, rows.length - 1));

  const setFolderOpen = useCallback((folderId: string, open: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.add(folderId);
      else next.delete(folderId);
      return next;
    });
  }, []);

  const focusRow = useCallback((idx: number) => {
    if (rows.length === 0) return;
    const i = Math.min(Math.max(0, idx), rows.length - 1);
    setFocusIndex(i);
    const row = rows[i];
    if (row?.type === 'file') {
      onSelectFile(row.id);
    }
    // Move DOM focus to the inner button for this row so keyboard events are correct.
    const btn = treeRef.current?.querySelector<HTMLElement>(`[data-row-index="${i}"]`);
    btn?.focus();
  }, [rows, onSelectFile]);

  const onTreeKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (rows.length === 0) return;
      const i = safeFocusIndex;
      const row = rows[i];
      const alt = e.altKey;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusRow(i + 1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusRow(i - 1);
        return;
      }
      if (alt && (e.key === 'ArrowRight' || e.key === 'Right')) {
        e.preventDefault();
        if (row?.type === 'folder' && row.hasChildren && !row.expanded) {
          setFolderOpen(row.id, true);
        }
        return;
      }
      if (alt && (e.key === 'ArrowLeft' || e.key === 'Left')) {
        e.preventDefault();
        if (row?.type === 'folder' && row.expanded) {
          setFolderOpen(row.id, false);
        }
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (row?.type === 'folder' && row.hasChildren) {
          e.preventDefault();
          setFolderOpen(row.id, !row.expanded);
        } else if (row?.type === 'file') {
          e.preventDefault();
          onSelectFile(row.id);
        }
      }
    },
    [rows, safeFocusIndex, focusRow, setFolderOpen, onSelectFile],
  );

  function renderFolderRow(r: Extract<FlatRow, { type: 'folder' }>, index: number) {
    const Icon = r.expanded ? ChevronDown : ChevronRight;
    return (
      <li
        key={`folder-${r.id}`}
        role="treeitem"
        aria-expanded={r.expanded}
        aria-selected={false}
        aria-level={r.depth + 1}
        className="outline-none"
      >
        <Collapsible.Root open={r.expanded} onOpenChange={(open) => setFolderOpen(r.id, open)}>
          <Collapsible.Trigger asChild>
            <button
              type="button"
              data-row-index={index}
              tabIndex={index === safeFocusIndex ? 0 : -1}
              className="flex w-full items-center gap-1 rounded-md px-1 py-0.5 text-left text-xs text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-500/40 dark:text-slate-300 dark:hover:bg-slate-800/80"
              style={{ paddingLeft: `${r.depth * 12 + 4}px` }}
              onFocus={() => setFocusIndex(index)}
            >
              <Icon className="size-3 shrink-0 text-slate-400" aria-hidden />
              <Folder className="size-3.5 shrink-0 text-amber-500/90" aria-hidden />
              <span className="truncate font-mono">{r.name}</span>
            </button>
          </Collapsible.Trigger>
        </Collapsible.Root>
      </li>
    );
  }

  function renderFileRow(r: Extract<FlatRow, { type: 'file' }>, index: number) {
    const selected = r.id === selectedFileId;
    return (
      <li
        key={`file-${r.id}`}
        role="treeitem"
        aria-selected={selected}
        aria-level={r.depth + 1}
        className="outline-none"
      >
        <button
          type="button"
          data-row-index={index}
          tabIndex={index === safeFocusIndex ? 0 : -1}
          className={`flex w-full items-center gap-1 rounded-md px-1 py-0.5 text-left text-xs focus-visible:ring-2 focus-visible:ring-cyan-500/40 ${
            selected
              ? 'bg-cyan-500/20 font-medium text-slate-900 dark:bg-cyan-500/25 dark:text-slate-100'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/80'
          }`}
          style={{ paddingLeft: `${r.depth * 12 + 20}px` }}
          onClick={() => {
            setFocusIndex(index);
            onSelectFile(r.id);
          }}
          onFocus={() => setFocusIndex(index)}
        >
          <FileJson className="size-3.5 shrink-0 text-cyan-600/90 dark:text-cyan-400/90" aria-hidden />
          <span className="truncate font-mono">{r.name}</span>
        </button>
      </li>
    );
  }

  if (roots.length === 0) {
    return (
      <div className="border-b border-slate-200 px-2 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
        No virtual files
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col border-b border-slate-200 bg-slate-50/90 dark:border-slate-700 dark:bg-slate-950/50">
      <div className="shrink-0 border-b border-slate-200 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Files
      </div>
      <ul
        ref={treeRef}
        role="tree"
        aria-label={ariaLabel}
        tabIndex={-1}
        onKeyDown={onTreeKeyDown}
        className="min-h-0 flex-1 list-none space-y-0.5 overflow-y-auto p-1.5 outline-none"
      >
        {rows.map((row, index) =>
          row.type === 'folder' ? renderFolderRow(row, index) : renderFileRow(row, index),
        )}
      </ul>
    </div>
  );
}
