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
 * Create or update a description for a path operation (upsert)
 */
export async function upsertOperationDescription(
  pathOperationId: string,
  summary?: string,
  description?: string,
  operationId?: string,
  metadata?: Record<string, any>
): Promise<string> {
  const query = `
    INSERT INTO odb.path_operation_description (path_operation_id, summary, description, operation_id, metadata)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (path_operation_id) 
    DO UPDATE SET 
      summary = EXCLUDED.summary,
      description = EXCLUDED.description,
      operation_id = EXCLUDED.operation_id,
      metadata = EXCLUDED.metadata,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id, path_operation_id, summary, description, operation_id, metadata, created_at, updated_at
  `;

  try {
    const result = await connectionPool.query(query, [
      pathOperationId,
      summary || null,
      description || null,
      operationId || null,
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


