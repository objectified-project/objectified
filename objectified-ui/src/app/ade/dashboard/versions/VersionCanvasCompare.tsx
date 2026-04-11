'use client';

import { useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { LayoutState, LayoutDiffSummary } from '../../../../../lib/layout-diff';
import { compareLayouts } from '../../../../../lib/layout-diff';

export type CanvasCompareViewMode = 'split' | 'overlay';

export interface VersionCanvasCompareProps {
  left: LayoutState | null;
  right: LayoutState | null;
  leftLabel: string;
  rightLabel: string;
  mode: CanvasCompareViewMode;
  /** When omitted, diff is derived from left/right (empty layout is treated as empty graph). */
  diff?: LayoutDiffSummary | null;
}

function safeArray<T>(arr: T[] | null | undefined): T[] {
  return Array.isArray(arr) ? arr : [];
}

function buildDiff(left: LayoutState | null, right: LayoutState | null): LayoutDiffSummary {
  const l = left ?? { nodes: [], edges: [] };
  const r = right ?? { nodes: [], edges: [] };
  return compareLayouts(l, r);
}

function strokeForTone(tone: 'added' | 'removed' | 'modified' | 'unchanged'): string {
  switch (tone) {
    case 'added':
      return '#10b981';
    case 'removed':
      return '#ef4444';
    case 'modified':
      return '#f59e0b';
    default:
      return '#9ca3af';
  }
}

function classifyNode(
  nodeId: string,
  side: 'left' | 'right',
  diff: LayoutDiffSummary
): 'added' | 'removed' | 'modified' | 'unchanged' {
  const isAdded = diff.nodes.added.some((e) => e.id === nodeId);
  const isRemoved = diff.nodes.removed.some((e) => e.id === nodeId);
  const isModified = diff.nodes.modified.some((e) => e.id === nodeId);
  if (side === 'left') {
    if (isRemoved) return 'removed';
    if (isModified) return 'modified';
    return 'unchanged';
  }
  if (isAdded) return 'added';
  if (isModified) return 'modified';
  return 'unchanged';
}

function classifyEdge(
  edgeId: string,
  side: 'left' | 'right',
  diff: LayoutDiffSummary
): 'added' | 'removed' | 'modified' | 'unchanged' {
  const isAdded = diff.edges.added.some((e) => e.id === edgeId);
  const isRemoved = diff.edges.removed.some((e) => e.id === edgeId);
  const isModified = diff.edges.modified.some((e) => e.id === edgeId);
  if (side === 'left') {
    if (isRemoved) return 'removed';
    if (isModified) return 'modified';
    return 'unchanged';
  }
  if (isAdded) return 'added';
  if (isModified) return 'modified';
  return 'unchanged';
}

function toFlow(
  state: LayoutState | null,
  side: 'left' | 'right',
  diff: LayoutDiffSummary
): { nodes: Node[]; edges: Edge[] } {
  if (!state) {
    return { nodes: [], edges: [] };
  }
  const nodes: Node[] = safeArray(state.nodes).map((n) => {
    const tone = classifyNode(n.id, side, diff);
    const label =
      typeof n.data?.name === 'string'
        ? n.data.name
        : typeof (n.data as { label?: string } | undefined)?.label === 'string'
          ? (n.data as { label: string }).label
          : n.id;
    return {
      id: n.id,
      type: 'default',
      position: n.position ?? { x: 0, y: 0 },
      data: { label },
      style: {
        borderWidth: 2,
        borderColor: strokeForTone(tone),
      },
    };
  });
  const edges: Edge[] = safeArray(state.edges).map((e) => {
    const tone = classifyEdge(e.id, side, diff);
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
      style: {
        stroke: strokeForTone(tone),
        strokeWidth: tone === 'unchanged' ? 1 : 2,
      },
    };
  });
  return { nodes, edges };
}

function FlowPane({
  state,
  side,
  diff,
  title,
  showTitle,
  interactive,
}: {
  state: LayoutState | null;
  side: 'left' | 'right';
  diff: LayoutDiffSummary;
  title: string;
  showTitle: boolean;
  interactive: boolean;
}) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => toFlow(state, side, diff),
    [state, side, diff]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const empty =
    !state || (safeArray(state.nodes).length === 0 && safeArray(state.edges).length === 0);

  return (
    <div className="relative flex min-h-0 min-h-[min(320px,40vh)] flex-1 flex-col">
      {showTitle && (
        <div className="shrink-0 border-b border-gray-200 bg-gray-100 px-2 py-1 text-center text-xs font-medium text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
          {title}
        </div>
      )}
      {empty ? (
        <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-gray-500 dark:text-gray-400">
          No saved canvas layout for this revision. Save a default or named layout in Studio to
          compare visually.
        </div>
      ) : (
        <div className="relative min-h-[min(380px,45vh)] w-full flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag={interactive}
            zoomOnScroll={interactive}
            zoomOnPinch={interactive}
            zoomOnDoubleClick={interactive}
            preventScrolling={!interactive}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1.1 }}
            className="bg-gray-50 dark:bg-gray-900"
          >
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            <Controls showInteractive={interactive} />
          </ReactFlow>
        </div>
      )}
    </div>
  );
}

function CanvasLegend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600 dark:text-gray-400">
      <span className="font-medium text-gray-800 dark:text-gray-200">Legend</span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-3 w-3 rounded border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
          aria-hidden
        />
        Added (compare side)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-3 w-3 rounded border-2 border-red-500 bg-red-50 dark:bg-red-950/40"
          aria-hidden
        />
        Removed (base side)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-3 w-3 rounded border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/40"
          aria-hidden
        />
        Moved / modified
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-3 w-3 rounded border-2 border-gray-400 bg-gray-50 dark:bg-gray-800/40"
          aria-hidden
        />
        Unchanged
      </span>
    </div>
  );
}

export default function VersionCanvasCompare({
  left,
  right,
  leftLabel,
  rightLabel,
  mode,
  diff: diffProp,
}: VersionCanvasCompareProps) {
  const diff = useMemo(() => diffProp ?? buildDiff(left, right), [diffProp, left, right]);

  return (
    <div className="flex min-h-0 flex-col">
      <CanvasLegend />
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        Renders the resolved Studio layout (default snapshot, or the effective named layout when no
        default exists). Logical schema diff stays on the other tabs.
      </p>
      {mode === 'split' ? (
        <div className="flex min-h-0 w-full flex-1 flex-col gap-3 md:flex-row">
          <FlowPane
            state={left}
            side="left"
            diff={diff}
            title={leftLabel}
            showTitle
            interactive
          />
          <FlowPane
            state={right}
            side="right"
            diff={diff}
            title={rightLabel}
            showTitle
            interactive
          />
        </div>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
            <span>
              <span className="font-medium text-gray-800 dark:text-gray-200">Base</span> —{' '}
              {leftLabel}{' '}
              <span className="text-gray-500 dark:text-gray-500">(underlay, dimmed)</span>
            </span>
            <span>
              <span className="font-medium text-gray-800 dark:text-gray-200">Compare</span> —{' '}
              {rightLabel}{' '}
              <span className="text-gray-500 dark:text-gray-500">(on top, pan/zoom)</span>
            </span>
          </div>
          <div className="relative min-h-[min(420px,50vh)] w-full flex-1">
            <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.72]">
              <FlowPane
                state={left}
                side="left"
                diff={diff}
                title={leftLabel}
                showTitle={false}
                interactive={false}
              />
            </div>
            <div className="absolute inset-0 z-10 opacity-[0.88]">
              <FlowPane
                state={right}
                side="right"
                diff={diff}
                title={rightLabel}
                showTitle={false}
                interactive
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
