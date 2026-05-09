/**
 * Postgres-backed {@link TransactionalClient} for the import engine.
 */

import type { Pool, PoolClient } from 'pg';
import type { TransactionHandle, TransactionalClient } from './transactional-client';

/**
 * Optional plan/entitlement check callbacks injected into {@link PgTransactionalClient}.
 * Keeping these out of the constructor's required args avoids importing UI DB modules here.
 */
export type PgClientPlanChecks = {
  /**
   * Returns a block-error message when the user cannot create a new project, or null if allowed.
   * @param userId - The ID of the user creating the project.
   * @param client - The active Postgres queryable (pool or transaction client).
   */
  checkPlanForNewProject?: (userId: string, client: PgQueryable) => Promise<string | null>;
  /**
   * Returns a block-error message when the user cannot create a new version, or null if allowed.
   * @param userId - The ID of the user creating the version.
   * @param client - The active Postgres queryable (pool or transaction client).
   */
  checkPlanForNewVersion?: (userId: string, client: PgQueryable) => Promise<string | null>;
};

export type PgQueryable = Pick<PoolClient, 'query' | 'release'>;

const errorResponse = (error: string) => JSON.stringify({ success: false, error });
const successResponse = (data: Record<string, unknown> = {}) => JSON.stringify({ success: true, ...data });

function validateSlug(slug: string): string | null {
  if (!slug) return 'Slug is required';
  if (slug.length < 2) return 'Slug must be at least 2 characters';
  if (slug.length > 100) return 'Slug must be 100 characters or less';
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(slug)) {
    return 'Slug must start and end with a letter or number, and contain only lowercase letters, numbers, and hyphens';
  }
  if (/--/.test(slug)) return 'Slug cannot contain consecutive hyphens';
  return null;
}

export async function beginTransaction(client: PgQueryable): Promise<void> {
  await client.query('BEGIN');
}

export async function commitTransaction(client: PgQueryable): Promise<void> {
  await client.query('COMMIT');
}

export async function rollbackTransaction(client: PgQueryable): Promise<void> {
  await client.query('ROLLBACK');
}

export async function releaseClient(client: PgQueryable): Promise<void> {
  client.release();
}

async function createProjectTxImpl(
  client: PgQueryable,
  tenantId: string,
  creatorId: string,
  name: string,
  description: string,
  slug: string,
  metadata?: unknown,
  planChecks?: PgClientPlanChecks
): Promise<string> {
  try {
    if (!name?.trim()) return errorResponse('Project name is required');
    if (!slug?.trim()) return errorResponse('Project slug is required');
    const slugError = validateSlug(slug.trim());
    if (slugError) return errorResponse(slugError);

    if (planChecks?.checkPlanForNewProject) {
      const planErr = await planChecks.checkPlanForNewProject(creatorId, client);
      if (planErr) return errorResponse(planErr);
    }

    const result = await client.query(
      `INSERT INTO odb.projects (tenant_id, creator_id, name, description, slug, metadata) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        tenantId,
        creatorId,
        name.trim(),
        description?.trim() || null,
        slug.trim().toLowerCase(),
        metadata ? JSON.stringify(metadata) : '{}',
      ]
    );
    return successResponse({ project: result.rows[0] });
  } catch (error: unknown) {
    const err = error as { code?: string; constraint?: string; detail?: string; message?: string };
    if (err.code === '23505') return errorResponse('A project with this slug already exists in this tenant');
    if (err.code === '23503') {
      if (err.constraint === 'projects_tenant_id_fkey') {
        return errorResponse('Invalid tenant ID. The tenant may no longer exist or you may need to switch to a valid tenant.');
      }
      if (err.constraint === 'projects_creator_id_fkey') {
        return errorResponse('Invalid user ID. Please try logging out and back in.');
      }
      return errorResponse(`Database constraint error: ${err.detail || err.message}`);
    }
    return errorResponse(err.message || String(error));
  }
}

export async function createProjectTx(
  client: PgQueryable,
  tenantId: string,
  creatorId: string,
  name: string,
  description: string,
  slug: string,
  metadata?: unknown
): Promise<string> {
  return createProjectTxImpl(client, tenantId, creatorId, name, description, slug, metadata);
}

async function createVersionTxImpl(
  client: PgQueryable,
  projectId: string,
  creatorId: string,
  versionId: string,
  description: string,
  changeLog: string,
  opts?: { parentVersionUuid?: string | null },
  planChecks?: PgClientPlanChecks
): Promise<string> {
  try {
    if (!versionId?.trim()) return errorResponse('Version ID is required');

    if (planChecks?.checkPlanForNewVersion) {
      const planErr = await planChecks.checkPlanForNewVersion(creatorId, client);
      if (planErr) return errorResponse(planErr);
    }

    const parentUuid = opts?.parentVersionUuid?.trim() || null;
    const result = parentUuid
      ? await client.query(
          `INSERT INTO odb.versions (project_id, creator_id, version_id, description, change_log, parent_version_id) 
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [
            projectId,
            creatorId,
            versionId.trim(),
            description?.trim() || null,
            changeLog?.trim() || null,
            parentUuid,
          ]
        )
      : await client.query(
          `INSERT INTO odb.versions (project_id, creator_id, version_id, description, change_log) 
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [projectId, creatorId, versionId.trim(), description?.trim() || null, changeLog?.trim() || null]
        );
    return successResponse({ version: result.rows[0] });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === '23505') return errorResponse('A version with this ID already exists in this project');
    return errorResponse(err.message || String(error));
  }
}

export async function createVersionTx(
  client: PgQueryable,
  projectId: string,
  creatorId: string,
  versionId: string,
  description: string,
  changeLog: string,
  opts?: { parentVersionUuid?: string | null }
): Promise<string> {
  return createVersionTxImpl(client, projectId, creatorId, versionId, description, changeLog, opts);
}

async function queryLatestVersionUuidForProject(client: PgQueryable, projectId: string): Promise<string | null> {
  const result = await client.query(
    `SELECT id FROM odb.versions
     WHERE project_id = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC NULLS LAST, id DESC
     LIMIT 1`,
    [projectId]
  );
  const row = result.rows[0];
  return row?.id ? (row.id as string) : null;
}

export async function getLatestVersionUuidForProjectTx(
  client: PgQueryable,
  projectId: string
): Promise<string | null> {
  return queryLatestVersionUuidForProject(client, projectId);
}

async function queryListProjectLibraryProperties(
  client: PgQueryable,
  projectId: string
): Promise<Array<{ id: string; name: string; description: string | null; data: unknown }>> {
  const result = await client.query(
    `SELECT id, name, description, data
     FROM odb.properties
     WHERE project_id = $1 AND deleted_at IS NULL`,
    [projectId]
  );
  return result.rows as Array<{ id: string; name: string; description: string | null; data: unknown }>;
}

export async function listProjectLibraryPropertiesTx(
  client: PgQueryable,
  projectId: string
): Promise<Array<{ id: string; name: string; description: string | null; data: unknown }>> {
  return queryListProjectLibraryProperties(client, projectId);
}

async function createPropertyTxImpl(
  client: PgQueryable,
  projectId: string,
  name: string,
  description: string | null,
  data: unknown
): Promise<string> {
  try {
    if (!name || name.trim().length === 0) {
      return errorResponse('Property name is required');
    }

    if (!data) {
      return errorResponse('Property data is required');
    }

    const result = await client.query(
      `INSERT INTO odb.properties (project_id, name, description, data)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [projectId, name.trim(), description, JSON.stringify(data)]
    );

    return successResponse({ property: result.rows[0] });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === '23505') {
      return errorResponse('A property with this name already exists in this project');
    }
    return errorResponse(err.message || String(error));
  }
}

export async function createPropertyTx(
  client: PgQueryable,
  projectId: string,
  name: string,
  description: string | null,
  data: unknown
): Promise<string> {
  return createPropertyTxImpl(client, projectId, name, description, data);
}

async function createClassTxImpl(
  client: PgQueryable,
  versionId: string,
  name: string,
  description: string | null,
  schema: unknown
): Promise<string> {
  try {
    if (!name || name.trim().length === 0) {
      return errorResponse('Class name is required');
    }

    if (!schema) {
      return errorResponse('Class schema is required');
    }

    const result = await client.query(
      `INSERT INTO odb.classes (version_id, name, description, schema)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [versionId, name.trim(), description, JSON.stringify(schema)]
    );

    return successResponse({ class: result.rows[0] });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === '23505') {
      return errorResponse('A class with this name already exists in this version');
    }
    return errorResponse(err.message || String(error));
  }
}

export async function createClassTx(
  client: PgQueryable,
  versionId: string,
  name: string,
  description: string | null,
  schema: unknown
): Promise<string> {
  return createClassTxImpl(client, versionId, name, description, schema);
}

async function addPropertyToClassTxImpl(
  client: PgQueryable,
  classId: string,
  propertyId: string | null,
  name: string,
  description: string | null,
  data: unknown,
  parentId: string | null = null
): Promise<string> {
  try {
    if (!name || name.trim().length === 0) {
      return errorResponse('Property name is required');
    }

    const d = data as { $ref?: string; type?: string; items?: { $ref?: string } };
    const hasRef = data && (d.$ref || (d.type === 'array' && d.items?.$ref));
    if (!propertyId && !hasRef) {
      return errorResponse('Property must have either a library reference (propertyId) or a schema $ref');
    }

    const result = await client.query(
      `INSERT INTO odb.class_properties (class_id, property_id, name, description, data, parent_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [classId, propertyId, name.trim(), description, JSON.stringify(data), parentId]
    );

    return successResponse({ classProperty: result.rows[0] });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === '23505') {
      return errorResponse('A property with this name already exists in this class');
    }
    return errorResponse(err.message || String(error));
  }
}

export async function addPropertyToClassTx(
  client: PgQueryable,
  classId: string,
  propertyId: string | null,
  name: string,
  description: string | null,
  data: unknown,
  parentId: string | null = null
): Promise<string> {
  return addPropertyToClassTxImpl(client, classId, propertyId, name, description, data, parentId);
}

async function getClassesWithPropertiesAndTagsTxImpl(client: PgQueryable, versionId: string): Promise<string> {
  try {
    const classesResult = await client.query(
      `SELECT id, version_id, name, description, schema, enabled, canvas_metadata, created_at, updated_at
       FROM odb.classes
       WHERE version_id = $1 AND deleted_at IS NULL
       ORDER BY name ASC`,
      [versionId]
    );

    const classes = classesResult.rows;

    if (classes.length === 0) {
      return JSON.stringify([]);
    }

    const classIds = classes.map((c: { id: string }) => c.id);

    const propertiesResult = await client.query(
      `SELECT cp.id, cp.class_id, cp.property_id, cp.name, cp.description, cp.data, cp.parent_id,
              p.id as property_source_id, p.name as property_source_name
       FROM odb.class_properties cp
       LEFT JOIN odb.properties p ON cp.property_id = p.id
       WHERE cp.class_id = ANY($1)
       ORDER BY cp.class_id, cp.parent_id NULLS FIRST, cp.name ASC`,
      [classIds]
    );

    const tagsResult = await client.query(
      `SELECT ct.id, ct.class_id, ct.tag_id, ct.created_at,
              t.name as tag_name, t.color as tag_color, t.description as tag_description,
              t.project_id
       FROM odb.class_tags ct
       JOIN odb.tags t ON ct.tag_id = t.id
       WHERE ct.class_id = ANY($1)
       ORDER BY ct.class_id, t.name ASC`,
      [classIds]
    );

    const propertiesByClass = new Map<string, unknown[]>();
    for (const prop of propertiesResult.rows) {
      const classId = prop.class_id as string;
      if (!propertiesByClass.has(classId)) {
        propertiesByClass.set(classId, []);
      }
      propertiesByClass.get(classId)!.push(prop);
    }

    const tagsByClass = new Map<string, unknown[]>();
    for (const tag of tagsResult.rows) {
      const classId = tag.class_id as string;
      if (!tagsByClass.has(classId)) {
        tagsByClass.set(classId, []);
      }
      tagsByClass.get(classId)!.push(tag);
    }

    const classesWithData = classes.map((cls: Record<string, unknown>) => ({
      ...cls,
      properties: propertiesByClass.get(cls.id as string) || [],
      tags: tagsByClass.get(cls.id as string) || [],
    }));

    return JSON.stringify(classesWithData);
  } catch (error: unknown) {
    console.error('Error bulk loading classes with properties and tags:', error);
    return JSON.stringify([]);
  }
}

export async function getClassesWithPropertiesAndTagsTx(client: PgQueryable, versionId: string): Promise<string> {
  return getClassesWithPropertiesAndTagsTxImpl(client, versionId);
}

class PgTransactionHandle implements TransactionHandle {
  constructor(
    private readonly client: PoolClient,
    private readonly planChecks?: PgClientPlanChecks
  ) {}

  begin(): Promise<void> {
    return beginTransaction(this.client);
  }
  commit(): Promise<void> {
    return commitTransaction(this.client);
  }
  rollback(): Promise<void> {
    return rollbackTransaction(this.client);
  }
  release(): Promise<void> {
    return Promise.resolve(this.client.release());
  }

  createProjectTx(
    tenantId: string,
    creatorId: string,
    name: string,
    description: string,
    slug: string,
    metadata?: unknown
  ): Promise<string> {
    return createProjectTxImpl(this.client, tenantId, creatorId, name, description, slug, metadata, this.planChecks);
  }

  createVersionTx(
    projectId: string,
    creatorId: string,
    versionId: string,
    description: string,
    changeLog: string,
    opts?: { parentVersionUuid?: string | null }
  ): Promise<string> {
    return createVersionTxImpl(this.client, projectId, creatorId, versionId, description, changeLog, opts, this.planChecks);
  }

  getLatestVersionUuidForProjectTx(projectId: string): Promise<string | null> {
    return queryLatestVersionUuidForProject(this.client, projectId);
  }

  listProjectLibraryPropertiesTx(
    projectId: string
  ): Promise<Array<{ id: string; name: string; description: string | null; data: unknown }>> {
    return queryListProjectLibraryProperties(this.client, projectId);
  }

  createPropertyTx(projectId: string, name: string, description: string | null, data: unknown): Promise<string> {
    return createPropertyTxImpl(this.client, projectId, name, description, data);
  }

  createClassTx(versionId: string, name: string, description: string | null, schema: unknown): Promise<string> {
    return createClassTxImpl(this.client, versionId, name, description, schema);
  }

  addPropertyToClassTx(
    classId: string,
    propertyId: string | null,
    name: string,
    description: string | null,
    data: unknown,
    parentId?: string | null
  ): Promise<string> {
    return addPropertyToClassTxImpl(this.client, classId, propertyId, name, description, data, parentId ?? null);
  }

  getClassesWithPropertiesAndTagsTx(versionId: string): Promise<string> {
    return getClassesWithPropertiesAndTagsTxImpl(this.client, versionId);
  }
}

export class PgTransactionalClient implements TransactionalClient {
  constructor(
    private readonly pool: Pool,
    private readonly planChecks?: PgClientPlanChecks
  ) {}

  async connect(): Promise<TransactionHandle> {
    const client = await this.pool.connect();
    return new PgTransactionHandle(client, this.planChecks);
  }
}
