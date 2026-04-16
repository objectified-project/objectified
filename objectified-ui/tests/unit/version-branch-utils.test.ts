import { pickDefaultBranchCopyKey, sortBranchesMainFirst } from '../../../lib/version-branch-utils';

describe('sortBranchesMainFirst', () => {
  it('puts main first regardless of alphabetical order', () => {
    const sorted = sortBranchesMainFirst([
      { name: 'alpha', id: 'a' },
      { name: 'main', id: 'm' },
      { name: 'beta', id: 'b' },
    ]);
    expect(sorted.map((x) => x.name)).toEqual(['main', 'alpha', 'beta']);
  });

  it('is case-insensitive for main', () => {
    const sorted = sortBranchesMainFirst([{ name: 'Main', id: 'm' }, { name: 'a', id: 'a' }]);
    expect(sorted[0].name).toBe('Main');
  });
});

describe('pickDefaultBranchCopyKey', () => {
  it('returns blank when no branches', () => {
    expect(pickDefaultBranchCopyKey([], 'h1')).toBe('blank');
  });

  it('uses single branch id', () => {
    expect(
      pickDefaultBranchCopyKey([{ id: 'b1', name: 'feature', tip_version_id: 't1' }], null)
    ).toBe('branch:b1');
  });

  it('prefers main when multiple branches', () => {
    expect(
      pickDefaultBranchCopyKey(
        [
          { id: 'a', name: 'dev', tip_version_id: 't2' },
          { id: 'm', name: 'main', tip_version_id: 't1' },
        ],
        't1'
      )
    ).toBe('branch:m');
  });

  it('when no main, prefers branch whose tip matches head', () => {
    expect(
      pickDefaultBranchCopyKey(
        [
          { id: 'a', name: 'dev', tip_version_id: 't2' },
          { id: 'b', name: 'staging', tip_version_id: 't1' },
        ],
        't1'
      )
    ).toBe('branch:b');
  });
});
