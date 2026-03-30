import {
  collapsePrefsStorageKey,
  getClassIdsInCollapsedGroups,
} from '@/app/utils/canvas-group-collapse';

describe('canvas-group-collapse', () => {
  it('getClassIdsInCollapsedGroups returns members of collapsed groups only', () => {
    const groups = [
      { id: 'a', nodeIds: ['1', '2'] },
      { id: 'b', nodeIds: ['3'] },
    ];
    expect([...getClassIdsInCollapsedGroups(groups, new Set(['a']))].sort()).toEqual(['1', '2']);
    expect(getClassIdsInCollapsedGroups(groups, new Set(['a', 'b'])).size).toBe(3);
    expect(getClassIdsInCollapsedGroups(groups, new Set()).size).toBe(0);
  });

  it('collapsePrefsStorageKey encodes user and version', () => {
    expect(collapsePrefsStorageKey('user-1', 'ver-2')).toBe(
      'ade.canvasGroupCollapsed:v1:user-1:ver-2'
    );
  });
});
