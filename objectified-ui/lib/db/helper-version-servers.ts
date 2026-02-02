'use server';

/**
 * Helper functions for version server definitions (OpenAPI servers array).
 * Ticket #565: Multiple server definitions with name, url, description.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const connectionPool = require('./db');

export interface VersionServerRecord {
  id: string;
  version_id: string;
  name: string | null;
  url: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface VersionServerInput {
  name?: string;
  url: string;
  description?: string;
  sort_order?: number;
}

/**
 * Get all servers for a version (ordered by sort_order, url)
 */
export async function getServersForVersion(versionId: string): Promise<VersionServerRecord[]> {
  const result = await connectionPool.query(
    `SELECT id, version_id, name, url, description, sort_order, created_at, updated_at
     FROM odb.version_server
     WHERE version_id = $1
     ORDER BY sort_order, url`,
    [versionId]
  );
  return result.rows.map((r: Record<string, unknown>) => ({
    id: r.id,
    version_id: r.version_id,
    name: r.name,
    url: r.url,
    description: r.description,
    sort_order: Number(r.sort_order) || 0,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

/**
 * Create a server for a version
 */
export async function createServer(
  versionId: string,
  input: VersionServerInput
): Promise<{ success: boolean; server?: VersionServerRecord; error?: string }> {
  try {
    const sortOrder = input.sort_order ?? 0;
    const result = await connectionPool.query(
      `INSERT INTO odb.version_server (version_id, name, url, description, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, version_id, name, url, description, sort_order, created_at, updated_at`,
      [
        versionId,
        input.name?.trim() || null,
        input.url.trim(),
        input.description?.trim() || null,
        sortOrder,
      ]
    );
    const row = result.rows[0];
    return {
      success: true,
      server: {
        id: row.id,
        version_id: row.version_id,
        name: row.name,
        url: row.url,
        description: row.description,
        sort_order: Number(row.sort_order) || 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

/**
 * Update a server
 */
export async function updateServer(
  serverId: string,
  input: Partial<VersionServerInput>
): Promise<{ success: boolean; server?: VersionServerRecord; error?: string }> {
  try {
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(input.name.trim() || null);
    }
    if (input.url !== undefined) {
      updates.push(`url = $${idx++}`);
      values.push(input.url.trim());
    }
    if (input.description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(input.description.trim() || null);
    }
    if (input.sort_order !== undefined) {
      updates.push(`sort_order = $${idx++}`);
      values.push(input.sort_order);
    }
    if (updates.length === 0) {
      return { success: false, error: 'No fields to update' };
    }
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(serverId);

    const result = await connectionPool.query(
      `UPDATE odb.version_server SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, version_id, name, url, description, sort_order, created_at, updated_at`,
      values
    );
    if (result.rows.length === 0) {
      return { success: false, error: 'Server not found' };
    }
    const row = result.rows[0];
    return {
      success: true,
      server: {
        id: row.id,
        version_id: row.version_id,
        name: row.name,
        url: row.url,
        description: row.description,
        sort_order: Number(row.sort_order) || 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

/**
 * Delete a server
 */
export async function deleteServer(serverId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await connectionPool.query('DELETE FROM odb.version_server WHERE id = $1 RETURNING id', [serverId]);
    return { success: result.rowCount > 0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

/**
 * Convert version servers to OpenAPI servers array (url, description).
 * Async to satisfy Server Action requirement ('use server').
 */
export async function serversToOpenAPI(servers: VersionServerRecord[]): Promise<Array<{ url: string; description?: string }>> {
  return servers
    .filter((s) => s.url?.trim())
    .map((s) => ({
      url: s.url.trim(),
      ...(s.description?.trim() ? { description: s.description.trim() } : {}),
    }));
}
