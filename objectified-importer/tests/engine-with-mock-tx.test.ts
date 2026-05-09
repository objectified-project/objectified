/**
 * Engine wiring: TransactionHandle used via injected mock client (#3303).
 *
 * Avoid vi.mock('../src/parsers/index') here — Vitest hoists it and can overwrite
 * other test files' parser mocks in the same worker.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { createImportEngine } from '../src/engine/import-helper';
import { mockTxConnect, buildDefaultMockTransactionHandle } from './import-test-mocks';

/** Minimal OpenAPI document so the real OpenAPI importer yields one class (no parser mock). */
const openapiOneWidget = {
  openapi: '3.1.0',
  info: { title: 'TxEngineTest', version: '1.0.0' },
  paths: {},
  components: {
    schemas: {
      Widget: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
      },
    },
  },
};

async function waitForPendingApproval(
  getImportStatus: (jobId: string) => Promise<{ state: string }>,
  jobId: string,
  maxMs = 5000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const status = await getImportStatus(jobId);
    if (status.state === 'pending-approval') return;
    if (status.state !== 'queued' && status.state !== 'running') {
      throw new Error(`Expected pending-approval, got ${status.state}`);
    }
    await new Promise((r) => setTimeout(r, 30));
  }
  throw new Error(`Job ${jobId} did not reach pending-approval within ${maxMs}ms`);
}

describe('createImportEngine with mock TransactionalClient', () => {
  const input = {
    tenantId: 't1',
    userId: 'u1',
    sourceKind: 'openapi' as const,
    document: openapiOneWidget,
    project: { name: 'P', slug: 'p', description: null },
    version: { versionId: '1.0.0', description: null },
    options: { selectedSchemas: ['Widget'] },
  };

  beforeEach(() => {
    mockTxConnect.mockClear();
    mockTxConnect.mockImplementation(async () => buildDefaultMockTransactionHandle());
    createImportEngine({
      txClient: { connect: () => mockTxConnect() },
      recordRepositoryImport: vi.fn(async () => {}),
      permanentDeleteProject: vi.fn(async () => ({ success: true })),
      importOpenApiPathsAndSecurity: vi.fn(async () => ({ success: true })),
    });
  });

  test('transaction mode reaches pending-approval and calls connect and begin on the handle', async () => {
    const handle = buildDefaultMockTransactionHandle();
    mockTxConnect.mockImplementation(async () => handle);

    const { startImport, getImportStatus } = await import('../src/engine/import-helper');
    const { jobId } = await startImport(input);
    await waitForPendingApproval(getImportStatus, jobId);

    expect(mockTxConnect).toHaveBeenCalled();
    expect(handle.begin).toHaveBeenCalled();
  });

  test('rollbackImport invokes rollback on the open transaction handle', async () => {
    const handle = buildDefaultMockTransactionHandle();
    mockTxConnect.mockImplementation(async () => handle);

    const { startImport, getImportStatus, rollbackImport } = await import('../src/engine/import-helper');
    const { jobId } = await startImport(input);
    await waitForPendingApproval(getImportStatus, jobId);

    await rollbackImport(jobId);

    expect(handle.rollback).toHaveBeenCalled();
    const st = await getImportStatus(jobId);
    expect(st.state).toBe('rolled-back');
  });

  test('commit failure marks job failed and releases the handle', async () => {
    const handle = buildDefaultMockTransactionHandle();
    handle.commit = vi.fn(async () => {
      throw new Error('commit rejected');
    });
    mockTxConnect.mockImplementation(async () => handle);

    const { startImport, getImportStatus, commitImport } = await import('../src/engine/import-helper');
    const { jobId } = await startImport(input);
    await waitForPendingApproval(getImportStatus, jobId);

    const res = await commitImport(jobId);
    expect(res.success).toBe(false);

    const st = await getImportStatus(jobId);
    expect(st.state).toBe('failed');
    expect(handle.release).toHaveBeenCalled();
  });
});
