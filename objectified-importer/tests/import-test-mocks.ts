import { vi } from 'vitest';
import type { TransactionHandle } from '../src/engine/transactional-client';

/** Spied by tests that assert no DB connection (e.g. dry run). */
export const mockTxConnect = vi.fn();

export function buildDefaultMockTransactionHandle(): TransactionHandle {
  return {
    begin: vi.fn(async () => {}),
    commit: vi.fn(async () => {}),
    rollback: vi.fn(async () => {}),
    release: vi.fn(async () => {}),
    createProjectTx: vi.fn(async () =>
      JSON.stringify({ success: true, project: { id: 'mock-project-id' } })
    ),
    createVersionTx: vi.fn(async () =>
      JSON.stringify({ success: true, version: { id: 'mock-version-id' } })
    ),
    getLatestVersionUuidForProjectTx: vi.fn(async () => null),
    listProjectLibraryPropertiesTx: vi.fn(async () => []),
    createPropertyTx: vi.fn(async () =>
      JSON.stringify({ success: true, property: { id: 'mock-prop-id' } })
    ),
    createClassTx: vi.fn(async () =>
      JSON.stringify({ success: true, class: { id: 'mock-class-id' } })
    ),
    addPropertyToClassTx: vi.fn(async () =>
      JSON.stringify({ success: true, classProperty: { id: 'mock-cp-id' } })
    ),
    getClassesWithPropertiesAndTagsTx: vi.fn(async () => JSON.stringify([])),
  };
}

mockTxConnect.mockImplementation(async () => buildDefaultMockTransactionHandle());
