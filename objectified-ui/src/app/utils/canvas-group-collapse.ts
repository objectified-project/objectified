/**
 * Canvas group collapse (#154): compact group frames and hide member class nodes.
 */

export const COLLAPSED_GROUP_FRAME_WIDTH = 240;
export const COLLAPSED_GROUP_FRAME_HEIGHT = 56;

export function collapsePrefsStorageKey(userId: string, versionId: string): string {
  return `ade.canvasGroupCollapsed:v1:${userId}:${versionId}`;
}

/** Class node IDs that belong to at least one collapsed group. */
export function getClassIdsInCollapsedGroups(
  groups: { id: string; nodeIds: string[] }[],
  collapsedGroupIds: Set<string>
): Set<string> {
  const ids = new Set<string>();
  for (const g of groups) {
    if (!collapsedGroupIds.has(g.id)) continue;
    for (const id of g.nodeIds) {
      ids.add(id);
    }
  }
  return ids;
}
