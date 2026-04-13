import type { Edge, Node, Viewport } from '@xyflow/react';

export interface PathsCanvasBlob {
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
  viewport: { x: number; y: number; zoom: number };
}

const defaultViewport = (): { x: number; y: number; zoom: number } => ({
  x: 0,
  y: 0,
  zoom: 1,
});

/** Strip React Flow state to JSON-safe layout fields (no function data). */
export function serializePathsCanvas(
  nodes: Node[],
  edges: Edge[],
  viewport: Viewport
): PathsCanvasBlob {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      width: n.width,
      height: n.height,
      style: n.style,
      zIndex: n.zIndex,
      hidden: n.hidden,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      type: e.type,
      animated: e.animated,
      style: e.style,
      label: e.label,
      labelStyle: e.labelStyle,
      labelBgStyle: e.labelBgStyle,
      data: e.data,
      zIndex: e.zIndex,
    })),
    viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
  };
}

function savedNodePosition(
  saved: PathsCanvasBlob,
  id: string
): { x: number; y: number } | undefined {
  for (const raw of saved.nodes) {
    if (raw && typeof raw === 'object' && (raw as { id?: string }).id === id) {
      const pos = (raw as { position?: { x?: number; y?: number } }).position;
      if (
        pos &&
        typeof pos.x === 'number' &&
        typeof pos.y === 'number' &&
        !Number.isNaN(pos.x) &&
        !Number.isNaN(pos.y)
      ) {
        return { x: pos.x, y: pos.y };
      }
    }
  }
  return undefined;
}

function savedEdgeMap(saved: PathsCanvasBlob): Map<string, Record<string, unknown>> {
  const m = new Map<string, Record<string, unknown>>();
  for (const raw of saved.edges) {
    if (raw && typeof raw === 'object' && typeof (raw as { id?: string }).id === 'string') {
      m.set((raw as { id: string }).id, raw as Record<string, unknown>);
    }
  }
  return m;
}

/**
 * Merge persisted layout onto freshly computed graph from OpenAPI/path data.
 * — Node positions win by id when present in saved.
 * — Edges: overlay visual props from saved when id matches; append saved-only edges if endpoints exist.
 */
export function mergePathsCanvasLayout(
  computedNodes: Node[],
  computedEdges: Edge[],
  saved: PathsCanvasBlob | null | undefined
): { nodes: Node[]; edges: Edge[]; viewport: { x: number; y: number; zoom: number } } {
  if (!saved) {
    return { nodes: computedNodes, edges: computedEdges, viewport: defaultViewport() };
  }

  const nodeIds = new Set(computedNodes.map((n) => n.id));
  const mergedNodes = computedNodes.map((n) => {
    const p = savedNodePosition(saved, n.id);
    if (!p) return n;
    return { ...n, position: p };
  });

  const byId = savedEdgeMap(saved);
  const computedIds = new Set(computedEdges.map((e) => e.id));

  const mergedEdges: Edge[] = computedEdges.map((e) => {
    const s = byId.get(e.id);
    if (!s) return e;
    return {
      ...e,
      ...(typeof s.type === 'string' ? { type: s.type as Edge['type'] } : {}),
      ...(typeof s.animated === 'boolean' ? { animated: s.animated } : {}),
      ...(s.style && typeof s.style === 'object' ? { style: s.style as Edge['style'] } : {}),
      ...(s.label !== undefined ? { label: s.label as Edge['label'] } : {}),
      ...(s.labelStyle && typeof s.labelStyle === 'object'
        ? { labelStyle: s.labelStyle as Edge['labelStyle'] }
        : {}),
      ...(s.labelBgStyle && typeof s.labelBgStyle === 'object'
        ? { labelBgStyle: s.labelBgStyle as Edge['labelBgStyle'] }
        : {}),
      ...(s.data && typeof s.data === 'object' ? { data: { ...e.data, ...s.data } as Edge['data'] } : {}),
    };
  });

  for (const raw of saved.edges) {
    if (!raw || typeof raw !== 'object') continue;
    const id = (raw as { id?: string }).id;
    if (!id || computedIds.has(id)) continue;
    const source = (raw as { source?: string }).source;
    const target = (raw as { target?: string }).target;
    if (typeof source !== 'string' || typeof target !== 'string') continue;
    if (!nodeIds.has(source) || !nodeIds.has(target)) continue;
    mergedEdges.push(raw as Edge);
  }

  const vp = saved.viewport;
  const viewport =
    vp && typeof vp === 'object'
      ? {
          x: Number(vp.x) || 0,
          y: Number(vp.y) || 0,
          zoom: Number(vp.zoom) || 1,
        }
      : defaultViewport();

  return { nodes: mergedNodes, edges: mergedEdges, viewport };
}
