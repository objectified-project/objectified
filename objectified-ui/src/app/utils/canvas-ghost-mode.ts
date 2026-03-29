/**
 * Canvas node ghosts mode (#484): show nodes hidden by criteria or manual hide as semi-transparent.
 */

import type { CanvasGroupForVisibility } from '@/app/utils/canvas-node-visibility';
import { groupNodeIdIsVisible } from '@/app/utils/canvas-display-visibility';

/** Edge is drawn when both endpoints are class nodes present in the base graph. */
export function edgeBelongsOnCanvas(
  source: string,
  target: string,
  visibleClassIds: Set<string>,
  allBaseClassIds: Set<string>,
  nodeGhostsModeEnabled: boolean
): boolean {
  if (nodeGhostsModeEnabled) {
    return allBaseClassIds.has(source) && allBaseClassIds.has(target);
  }
  return visibleClassIds.has(source) && visibleClassIds.has(target);
}

/** CSS class for edges that touch at least one hidden (ghost) class node. */
export function ghostEdgeClassName(
  source: string,
  target: string,
  visibleClassIds: Set<string>,
  nodeGhostsModeEnabled: boolean
): string {
  if (!nodeGhostsModeEnabled) return '';
  const touchesGhost =
    !visibleClassIds.has(source) || !visibleClassIds.has(target);
  return touchesGhost ? 'canvas-edge-ghost' : '';
}

/** CSS class for class or group nodes that are hidden by hide rules but still drawn in ghosts mode. */
export function ghostNodeClassName(
  nodeId: string,
  nodeType: string | undefined,
  group: CanvasGroupForVisibility | undefined,
  visibleClassIds: Set<string>,
  nodeGhostsModeEnabled: boolean
): string {
  if (!nodeGhostsModeEnabled) return '';
  if (nodeType === 'groupNode') {
    if (!group) return '';
    return groupNodeIdIsVisible(group, visibleClassIds) ? '' : 'canvas-node-ghost';
  }
  return visibleClassIds.has(nodeId) ? '' : 'canvas-node-ghost';
}
