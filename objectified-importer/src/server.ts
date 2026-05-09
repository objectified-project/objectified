import type { ParsedPath, ParsedSecurityScheme } from '../../objectified-ui/src/app/utils/openapi-import';
import type { ImportEngineDeps } from './engine/transactional-client';
export * from './browser';
import { createImporterEngineRequire } from './engine/importer-node-require';
import {
  createImportEngine,
  startImport,
  getImportStatus,
  cancelImport,
  commitImport,
  rollbackImport,
  rollbackCompletedImport,
  retryImport,
} from './engine/import-helper';
import { importOpenAPIPathsAndSecurityWithPool } from './engine/import-openapi-paths-security';
import { PgTransactionalClient } from './engine/pg-client';

export type {
  ImportJobState,
  ImportLogLevel,
  ImportEvent,
  ProgressEvent,
  ImportStatus,
  ImportJobInput,
  ImportEngine,
  ImportEngineDeps,
  RepositoryImportLink,
} from './engine/import-helper';
export { createImportEngine } from './engine/import-helper';
export { PgTransactionalClient } from './engine/pg-client';

const nodeRequire = createImporterEngineRequire();

function uiConnectionPool() {
  return nodeRequire('../../../objectified-ui/lib/db/db');
}

export async function importOpenAPIPathsAndSecurity(
  versionId: string,
  paths: ParsedPath[],
  securitySchemes: ParsedSecurityScheme[]
): Promise<{ success: boolean; error?: string }> {
  return importOpenAPIPathsAndSecurityWithPool(uiConnectionPool(), versionId, paths, securitySchemes);
}

export async function importPathsFromOpenAPIForVersion(
  versionId: string,
  paths: ParsedPath[],
  securitySchemes: ParsedSecurityScheme[]
): Promise<{ success: boolean; error?: string }> {
  if (!versionId) {
    return { success: false, error: 'Version is required' };
  }
  if (!paths?.length && !securitySchemes?.length) {
    return { success: false, error: 'Spec has no paths or security schemes to import' };
  }
  return importOpenAPIPathsAndSecurityWithPool(uiConnectionPool(), versionId, paths || [], securitySchemes || []);
}

export { importOpenAPIPathsAndSecurityWithPool } from './engine/import-openapi-paths-security';

function buildDefaultImportEngineDeps(): ImportEngineDeps {
  return {
    txClient: new PgTransactionalClient(uiConnectionPool()),
    recordRepositoryImport: async link => {
      const { recordTenantRepositoryImport } = nodeRequire('../../../objectified-ui/lib/db/repository-import-metrics');
      await recordTenantRepositoryImport(link);
    },
    permanentDeleteProject: async projectId => {
      const { permanentDeleteProject } = nodeRequire('../../../objectified-ui/lib/db/helper');
      const raw = await permanentDeleteProject(projectId);
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    },
    importOpenApiPathsAndSecurity: (versionId, paths, schemes) =>
      importOpenAPIPathsAndSecurityWithPool(uiConnectionPool(), versionId, paths, schemes),
  };
}

createImportEngine(buildDefaultImportEngineDeps());

export { startImport, getImportStatus, cancelImport, commitImport, rollbackImport, rollbackCompletedImport, retryImport };

export type { PoolClient } from './engine/import-transaction';
export {
  getTransactionClient,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  releaseClient,
  createProjectTx,
  createVersionTx,
  createPropertyTx,
  createClassTx,
  addPropertyToClassTx,
  getClassesWithPropertiesAndTagsTx,
  getLatestVersionUuidForProjectTx,
  listProjectLibraryPropertiesTx,
} from './engine/import-transaction';
