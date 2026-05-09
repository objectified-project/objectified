import type { ParsedPath, ParsedSecurityScheme } from '../../../objectified-ui/src/app/utils/openapi-import';

/** Payload for optional repository-import linkage after a successful import (UI records metrics). */
export type RepositoryImportLink = {
  tenantId: string;
  repositorySource: {
    repositoryId: string;
    branch: string;
    path: string;
    blobSha?: string | null;
  };
  projectId: string;
  versionUuid: string;
  importedByUserId: string;
};

/**
 * Active pooled connection used by the import engine. Supports multiple BEGIN/COMMIT cycles (incremental mode).
 */
export interface TransactionHandle {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): Promise<void>;

  createProjectTx(
    tenantId: string,
    creatorId: string,
    name: string,
    description: string,
    slug: string,
    metadata?: unknown
  ): Promise<string>;

  createVersionTx(
    projectId: string,
    creatorId: string,
    versionId: string,
    description: string,
    changeLog: string,
    opts?: { parentVersionUuid?: string | null }
  ): Promise<string>;

  getLatestVersionUuidForProjectTx(projectId: string): Promise<string | null>;

  listProjectLibraryPropertiesTx(
    projectId: string
  ): Promise<Array<{ id: string; name: string; description: string | null; data: unknown }>>;

  createPropertyTx(
    projectId: string,
    name: string,
    description: string | null,
    data: unknown
  ): Promise<string>;

  createClassTx(versionId: string, name: string, description: string | null, schema: unknown): Promise<string>;

  addPropertyToClassTx(
    classId: string,
    propertyId: string | null,
    name: string,
    description: string | null,
    data: unknown,
    parentId?: string | null
  ): Promise<string>;

  getClassesWithPropertiesAndTagsTx(versionId: string): Promise<string>;
}

export interface TransactionalClient {
  connect(): Promise<TransactionHandle>;
}

export type ImportOpenApiPathsFn = (
  versionId: string,
  paths: ParsedPath[],
  securitySchemes: ParsedSecurityScheme[]
) => Promise<{ success: boolean; error?: string }>;

export interface ImportEngineDeps {
  txClient: TransactionalClient;
  recordRepositoryImport?: (input: RepositoryImportLink) => Promise<void>;
  permanentDeleteProject?: (projectId: string) => Promise<{ success: boolean; error?: string }>;
  /** OpenAPI paths/security import (standalone transaction). Omit or no-op in tests. */
  importOpenApiPathsAndSecurity?: ImportOpenApiPathsFn;
}
