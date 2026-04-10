/**
 * Unit tests for version branch and merge helper functions in lib/db/helper.ts.
 * Covers: isValidVersionBranchName, listVersionBranches, createVersionBranch,
 * deleteVersionBranch, mergeVersionBranchesPreviewServer, and mergeVersionBranchesServer.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock DB pool
jest.mock('../../lib/db/db', () => ({
  query: jest.fn(),
}));

// Mock bcrypt and crypto (required by helper.ts)
jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));
jest.mock('crypto', () => ({ randomBytes: jest.fn(() => Buffer.from('test')) }));

// Mock Next.js server-only headers
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({ getAll: () => [] })),
}));

// Mock plan entitlements
jest.mock('../../lib/db/plan-entitlements', () => ({
  getPlanBlockMessageForNewProject: jest.fn(async () => null),
  getPlanBlockMessageForNewVersion: jest.fn(async () => null),
}));

// Mock version-merge so we can control classification without real spec diffing
jest.mock('../../lib/version-merge', () => ({
  mergePreviewFromSpecs: jest.fn(),
}));

// Mock OpenAPI generation used by buildOpenApiSpecJsonForVersion
jest.mock('../../src/app/utils/openapi', () => ({
  generateOpenApiSpec: jest.fn(() => '{}'),
}));

import { isValidVersionBranchName } from '../../lib/version-branch-utils';
import {
  listVersionBranches,
  createVersionBranch,
  deleteVersionBranch,
  mergeVersionBranchesPreviewServer,
  mergeVersionBranchesServer,
} from '../../lib/db/helper';
import { mergePreviewFromSpecs } from '../../lib/version-merge';

// ─── helpers ─────────────────────────────────────────────────────────────────

function getDbMock() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../../lib/db/db') as { query: jest.Mock };
}

const PROJECT_ID = 'proj-uuid-1';
const TENANT_ID = 'tenant-uuid-1';
const USER_ID = 'user-uuid-1';
const BRANCH_ID = 'branch-uuid-1';
const VERSION_ID = 'ver-uuid-1';
const VERSION_ID_2 = 'ver-uuid-2';

// ─── isValidVersionBranchName ─────────────────────────────────────────────────

describe('isValidVersionBranchName', () => {
  it('accepts simple alpha name', () => {
    expect(isValidVersionBranchName('main')).toBe(true);
  });

  it('accepts names with digits, dots, dashes and slashes', () => {
    expect(isValidVersionBranchName('feature/my-branch.1')).toBe(true);
  });

  it('rejects names starting with a digit', () => {
    expect(isValidVersionBranchName('1-bad')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidVersionBranchName('')).toBe(false);
  });

  it('rejects names with spaces', () => {
    expect(isValidVersionBranchName('bad name')).toBe(false);
  });

  it('rejects names longer than 255 chars', () => {
    expect(isValidVersionBranchName('a' + 'x'.repeat(255))).toBe(false);
  });

  it('accepts exactly 255-char name', () => {
    expect(isValidVersionBranchName('a' + 'x'.repeat(254))).toBe(true);
  });
});

// ─── listVersionBranches ─────────────────────────────────────────────────────

describe('listVersionBranches', () => {
  beforeEach(() => {
    getDbMock().query.mockClear();
  });

  it('returns success:false when project not in tenant', async () => {
    getDbMock().query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const result = JSON.parse(await listVersionBranches(PROJECT_ID, TENANT_ID));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('returns branch list on success', async () => {
    // assertProjectInTenant → 1 row
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{}] });
    // list query → branches
    const fakeBranch = {
      id: BRANCH_ID,
      project_id: PROJECT_ID,
      name: 'main',
      tip_version_id: VERSION_ID,
      tip_version_string: '1.0.0',
    };
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [fakeBranch] });

    const result = JSON.parse(await listVersionBranches(PROJECT_ID, TENANT_ID));
    expect(result.success).toBe(true);
    expect(result.branches).toHaveLength(1);
    expect(result.branches[0].name).toBe('main');
  });

  it('uses AND v.project_id = b.project_id in the JOIN', async () => {
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{}] });
    getDbMock().query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    await listVersionBranches(PROJECT_ID, TENANT_ID);
    const listCall = getDbMock().query.mock.calls[1];
    expect((listCall[0] as string).toLowerCase()).toContain('v.project_id = b.project_id');
  });

  it('returns success:false on DB error', async () => {
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{}] });
    getDbMock().query.mockRejectedValueOnce(new Error('DB down'));
    const result = JSON.parse(await listVersionBranches(PROJECT_ID, TENANT_ID));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/DB down/);
  });
});

// ─── createVersionBranch ─────────────────────────────────────────────────────

describe('createVersionBranch', () => {
  beforeEach(() => {
    getDbMock().query.mockClear();
  });

  it('rejects invalid branch name', async () => {
    const result = JSON.parse(
      await createVersionBranch(PROJECT_ID, TENANT_ID, '123bad', VERSION_ID, USER_ID)
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/letter/i);
  });

  it('returns success:false when project not in tenant', async () => {
    getDbMock().query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const result = JSON.parse(
      await createVersionBranch(PROJECT_ID, TENANT_ID, 'feature', VERSION_ID, USER_ID)
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('returns success:false when source version not found', async () => {
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{}] }); // project OK
    getDbMock().query.mockResolvedValueOnce({ rowCount: 0, rows: [] });    // version missing
    const result = JSON.parse(
      await createVersionBranch(PROJECT_ID, TENANT_ID, 'feature', VERSION_ID, USER_ID)
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/version not found/i);
  });

  it('creates branch and returns success', async () => {
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{}] }); // project OK
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: VERSION_ID }] }); // version found
    const fakeBranch = { id: BRANCH_ID, name: 'feature', tip_version_id: VERSION_ID };
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [fakeBranch] }); // insert
    const result = JSON.parse(
      await createVersionBranch(PROJECT_ID, TENANT_ID, 'feature', VERSION_ID, USER_ID)
    );
    expect(result.success).toBe(true);
    expect(result.branch.name).toBe('feature');
  });

  it('returns duplicate error on unique constraint violation', async () => {
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{}] });
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: VERSION_ID }] });
    const pgError = Object.assign(new Error('duplicate key'), { code: '23505' });
    getDbMock().query.mockRejectedValueOnce(pgError);
    const result = JSON.parse(
      await createVersionBranch(PROJECT_ID, TENANT_ID, 'feature', VERSION_ID, USER_ID)
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already exists/i);
  });
});

// ─── deleteVersionBranch ─────────────────────────────────────────────────────

describe('deleteVersionBranch', () => {
  beforeEach(() => {
    getDbMock().query.mockClear();
  });

  it('returns success:false when project not in tenant', async () => {
    getDbMock().query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const result = JSON.parse(
      await deleteVersionBranch(BRANCH_ID, PROJECT_ID, TENANT_ID, USER_ID, false)
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('returns success:false when branch not found', async () => {
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{}] }); // project OK
    getDbMock().query.mockResolvedValueOnce({ rowCount: 0, rows: [] });    // branch missing
    const result = JSON.parse(
      await deleteVersionBranch(BRANCH_ID, PROJECT_ID, TENANT_ID, USER_ID, false)
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('returns BRANCH_PROTECTED when branch is protected and user is not admin', async () => {
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{}] });
    getDbMock().query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: BRANCH_ID, created_by: USER_ID, protected: true }],
    });
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1 });
    const result = JSON.parse(
      await deleteVersionBranch(BRANCH_ID, PROJECT_ID, TENANT_ID, USER_ID, false)
    );
    expect(result.success).toBe(false);
    expect(result.code).toBe('BRANCH_PROTECTED');
  });

  it('returns unauthorized when non-creator non-admin tries to delete', async () => {
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{}] }); // project OK
    getDbMock().query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: BRANCH_ID, created_by: 'other-user', protected: false }],
    });
    const result = JSON.parse(
      await deleteVersionBranch(BRANCH_ID, PROJECT_ID, TENANT_ID, USER_ID, false)
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/creator|admin/i);
  });

  it('allows tenant admin to delete any branch', async () => {
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{}] });
    getDbMock().query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: BRANCH_ID, created_by: 'other-user', protected: false }],
    });
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // DELETE
    const result = JSON.parse(
      await deleteVersionBranch(BRANCH_ID, PROJECT_ID, TENANT_ID, USER_ID, true)
    );
    expect(result.success).toBe(true);
  });

  it('allows creator to delete their own branch', async () => {
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{}] });
    getDbMock().query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: BRANCH_ID, created_by: USER_ID, protected: false }],
    });
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const result = JSON.parse(
      await deleteVersionBranch(BRANCH_ID, PROJECT_ID, TENANT_ID, USER_ID, false)
    );
    expect(result.success).toBe(true);
  });
});

// ─── mergeVersionBranchesPreviewServer ───────────────────────────────────────

describe('mergeVersionBranchesPreviewServer', () => {
  beforeEach(() => {
    getDbMock().query.mockClear();
    (mergePreviewFromSpecs as jest.Mock).mockClear();
  });

  it('returns error when project not found', async () => {
    getDbMock().query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const result = JSON.parse(
      await mergeVersionBranchesPreviewServer({
        projectId: PROJECT_ID,
        tenantId: TENANT_ID,
        sourceBranchName: 'src',
        targetBranchName: 'tgt',
      })
    );
    expect(result.success).toBe(false);
    expect(result.status).toBe(404);
  });

  it('returns error when branches not found', async () => {
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{}] }); // project
    getDbMock().query.mockResolvedValueOnce({ rowCount: 0, rows: [] });    // src branch
    getDbMock().query.mockResolvedValueOnce({ rowCount: 0, rows: [] });    // tgt branch
    const result = JSON.parse(
      await mergeVersionBranchesPreviewServer({
        projectId: PROJECT_ID,
        tenantId: TENANT_ID,
        sourceBranchName: 'src',
        targetBranchName: 'tgt',
      })
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/branch not found/i);
  });

  it('returns preview classification on success', async () => {
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{}] }); // project
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{ tip_version_id: VERSION_ID }] }); // src
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{ tip_version_id: VERSION_ID_2 }] }); // tgt
    // tips query
    getDbMock().query.mockResolvedValueOnce({
      rowCount: 2,
      rows: [
        { id: VERSION_ID, project_id: PROJECT_ID, version_id: '1.0.0', description: null, project_name: 'P' },
        { id: VERSION_ID_2, project_id: PROJECT_ID, version_id: '1.1.0', description: null, project_name: 'P' },
      ],
    });
    // getClassesForVersion called for each tip (mock returns empty list)
    getDbMock().query.mockResolvedValue({ rowCount: 0, rows: [] });

    (mergePreviewFromSpecs as jest.Mock).mockResolvedValueOnce({
      summary: { added: [], modified: [], removed: [] },
      classification: { canAutoMerge: true, conflictPaths: [], addedSchemaNames: [] },
    });

    const result = JSON.parse(
      await mergeVersionBranchesPreviewServer({
        projectId: PROJECT_ID,
        tenantId: TENANT_ID,
        sourceBranchName: 'src',
        targetBranchName: 'tgt',
      })
    );
    expect(result.success).toBe(true);
    expect(result.classification.canAutoMerge).toBe(true);
  });
});

// ─── mergeVersionBranchesServer ──────────────────────────────────────────────

describe('mergeVersionBranchesServer', () => {
  beforeEach(() => {
    getDbMock().query.mockClear();
    (mergePreviewFromSpecs as jest.Mock).mockClear();
  });

  it('returns error when project not found', async () => {
    getDbMock().query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const result = JSON.parse(
      await mergeVersionBranchesServer({
        projectId: PROJECT_ID,
        tenantId: TENANT_ID,
        userId: USER_ID,
        sourceBranchName: 'src',
        targetBranchName: 'tgt',
        baseRevisionId: VERSION_ID_2,
      })
    );
    expect(result.success).toBe(false);
    expect(result.status).toBe(404);
  });

  it('returns STALE_HEAD when baseRevisionId does not match target tip', async () => {
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{}] }); // project
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: BRANCH_ID, tip_version_id: VERSION_ID, name: 'src' }] }); // src branch
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: BRANCH_ID, tip_version_id: 'different-id', name: 'tgt' }] }); // tgt branch
    const result = JSON.parse(
      await mergeVersionBranchesServer({
        projectId: PROJECT_ID,
        tenantId: TENANT_ID,
        userId: USER_ID,
        sourceBranchName: 'src',
        targetBranchName: 'tgt',
        baseRevisionId: VERSION_ID_2,
      })
    );
    expect(result.success).toBe(false);
    expect(result.code).toBe('STALE_HEAD');
  });

  it('returns MERGE_CONFLICT when classification has overlapping paths', async () => {
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{}] }); // project
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: BRANCH_ID, tip_version_id: VERSION_ID, name: 'src' }] });
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: BRANCH_ID, tip_version_id: VERSION_ID_2, name: 'tgt' }] });
    // tips
    getDbMock().query.mockResolvedValueOnce({
      rowCount: 2,
      rows: [
        { id: VERSION_ID, project_id: PROJECT_ID, version_id: '1.0.0', description: null, project_name: 'P', published: false },
        { id: VERSION_ID_2, project_id: PROJECT_ID, version_id: '1.1.0', description: null, project_name: 'P', published: false },
      ],
    });
    // getClassesForVersion calls
    getDbMock().query.mockResolvedValue({ rowCount: 0, rows: [] });

    (mergePreviewFromSpecs as jest.Mock).mockResolvedValueOnce({
      summary: { added: [], modified: [{ path: 'schemas.User' }], removed: [] },
      classification: { canAutoMerge: false, conflictPaths: ['schemas.User'], addedSchemaNames: [] },
    });

    const result = JSON.parse(
      await mergeVersionBranchesServer({
        projectId: PROJECT_ID,
        tenantId: TENANT_ID,
        userId: USER_ID,
        sourceBranchName: 'src',
        targetBranchName: 'tgt',
        baseRevisionId: VERSION_ID_2,
      })
    );
    expect(result.success).toBe(false);
    expect(result.code).toBe('MERGE_CONFLICT');
    expect(result.conflictPaths).toContain('schemas.User');
  });

  it('wraps apply in a transaction and commits on success', async () => {
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{}] }); // project
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: BRANCH_ID, tip_version_id: VERSION_ID, name: 'src' }] });
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: BRANCH_ID, tip_version_id: VERSION_ID_2, name: 'tgt' }] });
    // tips
    getDbMock().query.mockResolvedValueOnce({
      rowCount: 2,
      rows: [
        { id: VERSION_ID, project_id: PROJECT_ID, version_id: '1.0.0', description: null, project_name: 'P', published: false },
        { id: VERSION_ID_2, project_id: PROJECT_ID, version_id: '1.1.0', description: null, project_name: 'P', published: false },
      ],
    });
    // getClassesForVersion x2 (for buildOpenApiSpec)
    getDbMock().query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    getDbMock().query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    (mergePreviewFromSpecs as jest.Mock).mockResolvedValueOnce({
      summary: { added: [], modified: [], removed: [] },
      classification: { canAutoMerge: true, conflictPaths: [], addedSchemaNames: [] },
    });

    // getLatestVersionForProject
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{ version_id: '1.1.0' }] });
    // getPlanBlockMessageForNewVersion (mocked above to null, no DB call needed)
    // BEGIN
    getDbMock().query.mockResolvedValueOnce({});
    // INSERT INTO versions
    const newVer = { id: 'new-ver-id', version_id: '1.1.1', project_id: PROJECT_ID };
    getDbMock().query.mockResolvedValueOnce({ rows: [newVer] });
    // copyClassesFromVersion inner query (SELECT+INSERT classes)
    getDbMock().query.mockResolvedValueOnce({ rowCount: 0, rows: [] }); // list classes
    // COMMIT
    getDbMock().query.mockResolvedValueOnce({});
    // UPDATE version_branches
    getDbMock().query.mockResolvedValueOnce({});

    const result = JSON.parse(
      await mergeVersionBranchesServer({
        projectId: PROJECT_ID,
        tenantId: TENANT_ID,
        userId: USER_ID,
        sourceBranchName: 'src',
        targetBranchName: 'tgt',
        baseRevisionId: VERSION_ID_2,
      })
    );

    // Verify BEGIN and COMMIT were called
    const queryCalls = getDbMock().query.mock.calls.map((c) => String(c[0]).trim());
    expect(queryCalls).toContain('BEGIN');
    expect(queryCalls).toContain('COMMIT');
    expect(result.success).toBe(true);
  });

  it('rolls back transaction on copy failure', async () => {
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{}] }); // project
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: BRANCH_ID, tip_version_id: VERSION_ID, name: 'src' }] });
    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: BRANCH_ID, tip_version_id: VERSION_ID_2, name: 'tgt' }] });
    getDbMock().query.mockResolvedValueOnce({
      rowCount: 2,
      rows: [
        { id: VERSION_ID, project_id: PROJECT_ID, version_id: '1.0.0', description: null, project_name: 'P', published: false },
        { id: VERSION_ID_2, project_id: PROJECT_ID, version_id: '1.1.0', description: null, project_name: 'P', published: false },
      ],
    });
    getDbMock().query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    getDbMock().query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    (mergePreviewFromSpecs as jest.Mock).mockResolvedValueOnce({
      summary: { added: [], modified: [], removed: [] },
      classification: { canAutoMerge: true, conflictPaths: [], addedSchemaNames: [] },
    });

    getDbMock().query.mockResolvedValueOnce({ rowCount: 1, rows: [{ version_id: '1.1.0' }] }); // latest
    getDbMock().query.mockResolvedValueOnce({}); // BEGIN
    getDbMock().query.mockResolvedValueOnce({ rows: [{ id: 'new-ver-id', version_id: '1.1.1' }] }); // INSERT version
    // copyClassesFromVersion throws
    getDbMock().query.mockRejectedValueOnce(new Error('copy failed'));
    getDbMock().query.mockResolvedValueOnce({}); // ROLLBACK

    const result = JSON.parse(
      await mergeVersionBranchesServer({
        projectId: PROJECT_ID,
        tenantId: TENANT_ID,
        userId: USER_ID,
        sourceBranchName: 'src',
        targetBranchName: 'tgt',
        baseRevisionId: VERSION_ID_2,
      })
    );

    const queryCalls = getDbMock().query.mock.calls.map((c) => String(c[0]).trim());
    expect(queryCalls).toContain('BEGIN');
    expect(queryCalls).toContain('ROLLBACK');
    expect(result.success).toBe(false);
  });
});
