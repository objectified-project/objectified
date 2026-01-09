// Helper functions for path operation management in the database
'use server';

const connectionPool = require('./db');

/**
 * Get all operations for a specific path
 */
export async function getOperationsForPath(versionPathId: string): Promise<string> {
  const query = `
    SELECT 
      id,
      version_path_id,
      operation,
      metadata,
      created_at,
      updated_at
    FROM odb.path_operation
    WHERE version_path_id = $1
    ORDER BY 
      CASE operation
        WHEN 'GET' THEN 1
        WHEN 'POST' THEN 2
        WHEN 'PUT' THEN 3
        WHEN 'PATCH' THEN 4
        WHEN 'DELETE' THEN 5
        WHEN 'HEAD' THEN 6
        WHEN 'OPTIONS' THEN 7
        ELSE 8
      END
  `;

  try {
    const result = await connectionPool.query(query, [versionPathId]);
    return JSON.stringify(result.rows);
  } catch (error) {
    console.error('Error fetching operations for path:', error);
    throw error;
  }
}

/**
 * Create a new operation for a path
 */
export async function createOperation(
  versionPathId: string,
  operation: string,
  metadata?: Record<string, any>
): Promise<string> {
  const query = `
    INSERT INTO odb.path_operation (version_path_id, operation, metadata)
    VALUES ($1, $2, $3)
    RETURNING id, version_path_id, operation, metadata, created_at, updated_at
  `;

  try {
    const result = await connectionPool.query(query, [
      versionPathId,
      operation.toUpperCase(),
      metadata ? JSON.stringify(metadata) : null,
    ]);
    return JSON.stringify(result.rows[0]);
  } catch (error) {
    console.error('Error creating operation:', error);
    throw error;
  }
}

/**
 * Update an existing operation
 */
export async function updateOperation(
  operationId: string,
  metadata?: Record<string, any>
): Promise<string> {
  const query = `
    UPDATE odb.path_operation
    SET 
      metadata = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id, version_path_id, operation, metadata, created_at, updated_at
  `;

  try {
    const result = await connectionPool.query(query, [
      operationId,
      metadata ? JSON.stringify(metadata) : null,
    ]);
    return JSON.stringify(result.rows[0]);
  } catch (error) {
    console.error('Error updating operation:', error);
    throw error;
  }
}

/**
 * Delete an operation
 */
export async function deleteOperation(operationId: string): Promise<void> {
  const query = `
    DELETE FROM odb.path_operation
    WHERE id = $1
  `;

  try {
    await connectionPool.query(query, [operationId]);
  } catch (error) {
    console.error('Error deleting operation:', error);
    throw error;
  }
}

/**
 * Get a single operation by ID
 */
export async function getOperationById(operationId: string): Promise<string> {
  const query = `
    SELECT 
      id,
      version_path_id,
      operation,
      metadata,
      created_at,
      updated_at
    FROM odb.path_operation
    WHERE id = $1
  `;

  try {
    const result = await connectionPool.query(query, [operationId]);
    return JSON.stringify(result.rows[0]);
  } catch (error) {
    console.error('Error fetching operation by ID:', error);
    throw error;
  }
}

