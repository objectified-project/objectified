/**
 * Helpers for ADE studio canvas node/edge visibility (#482 isolate selection, etc.).
 */

export interface CanvasGroupForVisibility {
  id: string;
  nodeIds: string[];
}

/** Group nodes that contain at least one of the selected class IDs. */
export function getVisibleGroupIdsForSelectedClasses(
  groups: CanvasGroupForVisibility[],
  selectedClassIds: Set<string>
): Set<string> {
  return new Set(
    groups.filter((g) => g.nodeIds.some((id) => selectedClassIds.has(id))).map((g) => g.id)
  );
}

/** Build the set of canvas node IDs visible when isolating to the given class selection. */
export function getVisibleNodeIdsForIsolateSelection(
  groups: CanvasGroupForVisibility[],
  selectedClassIds: Set<string>
): Set<string> {
  const visibleGroupIds = getVisibleGroupIdsForSelectedClasses(groups, selectedClassIds);
  return new Set<string>([...selectedClassIds, ...visibleGroupIds]);
}
