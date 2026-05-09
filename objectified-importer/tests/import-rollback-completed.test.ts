/**
 * Import Rollback Completed Tests (#735)
 *
 * Tests for rollbackCompletedImport: undo a completed import by removing
 * the created project and all its data. Only allowed when state === 'completed'.
 */


import * as uiHelper from '../../objectified-ui/lib/db/helper';

const mockClient = { query: vi.fn(), release: vi.fn() };

vi.mock('../src/engine/import-transaction', () => ({
  getTransactionClient: vi.fn(() => Promise.resolve(mockClient)),
  beginTransaction: vi.fn(() => Promise.resolve()),
  commitTransaction: vi.fn(() => Promise.resolve()),
  rollbackTransaction: vi.fn(() => Promise.resolve()),
  releaseClient: vi.fn(() => Promise.resolve()),
  createProjectTx: vi.fn(() =>
    Promise.resolve(JSON.stringify({ success: true, project: { id: 'proj-rollback-test' } }))
  ),
  createVersionTx: vi.fn(() =>
    Promise.resolve(JSON.stringify({ success: true, version: { id: 'ver-rollback-test' } }))
  ),
  createPropertyTx: vi.fn((_client: any, _projectId: string, _name: string, _desc: any, data: any) =>
    Promise.resolve(JSON.stringify({ success: true, property: { id: 'prop-' + JSON.stringify(data).length } }))
  ),
  createClassTx: vi.fn(() =>
    Promise.resolve(JSON.stringify({ success: true, class: { id: 'class-1' } }))
  ),
  addPropertyToClassTx: vi.fn(() =>
    Promise.resolve(JSON.stringify({ success: true, classProperty: { id: 'cp-1' } }))
  ),
  getClassesWithPropertiesAndTagsTx: vi.fn(() =>
    Promise.resolve(
      JSON.stringify([
        {
          name: 'TestClass',
          schema: {},
          properties: [
            { id: 'p1', name: 'id', data: { type: 'string' }, children: [] },
            { id: 'p2', name: 'name', data: { type: 'number' }, children: [] },
          ],
        },
      ])
    )
  ),
  getLatestVersionUuidForProjectTx: vi.fn(() => Promise.resolve(null)),
  listProjectLibraryPropertiesTx: vi.fn(() => Promise.resolve([])),
}));

const mockNormalizeResult = {
  classes: [
    {
      name: 'TestClass',
      description: null,
      schema: { type: 'object' },
      properties: [
        { name: 'id', data: { type: 'string' }, description: null },
        { name: 'count', data: { type: 'number' }, description: null },
      ],
    },
  ],
  warnings: [] as string[],
};

vi.mock('../src/parsers/index', () => ({
  getImporter: vi.fn(() => ({
    kind: 'openapi',
    normalize: () => mockNormalizeResult,
  })),
  ImportSourceKind: { openapi: 'openapi', arazzo: 'arazzo', unknown: 'unknown' },
}));

async function waitForJobEnd(
  getImportStatus: (jobId: string) => Promise<any>,
  jobId: string,
  maxMs = 5000
): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const status = await getImportStatus(jobId);
    if (status.state !== 'queued' && status.state !== 'running') {
      return status;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Job ${jobId} did not finish within ${maxMs}ms`);
}

describe('rollbackCompletedImport (#735)', () => {
  const validInput = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    sourceKind: 'openapi' as const,
    document: { openapi: '3.1.0' },
    project: { name: 'Test', slug: 'test', description: null },
    version: { versionId: '1.0.0', description: null },
    options: { selectedSchemas: [] },
  };

  beforeEach(() => {
    vi.mocked(uiHelper.permanentDeleteProject).mockReset();
    vi.mocked(uiHelper.permanentDeleteProject).mockResolvedValue(JSON.stringify({ success: true }));
    mockClient.query.mockClear();
    mockClient.release.mockClear();
  });

  afterEach(() => {
    vi.resetModules();
  });

  test('returns Job not found for unknown jobId', async () => {
    const { rollbackCompletedImport } = await import('../src/engine/import-helper');

    const result = await rollbackCompletedImport('nonexistent-job-id');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Job not found');
    expect(uiHelper.permanentDeleteProject).not.toHaveBeenCalled();
  });

  test('returns error when job is pending-approval (not completed)', async () => {
    const { startImport, getImportStatus, rollbackCompletedImport } = await import('../src/engine/import-helper');

    const { jobId } = await startImport(validInput);
    const status = await waitForJobEnd(getImportStatus, jobId);
    expect(status.state).toBe('pending-approval');

    const result = await rollbackCompletedImport(jobId);

    expect(result.success).toBe(false);
    expect(result.error).toContain('only allowed when the import has been committed');
    expect(result.error).toContain('pending-approval');
    expect(uiHelper.permanentDeleteProject).not.toHaveBeenCalled();
  });

  test('calls permanentDeleteProject with projectId and sets state to rolled-back when job is completed', async () => {
    const { startImport, getImportStatus, commitImport, rollbackCompletedImport } = await import(
      '../src/engine/import-helper'
    );

    const { jobId } = await startImport(validInput);
    const status = await waitForJobEnd(getImportStatus, jobId);
    expect(status.state).toBe('pending-approval');
    expect(status.result?.projectId).toBe('proj-rollback-test');

    const commitResult = await commitImport(jobId);
    expect(commitResult.success).toBe(true);

    const rollbackResult = await rollbackCompletedImport(jobId);

    expect(rollbackResult.success).toBe(true);
    expect(uiHelper.permanentDeleteProject).toHaveBeenCalledTimes(1);
    expect(uiHelper.permanentDeleteProject).toHaveBeenCalledWith('proj-rollback-test');

    const afterStatus = await getImportStatus(jobId);
    expect(afterStatus.state).toBe('rolled-back');
    expect(afterStatus.result).toBeUndefined();
  });

  test('emits ROLLBACK_STARTED and ROLLED_BACK events on success', async () => {
    const { startImport, getImportStatus, commitImport, rollbackCompletedImport } = await import(
      '../src/engine/import-helper'
    );

    const { jobId } = await startImport(validInput);
    await waitForJobEnd(getImportStatus, jobId);
    await commitImport(jobId);
    await rollbackCompletedImport(jobId);

    const status = await getImportStatus(jobId);
    const codes = status.events.map((e: any) => e.code);
    expect(codes).toContain('ROLLBACK_STARTED');
    expect(codes).toContain('ROLLED_BACK');
  });

  test('returns error when permanentDeleteProject returns success: false', async () => {
    vi.mocked(uiHelper.permanentDeleteProject).mockResolvedValue(
      JSON.stringify({ success: false, error: 'Project in use' })
    );

    const { startImport, getImportStatus, commitImport, rollbackCompletedImport } = await import(
      '../src/engine/import-helper'
    );

    const { jobId } = await startImport(validInput);
    await waitForJobEnd(getImportStatus, jobId);
    await commitImport(jobId);

    const result = await rollbackCompletedImport(jobId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Project in use');
    expect(uiHelper.permanentDeleteProject).toHaveBeenCalledWith('proj-rollback-test');

    const status = await getImportStatus(jobId);
    expect(status.state).toBe('completed');
    const rollbackFailed = status.events?.find((e: any) => e.code === 'ROLLBACK_FAILED');
    expect(rollbackFailed).toBeDefined();
    expect(rollbackFailed?.level).toBe('error');
  });

  test('returns error when permanentDeleteProject throws', async () => {
    vi.mocked(uiHelper.permanentDeleteProject).mockRejectedValue(new Error('Database connection lost'));

    const { startImport, getImportStatus, commitImport, rollbackCompletedImport } = await import(
      '../src/engine/import-helper'
    );

    const { jobId } = await startImport(validInput);
    await waitForJobEnd(getImportStatus, jobId);
    await commitImport(jobId);

    const result = await rollbackCompletedImport(jobId);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Database connection lost');
    expect(uiHelper.permanentDeleteProject).toHaveBeenCalledWith('proj-rollback-test');
  });

  test('handles permanentDeleteProject returning object (not JSON string)', async () => {
    vi.mocked(uiHelper.permanentDeleteProject).mockResolvedValue({ success: true });

    const { startImport, getImportStatus, commitImport, rollbackCompletedImport } = await import(
      '../src/engine/import-helper'
    );

    const { jobId } = await startImport(validInput);
    await waitForJobEnd(getImportStatus, jobId);
    await commitImport(jobId);

    const result = await rollbackCompletedImport(jobId);

    expect(result.success).toBe(true);
    expect(uiHelper.permanentDeleteProject).toHaveBeenCalledWith('proj-rollback-test');
  });
});
