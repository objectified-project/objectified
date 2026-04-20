import { commitRevisionDialogShowsBranchPicker } from '@/app/components/ade/version-dialogs/CommitRevisionDialog';

describe('commitRevisionDialogShowsBranchPicker', () => {
  const branches = [{ id: 'a' }, { id: 'b' }];

  test('hides picker for 0 or 1 branch', () => {
    expect(commitRevisionDialogShowsBranchPicker(0, null, [])).toBe(false);
    expect(commitRevisionDialogShowsBranchPicker(1, null, [{ id: 'a' }])).toBe(false);
  });

  test('shows picker for multi-branch without lock', () => {
    expect(commitRevisionDialogShowsBranchPicker(2, null, branches)).toBe(true);
    expect(commitRevisionDialogShowsBranchPicker(2, '  ', branches)).toBe(true);
  });

  test('hides picker when lock matches a branch', () => {
    expect(commitRevisionDialogShowsBranchPicker(2, 'a', branches)).toBe(false);
  });

  test('shows picker when lock does not match any branch', () => {
    expect(commitRevisionDialogShowsBranchPicker(2, 'missing', branches)).toBe(true);
  });
});
