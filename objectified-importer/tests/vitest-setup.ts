import { vi } from 'vitest';

/** Avoid loading real plan-entitlements → `./db` under Vitest (no ts-jest require hook). */
vi.mock('../../objectified-ui/lib/db/plan-entitlements', () => ({
  getPlanBlockMessageForNewProject: vi.fn(async () => null),
  getPlanBlockMessageForNewVersion: vi.fn(async () => null),
}));

vi.mock('../../objectified-ui/lib/db/repository-import-metrics', () => ({
  recordTenantRepositoryImport: vi.fn(async () => true),
}));

/** import-helper only needs `permanentDeleteProject` from helper; loading real helper pulls auth → `./db`. */
vi.mock('../../objectified-ui/lib/db/helper', () => ({
  permanentDeleteProject: vi.fn(async () => JSON.stringify({ success: true })),
  createProject: vi.fn(),
  createVersion: vi.fn(),
  createClass: vi.fn(),
  createProperty: vi.fn(),
  addPropertyToClass: vi.fn(),
}));

vi.mock('../src/engine/import-openapi-paths-security', () => ({
  importOpenAPIPathsAndSecurity: vi.fn(async () => ({ success: true })),
  importPathsFromOpenAPIForVersion: vi.fn(async () => ({ success: true })),
}));
