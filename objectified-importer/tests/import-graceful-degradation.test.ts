/**
 * Import Graceful Degradation Tests (#733)
 */

import { createImportEngine } from '../src/engine/import-helper';
import { mockTxConnect } from './import-test-mocks';

let addPropertyToClassTxCallCount = 0;
let addPropertyToClassTxFailOnCall: number | null = null;
let getClassesWithPropertiesAndTagsTxReturnsMismatch = false;

const mockBeginTransaction = vi.fn();
const mockCommitTransaction = vi.fn();
const mockRollbackTransaction = vi.fn();
const mockReleaseClient = vi.fn();
const mockCreateProjectTx = vi.fn(() =>
  Promise.resolve(JSON.stringify({ success: true, project: { id: 'proj-1' } }))
);
const mockCreateVersionTx = vi.fn(() =>
  Promise.resolve(JSON.stringify({ success: true, version: { id: 'ver-1' } }))
);
const mockCreatePropertyTx = vi.fn((_projectId: string, _name: string, _desc: any, data: any) => {
  const id = 'prop-' + JSON.stringify(data).length;
  return Promise.resolve(JSON.stringify({ success: true, property: { id } }));
});
const mockCreateClassTx = vi.fn(() =>
  Promise.resolve(JSON.stringify({ success: true, class: { id: 'class-1' } }))
);
const mockAddPropertyToClassTx = vi.fn(async () => {
  addPropertyToClassTxCallCount++;
  if (addPropertyToClassTxFailOnCall !== null && addPropertyToClassTxCallCount === addPropertyToClassTxFailOnCall) {
    return Promise.resolve(JSON.stringify({ success: false, error: 'Constraint violation (simulated)' }));
  }
  return Promise.resolve(
    JSON.stringify({ success: true, classProperty: { id: 'cp-' + addPropertyToClassTxCallCount } })
  );
});
const mockGetClassesWithPropertiesAndTagsTx = vi.fn(async () => {
  if (getClassesWithPropertiesAndTagsTxReturnsMismatch) {
    return Promise.resolve(JSON.stringify([]));
  }
  return Promise.resolve(
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
  );
});
const mockGetLatestVersionUuidForProjectTx = vi.fn(() => Promise.resolve(null));
const mockListProjectLibraryPropertiesTx = vi.fn(() => Promise.resolve([]));

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

describe('Import Graceful Degradation (#733)', () => {
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
    addPropertyToClassTxCallCount = 0;
    addPropertyToClassTxFailOnCall = null;
    getClassesWithPropertiesAndTagsTxReturnsMismatch = false;
    mockTxConnect.mockReset();

    mockBeginTransaction.mockResolvedValue(undefined);
    mockCommitTransaction.mockResolvedValue(undefined);
    mockRollbackTransaction.mockResolvedValue(undefined);
    mockReleaseClient.mockResolvedValue(undefined);

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

  test('when addPropertyToClassTx fails for one property: emits PROPERTY_LINK_FAILED warn and reaches pending-approval', async () => {
    addPropertyToClassTxFailOnCall = 2;

    const { startImport, getImportStatus } = await import('../src/engine/import-helper');
    const { jobId } = await startImport(validInput);

    const status = await waitForJobEnd(getImportStatus, jobId);

    expect(status.state).toBe('pending-approval');
    const propertyLinkFailed = status.events?.find(
      (e: any) => e.code === 'PROPERTY_LINK_FAILED' && e.level === 'warn'
    );
    expect(propertyLinkFailed).toBeDefined();
    expect(propertyLinkFailed?.message).toContain('Could not add property');
    expect(status.summary?.warnings).toBeGreaterThanOrEqual(1);
    expect(status.summary?.classesCreated).toBe(1);
  });

  test('when verification fails (mismatches): does not throw, emits VERIFY_MISMATCHES warn and reaches pending-approval', async () => {
    getClassesWithPropertiesAndTagsTxReturnsMismatch = true;

    const { startImport, getImportStatus } = await import('../src/engine/import-helper');
    const { jobId } = await startImport(validInput);

    const status = await waitForJobEnd(getImportStatus, jobId);

    expect(status.state).toBe('pending-approval');
    const verifyMismatches = status.events?.filter((e: any) => e.code === 'VERIFY_MISMATCHES');
    expect(verifyMismatches?.length).toBeGreaterThanOrEqual(1);
    expect(verifyMismatches?.some((e: any) => e.level === 'warn')).toBe(true);
    expect(status.summary?.verification?.passed).toBe(false);
    expect(status.summary?.verification?.mismatches?.length).toBeGreaterThan(0);
    expect(status.result?.projectId).toBe('proj-1');
    expect(status.result?.versionId).toBe('ver-1');
  });

  test('when no non-critical errors: reaches pending-approval and completes without critical failure', async () => {
    const { startImport, getImportStatus } = await import('../src/engine/import-helper');
    const { jobId } = await startImport(validInput);

    const status = await waitForJobEnd(getImportStatus, jobId);

    expect(status.state).toBe('pending-approval');
    expect(status.events?.some((e: any) => e.code === 'PROPERTY_LINK_FAILED')).toBe(false);
    expect(status.summary?.classesCreated).toBe(1);
    expect(status.result?.projectId).toBeDefined();
    expect(status.result?.versionId).toBeDefined();
  });

  test('critical error (missing tenantId) throws and does not start job', async () => {
    const { startImport } = await import('../src/engine/import-helper');

    await expect(startImport({ ...validInput, tenantId: '' })).rejects.toThrow('Tenant ID is required');
  });
});
