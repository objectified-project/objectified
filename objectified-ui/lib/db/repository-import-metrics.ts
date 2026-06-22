'use server';

import type { Pool } from 'pg';

// db.ts is CommonJS (module.exports); keep parity with helper-database.ts.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS pool singleton
const connectionPool = require('./db') as Pool;

export type RepositoryImportSourceInput = {
  repositoryId: string;
  branch: string;
  path: string;
  blobSha?: string | null;
};

/** Insert when the repository belongs to the tenant (guarded by subquery). */
export async function recordTenantRepositoryImport(params: {
  tenantId: string;
  repositorySource: RepositoryImportSourceInput;
  projectId: string;
  versionUuid: string;
  importedByUserId: string;
}): Promise<boolean> {
  const { tenantId, repositorySource, projectId, versionUuid, importedByUserId } = params;
  const repoId = repositorySource.repositoryId.trim();
  if (!repoId) return false;

  const res = await connectionPool.query(
    `INSERT INTO odb.tenant_repository_imports (
       tenant_id, repository_id, branch, path, blob_sha, project_id, version_id, imported_by
     )
     SELECT $1::uuid, $2::uuid, $3, $4, $5, $6::uuid, $7::uuid, $8::uuid
     FROM odb.tenant_repositories tr
     WHERE tr.id = $2::uuid AND tr.tenant_id = $1::uuid AND tr.deleted_at IS NULL
     RETURNING id`,
    [
      tenantId,
      repoId,
      repositorySource.branch,
      repositorySource.path,
      repositorySource.blobSha?.trim() || null,
      projectId,
      versionUuid,
      importedByUserId,
    ]
  );
  return res.rowCount === 1;
}

/**
 * Persist (insert or refresh) the import specification for a repository file so a
 * later auto-refresh can replay the user's original request instead of importer
 * defaults (RAR-1.2). Keyed on the imported-file lineage
 * `(repository_id, branch, path)`: a repeat import of the same file updates the
 * existing row in place rather than inserting a duplicate.
 *
 * The insert is guarded by a subquery so a row is written only when the
 * repository belongs to the given tenant. `options` is the full SpecImportOptions
 * payload and is stored verbatim in `options_json`.
 *
 * @returns true when a row was written (repository belonged to the tenant), false otherwise.
 */
export async function upsertRepositoryImportSpec(params: {
  tenantId: string;
  repositorySource: RepositoryImportSourceInput;
  projectId: string;
  sourceKind: string;
  options: Record<string, unknown>;
  formatOverride?: string | null;
  contentType?: string | null;
  specSchemaVersion?: number;
  createdByUserId?: string | null;
}): Promise<boolean> {
  const {
    tenantId,
    repositorySource,
    projectId,
    sourceKind,
    options,
    formatOverride,
    contentType,
    specSchemaVersion,
    createdByUserId,
  } = params;
  const repoId = repositorySource.repositoryId.trim();
  if (!repoId) return false;

  const res = await connectionPool.query(
    `INSERT INTO odb.repository_import_spec (
       tenant_id, repository_id, branch, path, project_id,
       source_kind, format_override, content_type,
       options_json, spec_schema_version, created_by
     )
     SELECT $1::uuid, $2::uuid, $3, $4, $5::uuid,
            $6, $7, $8,
            $9::jsonb, $10, $11::uuid
     FROM odb.tenant_repositories tr
     WHERE tr.id = $2::uuid AND tr.tenant_id = $1::uuid AND tr.deleted_at IS NULL
     ON CONFLICT ON CONSTRAINT uq_repository_import_spec_repo_branch_path
     DO UPDATE SET
       tenant_id = EXCLUDED.tenant_id,
       project_id = EXCLUDED.project_id,
       source_kind = EXCLUDED.source_kind,
       format_override = EXCLUDED.format_override,
       content_type = EXCLUDED.content_type,
       options_json = EXCLUDED.options_json,
       spec_schema_version = EXCLUDED.spec_schema_version,
       created_by = EXCLUDED.created_by,
       updated_at = CURRENT_TIMESTAMP
     RETURNING id`,
    [
      tenantId,
      repoId,
      repositorySource.branch,
      repositorySource.path,
      projectId,
      sourceKind,
      formatOverride ?? null,
      contentType ?? null,
      JSON.stringify(options ?? {}),
      specSchemaVersion ?? 1,
      createdByUserId ?? null,
    ]
  );
  return res.rowCount === 1;
}

export type TenantRepositoryImportRow = {
  id: string;
  path: string;
  branch: string;
  blob_sha: string | null;
  created_at: string;
  project_id: string;
  project_name: string;
  project_slug: string;
  catalog_version_label: string;
  version_uuid: string;
  imported_by: string | null;
  imported_by_name: string | null;
  imported_by_email: string | null;
};

export async function tenantRepositoryBelongsToTenant(tenantId: string, repositoryId: string): Promise<boolean> {
  const r = await connectionPool.query(
    `SELECT 1 FROM odb.tenant_repositories tr
     WHERE tr.id = $1::uuid AND tr.tenant_id = $2::uuid AND tr.deleted_at IS NULL
     LIMIT 1`,
    [repositoryId, tenantId]
  );
  return r.rowCount === 1;
}

export async function listTenantRepositoryImports(params: {
  tenantId: string;
  repositoryId: string;
  limit?: number;
}): Promise<TenantRepositoryImportRow[]> {
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 200);
  const result = await connectionPool.query(
    `SELECT tri.id,
            tri.path,
            tri.branch,
            tri.blob_sha,
            tri.created_at::text AS created_at,
            tri.project_id,
            p.name AS project_name,
            p.slug AS project_slug,
            v.version_id AS catalog_version_label,
            v.id AS version_uuid,
            tri.imported_by,
            u.name AS imported_by_name,
            u.email AS imported_by_email
     FROM odb.tenant_repository_imports tri
     JOIN odb.projects p ON p.id = tri.project_id AND p.deleted_at IS NULL
     JOIN odb.versions v ON v.id = tri.version_id AND v.deleted_at IS NULL
     LEFT JOIN odb.users u ON u.id = tri.imported_by
     WHERE tri.tenant_id = $1::uuid AND tri.repository_id = $2::uuid
     ORDER BY tri.created_at DESC
     LIMIT $3`,
    [params.tenantId, params.repositoryId, limit]
  );
  return result.rows as TenantRepositoryImportRow[];
}

export async function tenantRepositoryImportStats30d(
  tenantId: string,
  repositoryId: string
): Promise<{ totalImports: number; distinctProjects: number }> {
  const result = await connectionPool.query(
    `SELECT COUNT(*)::int AS total_imports,
            COUNT(DISTINCT project_id)::int AS distinct_projects
     FROM odb.tenant_repository_imports
     WHERE tenant_id = $1::uuid
       AND repository_id = $2::uuid
       AND created_at >= NOW() - INTERVAL '30 days'`,
    [tenantId, repositoryId]
  );
  const row = result.rows[0] as { total_imports: number; distinct_projects: number } | undefined;
  return {
    totalImports: row?.total_imports ?? 0,
    distinctProjects: row?.distinct_projects ?? 0,
  };
}
