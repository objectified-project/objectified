/**
 * Import Incremental Mode Tests (#730)
 */

import { createImportEngine } from '../src/engine/import-helper';
import { mockTxConnect } from './import-test-mocks';

const mockBeginTransaction = vi.fn();
const mockCommitTransaction = vi.fn();
const mockRollbackTransaction = vi.fn();
const mockReleaseClient = vi.fn();
const mockCreateProjectTx = vi.fn();
const mockCreateVersionTx = vi.fn();
const mockCreatePropertyTx = vi.fn();
const mockCreateClassTx = vi.fn();
const mockAddPropertyToClassTx = vi.fn();
const mockGetClassesWithPropertiesAndTagsTx = vi.fn();
const mockGetLatestVersionUuidForProjectTx = vi.fn(() => Promise.resolve(null));
const mockListProjectLibraryPropertiesTx = vi.fn(() => Promise.resolve([]));

let createClassTxFailForClassName: string | null = null;

const mockNormalizeResult = {
  classes: [
    {
      name: 'User',
      description: null,
      schema: { type: 'object' },
      properties: [
        { name: 'id', data: { type: 'string' }, description: null },
        { name: 'email', data: { type: 'string' }, description: null },
      ],
    },
    {
      name: 'Product',
      description: null,
      schema: { type: 'object' },
      properties: [
        { name: 'id', data: { type: 'string' }, description: null },
        { name: 'name', data: { type: 'string' }, description: null },
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
    await new Promise((r) => setTimeout(r, 30));
  }
  throw new Error(`Job ${jobId} did not finish within ${maxMs}ms`);
}

describe('Import Incremental Mode (#730)', () => {
  const incrementalInput = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    sourceKind: 'openapi' as const,
    document: { openapi: '3.1.0', info: { title: 'Test API', version: '1.0.0' } },
    project: { name: 'Incremental Project', slug: 'incremental-project', description: null },
    version: { versionId: '1.0.0', description: null },
    options: { selectedSchemas: ['User', 'Product'], dryRun: false, incrementalMode: true },
  };

  const transactionModeInput = {
    ...incrementalInput,
    options: { selectedSchemas: ['User', 'Product'], dryRun: false, incrementalMode: false },
  };

  beforeEach(() => {
    createClassTxFailForClassName = null;
    mockBeginTransaction.mockReset();
    mockCommitTransaction.mockReset();
    mockRollbackTransaction.mockReset();
    mockReleaseClient.mockReset();
    mockCreateProjectTx.mockReset();
    mockCreateVersionTx.mockReset();
    mockCreatePropertyTx.mockReset();
    mockCreateClassTx.mockReset();
    mockAddPropertyToClassTx.mockReset();
    mockGetClassesWithPropertiesAndTagsTx.mockReset();
    mockGetLatestVersionUuidForProjectTx.mockReset();
    mockListProjectLibraryPropertiesTx.mockReset();
    mockTxConnect.mockReset();

    mockBeginTransaction.mockResolvedValue(undefined);
    mockCommitTransaction.mockResolvedValue(undefined);
    mockRollbackTransaction.mockResolvedValue(undefined);
    mockReleaseClient.mockResolvedValue(undefined);
    mockCreateProjectTx.mockResolvedValue(
      JSON.stringify({ success: true, project: { id: 'proj-incremental' } })
    );
    mockCreateVersionTx.mockResolvedValue(
      JSON.stringify({ success: true, version: { id: 'ver-incremental' } })
    );
    mockCreatePropertyTx.mockImplementation((_pid: string, name: string, _desc: any, data: any) =>
      Promise.resolve(
        JSON.stringify({ success: true, property: { id: `prop-${name}-${JSON.stringify(data).length}` } })
      )
    );
    mockCreateClassTx.mockImplementation((_vid: string, name: string) => {
      if (createClassTxFailForClassName !== null && name === createClassTxFailForClassName) {
        return Promise.resolve(JSON.stringify({ success: false, error: 'Duplicate class (simulated)' }));
      }
      return Promise.resolve(JSON.stringify({ success: true, class: { id: `class-${name}` } }));
    });
    mockAddPropertyToClassTx.mockResolvedValue(
      JSON.stringify({ success: true, classProperty: { id: 'cp-1' } })
    );
    mockGetClassesWithPropertiesAndTagsTx.mockResolvedValue(
      JSON.stringify([
        { name: 'User', schema: {}, properties: [] },
        { name: 'Product', schema: {}, properties: [] },
      ])
    );
    mockGetLatestVersionUuidForProjectTx.mockResolvedValue(null);
    mockListProjectLibraryPropertiesTx.mockResolvedValue([]);

    mockTxConnect.mockImplementation(async () => ({
      begin: mockBeginTransaction,
      commit: mockCommitTransaction,
      rollback: mockRollbackTransaction,
      release: mockReleaseClient,
      createProjectTx: mockCreateProjectTx,
      createVersionTx: mockCreateVersionTx,
      createPropertyTx: mockCreatePropertyTx,
      createClassTx: mockCreateClassTx,
      addPropertyToClassTx: mockAddPropertyToClassTx,
      getClassesWithPropertiesAndTagsTx: mockGetClassesWithPropertiesAndTagsTx,
      getLatestVersionUuidForProjectTx: mockGetLatestVersionUuidForProjectTx,
      listProjectLibraryPropertiesTx: mockListProjectLibraryPropertiesTx,
    }));

    createImportEngine({
      txClient: { connect: () => mockTxConnect() },
      recordRepositoryImport: vi.fn(async () => {}),
      permanentDeleteProject: vi.fn(async () => ({ success: true })),
      importOpenApiPathsAndSecurity: vi.fn(async () => ({ success: true })),
    });
  });

  test('incremental mode completes with state completed and summary.incrementalMode true', async () => {
    const { startImport, getImportStatus } = await import('../src/engine/import-helper');
    const { jobId } = await startImport(incrementalInput);

    const status = await waitForJobEnd(getImportStatus, jobId);

    expect(status.state).toBe('completed');
    expect(status.summary).toBeDefined();
    expect(status.summary.incrementalMode).toBe(true);
  });

  test('incremental mode sets result with projectId and versionId', async () => {
    const { startImport, getImportStatus } = await import('../src/engine/import-helper');
    const { jobId } = await startImport(incrementalInput);

    const status = await waitForJobEnd(getImportStatus, jobId);

    expect(status.result).toBeDefined();
    expect(status.result.projectId).toBe('proj-incremental');
    expect(status.result.versionId).toBe('ver-incremental');
  });

  test('incremental mode does not set transactionPending (no pending-approval)', async () => {
    const { startImport, getImportStatus } = await import('../src/engine/import-helper');
    const { jobId } = await startImport(incrementalInput);

    const status = await waitForJobEnd(getImportStatus, jobId);

    expect(status.state).toBe('completed');
    expect((status as any).transactionPending).toBeFalsy();
  });

  test('incremental mode emits INCREMENTAL_MODE and INCREMENTAL_COMPLETE events', async () => {
    const { startImport, getImportStatus } = await import('../src/engine/import-helper');
    const { jobId } = await startImport(incrementalInput);

    const status = await waitForJobEnd(getImportStatus, jobId);

    const incrementalModeEvent = status.events?.find((e: any) => e.code === 'INCREMENTAL_MODE');
    const completeEvent = status.events?.find((e: any) => e.code === 'INCREMENTAL_COMPLETE');

    expect(incrementalModeEvent).toBeDefined();
    expect(incrementalModeEvent?.level).toBe('info');
    expect(incrementalModeEvent?.message).toMatch(/incremental|skip/i);
    expect(completeEvent).toBeDefined();
    expect(completeEvent?.message).toMatch(/complete|skipped/i);
  });

  test('incremental mode connects once and releases', async () => {
    const { startImport, getImportStatus } = await import('../src/engine/import-helper');
    const { jobId } = await startImport(incrementalInput);

    await waitForJobEnd(getImportStatus, jobId);

    expect(mockTxConnect).toHaveBeenCalled();
    expect(mockReleaseClient).toHaveBeenCalled();
  });

  test('incremental mode uses per-class transaction (begin/commit per class)', async () => {
    const { startImport, getImportStatus } = await import('../src/engine/import-helper');
    const { jobId } = await startImport(incrementalInput);

    await waitForJobEnd(getImportStatus, jobId);

    expect(mockBeginTransaction).toHaveBeenCalled();
    expect(mockCommitTransaction).toHaveBeenCalled();
    expect(mockBeginTransaction.mock.calls.length).toBe(2);
    expect(mockCommitTransaction.mock.calls.length).toBe(2);
  });

  test('incremental mode summary has classesCreated and totalTime', async () => {
    const { startImport, getImportStatus } = await import('../src/engine/import-helper');
    const { jobId } = await startImport(incrementalInput);

    const status = await waitForJobEnd(getImportStatus, jobId);

    expect(status.summary?.classesCreated).toBe(2);
    expect(status.summary?.classes?.length).toBe(2);
    expect(status.summary?.totalTime).toBeDefined();
    expect(typeof status.summary?.totalTime).toBe('number');
  });

  test('when one class fails in incremental mode: job still completes, failed class skipped', async () => {
    createClassTxFailForClassName = 'Product';

    const { startImport, getImportStatus } = await import('../src/engine/import-helper');
    const { jobId } = await startImport(incrementalInput);

    const status = await waitForJobEnd(getImportStatus, jobId);

    expect(status.state).toBe('completed');
    expect(status.summary?.incrementalMode).toBe(true);
    expect(status.summary?.classesCreated).toBe(1);
    expect(status.summary?.failed).toBe(1);
    const successClass = status.summary?.classes?.find((c: any) => c.status === 'success');
    const failedClass = status.summary?.classes?.find((c: any) => c.status === 'failed');
    expect(successClass?.name).toBe('User');
    expect(failedClass?.name).toBe('Product');
  });

  test('when one class fails in incremental mode: rollback called for that class only', async () => {
    createClassTxFailForClassName = 'Product';

    const { startImport, getImportStatus } = await import('../src/engine/import-helper');
    const { jobId } = await startImport(incrementalInput);

    await waitForJobEnd(getImportStatus, jobId);

    expect(mockRollbackTransaction).toHaveBeenCalled();
    expect(mockCommitTransaction.mock.calls.length).toBe(1);
  });

  test('when one class fails in incremental mode: CLASS_FAILED event emitted', async () => {
    createClassTxFailForClassName = 'Product';

    const { startImport, getImportStatus } = await import('../src/engine/import-helper');
    const { jobId } = await startImport(incrementalInput);

    const status = await waitForJobEnd(getImportStatus, jobId);

    const classFailedEvent = status.events?.find(
      (e: any) => e.code === 'CLASS_FAILED' && e.message?.includes('Product')
    );
    expect(classFailedEvent).toBeDefined();
    expect(classFailedEvent?.level).toBe('error');
  });

  test('ImportJobInput allows incrementalMode in options', () => {
    const input = {
      tenantId: 't',
      userId: 'u',
      sourceKind: 'openapi' as any,
      document: {},
      project: { name: 'P', slug: 'p' },
      version: { versionId: '1.0.0' },
      options: { selectedSchemas: [], dryRun: false, incrementalMode: true },
    };
    expect(input.options.incrementalMode).toBe(true);
  });

  test('incrementalMode false (transaction mode) reaches pending-approval', async () => {
    const { startImport, getImportStatus } = await import('../src/engine/import-helper');
    const { jobId } = await startImport(transactionModeInput);

    const status = await waitForJobEnd(getImportStatus, jobId);

    expect(status.state).toBe('pending-approval');
    expect((status as any).transactionPending).toBe(true);
    expect(status.summary?.incrementalMode).toBeFalsy();
  });

  test('incremental mode with dry run true still does dry run (no incremental DB path)', async () => {
    const dryRunIncrementalInput = {
      ...incrementalInput,
      options: { ...incrementalInput.options, dryRun: true },
    };

    const { startImport, getImportStatus } = await import('../src/engine/import-helper');
    const { jobId } = await startImport(dryRunIncrementalInput);

    const status = await waitForJobEnd(getImportStatus, jobId);

    expect(status.state).toBe('completed');
    expect(status.summary?.dryRun).toBe(true);
    expect(mockTxConnect).not.toHaveBeenCalled();
    expect(status.summary?.incrementalMode).toBeFalsy();
  });

  test('incremental mode with existingProjectId reuses property library shapes and sets version parent', async () => {
    mockGetLatestVersionUuidForProjectTx.mockResolvedValue('previous-version-uuid');
    mockListProjectLibraryPropertiesTx.mockResolvedValue([
      { id: 'existing-prop-1', name: 'id', description: null, data: { type: 'string' } },
    ]);

    const inputWithExisting = {
      ...incrementalInput,
      existingProjectId: 'already-created-project',
    };

    const { startImport, getImportStatus } = await import('../src/engine/import-helper');
    const { jobId } = await startImport(inputWithExisting);

    await waitForJobEnd(getImportStatus, jobId);

    expect(mockCreateProjectTx).not.toHaveBeenCalled();
    expect(mockGetLatestVersionUuidForProjectTx).toHaveBeenCalledWith('already-created-project');
    expect(mockListProjectLibraryPropertiesTx).toHaveBeenCalledWith('already-created-project');

    expect(mockCreatePropertyTx).not.toHaveBeenCalled();

    const versionCalls = mockCreateVersionTx.mock.calls;
    expect(versionCalls.length).toBeGreaterThanOrEqual(1);
    const lastCall = versionCalls[versionCalls.length - 1];
    expect(lastCall[5]).toEqual({ parentVersionUuid: 'previous-version-uuid' });
  });
});
