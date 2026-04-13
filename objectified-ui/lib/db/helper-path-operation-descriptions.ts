// Helper functions for path operation description management in the database
'use server';

const connectionPool = require('./db');

/**
 * Get the description for a specific path operation
 */
export async function getOperationDescription(pathOperationId: string): Promise<string> {
  const query = `
    SELECT 
      id,
      path_operation_id,
      summary,
      description,
      operation_id,
      metadata,
      created_at,
      updated_at
    FROM odb.path_operation_description
    WHERE path_operation_id = $1
  `;

  try {
    const result = await connectionPool.query(query, [pathOperationId]);
    return JSON.stringify(result.rows[0] || null);
  } catch (error) {
    console.error('Error fetching operation description:', error);
    throw error;
  }
}

/**
 * Create or update a description for a path operation (upsert).
 * When metadata is provided, it is stored in the metadata JSONB column.
 * Pass merged metadata (e.g. { ...existingMetadata, security }) to preserve other fields.
 */
/**
 * Enforces OpenAPI operationId uniqueness within a single API version (MVP rule).
 * Empty or whitespace-only values are treated as unset and do not conflict.
 */
async function assertOperationIdUniqueInVersion(
  pathOperationId: string,
  operationId: string | null
): Promise<void> {
  if (!operationId) return;

  const conflictQuery = `
    SELECT vp.pathname, po.operation
    FROM odb.path_operation_description pod
    INNER JOIN odb.path_operation po ON po.id = pod.path_operation_id
    INNER JOIN odb.version_path vp ON vp.id = po.version_path_id
    WHERE vp.version_id = (
      SELECT vp2.version_id
      FROM odb.path_operation po2
      INNER JOIN odb.version_path vp2 ON vp2.id = po2.version_path_id
      WHERE po2.id = $1
    )
    AND pod.path_operation_id <> $1
    AND pod.operation_id IS NOT NULL
    AND TRIM(pod.operation_id) = $2
    LIMIT 1
  `;

  const result = await connectionPool.query(conflictQuery, [pathOperationId, operationId]);
  if (result.rows.length > 0) {
    const row = result.rows[0] as { pathname: string; operation: string };
    throw new Error(
      `Operation ID "${operationId}" is already used by ${row.operation} ${row.pathname}. ` +
        'Each operationId must be unique in this version — rename it or clear the field.'
    );
  }
}

export async function upsertOperationDescription(
  pathOperationId: string,
  summary?: string,
  description?: string,
  operationId?: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  const normalizedOperationId = operationId?.trim() ? operationId.trim() : null;

  const query = `
    INSERT INTO odb.path_operation_description (path_operation_id, summary, description, operation_id, metadata)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (path_operation_id) 
    DO UPDATE SET 
      summary = EXCLUDED.summary,
      description = EXCLUDED.description,
      operation_id = EXCLUDED.operation_id,
      metadata = COALESCE(EXCLUDED.metadata, path_operation_description.metadata),
      updated_at = CURRENT_TIMESTAMP
    RETURNING id, path_operation_id, summary, description, operation_id, metadata, created_at, updated_at
  `;

  try {
    await assertOperationIdUniqueInVersion(pathOperationId, normalizedOperationId);
    const result = await connectionPool.query(query, [
      pathOperationId,
      summary ?? null,
      description ?? null,
      normalizedOperationId,
      metadata ? JSON.stringify(metadata) : null,
    ]);
    return JSON.stringify(result.rows[0]);
  } catch (error) {
    console.error('Error upserting operation description:', error);
    throw error;
  }
}

/**
 * Delete a description for a path operation
 */
export async function deleteOperationDescription(pathOperationId: string): Promise<void> {
  const query = `
    DELETE FROM odb.path_operation_description
    WHERE path_operation_id = $1
  `;

  try {
    await connectionPool.query(query, [pathOperationId]);
  } catch (error) {
    console.error('Error deleting operation description:', error);
    throw error;
  }
}


