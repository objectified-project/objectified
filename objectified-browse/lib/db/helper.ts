'use server';

import connectionPool from './db';

/**
 * Get all tenants that have at least one published public version
 */
export async function getPublicTenants() {
  try {
    const result = await connectionPool.query(
      `SELECT DISTINCT t.id, t.name, t.slug, t.description, t.created_at
       FROM odb.tenants t
       JOIN odb.projects p ON t.id = p.tenant_id
       JOIN odb.versions v ON p.id = v.project_id
       WHERE v.published = true
         AND v.visibility = 'public'
         AND t.deleted_at IS NULL
         AND p.deleted_at IS NULL
         AND v.deleted_at IS NULL
       ORDER BY t.name ASC`
    );
    return result.rows;
  } catch (error: any) {
    console.error('Error fetching public tenants:', error);
    return [];
  }
}

/**
 * Get all projects for a tenant that have at least one published public version
 */
export async function getPublicProjectsForTenant(tenantSlug: string) {
  try {
    const result = await connectionPool.query(
      `SELECT DISTINCT p.id, p.name, p.slug, p.description, p.created_at
       FROM odb.projects p
       JOIN odb.tenants t ON p.tenant_id = t.id
       JOIN odb.versions v ON p.id = v.project_id
       WHERE t.slug = $1
         AND v.published = true
         AND v.visibility = 'public'
         AND t.deleted_at IS NULL
         AND p.deleted_at IS NULL
         AND v.deleted_at IS NULL
       ORDER BY p.name ASC`,
      [tenantSlug]
    );
    return result.rows;
  } catch (error: any) {
    console.error('Error fetching public projects:', error);
    return [];
  }
}

/**
 * Get all published public versions for a project
 */
export async function getPublicVersionsForProject(tenantSlug: string, projectSlug: string) {
  try {
    const result = await connectionPool.query(
      `SELECT v.id, v.version_id, v.description, v.change_log, v.published, v.visibility, 
              v.created_at, v.updated_at, v.published_at, v.published_by,
              u.name as publisher_name, u.email as publisher_email
       FROM odb.versions v
       JOIN odb.projects p ON v.project_id = p.id
       JOIN odb.tenants t ON p.tenant_id = t.id
       LEFT JOIN odb.users u ON v.published_by = u.id
       WHERE t.slug = $1
         AND p.slug = $2
         AND v.published = true
         AND v.visibility = 'public'
         AND t.deleted_at IS NULL
         AND p.deleted_at IS NULL
         AND v.deleted_at IS NULL
       ORDER BY v.created_at DESC`,
      [tenantSlug, projectSlug]
    );
    return result.rows;
  } catch (error: any) {
    console.error('Error fetching public versions:', error);
    return [];
  }
}

/**
 * Get version details by tenant, project, and version slugs
 */
export async function getPublicVersionDetails(tenantSlug: string, projectSlug: string, versionSlug: string) {
  try {
    const result = await connectionPool.query(
      `SELECT v.id, v.version_id, v.description, v.change_log, v.published, v.visibility,
              v.created_at, v.updated_at, v.published_at, v.published_by,
              p.name as project_name, p.slug as project_slug, p.description as project_description,
              t.name as tenant_name, t.slug as tenant_slug, t.description as tenant_description,
              u.name as publisher_name, u.email as publisher_email
       FROM odb.versions v
       JOIN odb.projects p ON v.project_id = p.id
       JOIN odb.tenants t ON p.tenant_id = t.id
       LEFT JOIN odb.users u ON v.published_by = u.id
       WHERE t.slug = $1
         AND p.slug = $2
         AND v.version_id = $3
         AND v.published = true
         AND v.visibility = 'public'
         AND t.deleted_at IS NULL
         AND p.deleted_at IS NULL
         AND v.deleted_at IS NULL`,
      [tenantSlug, projectSlug, versionSlug]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error: any) {
    console.error('Error fetching version details:', error);
    return null;
  }
}

/**
 * Search for tenants and projects by query string
 */
export async function searchPublicTenantsAndProjects(query: string) {
  try {
    const searchTerm = `%${query}%`;
    const result = await connectionPool.query(
      `SELECT DISTINCT
         t.id as tenant_id,
         t.name as tenant_name,
         t.slug as tenant_slug,
         t.description as tenant_description,
         p.id as project_id,
         p.name as project_name,
         p.slug as project_slug,
         p.description as project_description,
         COUNT(v.id) as version_count
       FROM odb.tenants t
       JOIN odb.projects p ON t.id = p.tenant_id
       JOIN odb.versions v ON p.id = v.project_id
       WHERE (
           LOWER(t.name) LIKE LOWER($1)
           OR LOWER(t.slug) LIKE LOWER($1)
           OR LOWER(p.name) LIKE LOWER($1)
           OR LOWER(p.slug) LIKE LOWER($1)
           OR LOWER(p.description) LIKE LOWER($1)
         )
         AND v.published = true
         AND v.visibility = 'public'
         AND t.deleted_at IS NULL
         AND p.deleted_at IS NULL
         AND v.deleted_at IS NULL
       GROUP BY t.id, t.name, t.slug, t.description, p.id, p.name, p.slug, p.description
       ORDER BY t.name ASC, p.name ASC`,
      [searchTerm]
    );
    return result.rows;
  } catch (error: any) {
    console.error('Error searching tenants and projects:', error);
    return [];
  }
}

/**
 * Get tenant details by slug
 */
export async function getPublicTenantBySlug(tenantSlug: string) {
  try {
    const result = await connectionPool.query(
      `SELECT DISTINCT t.id, t.name, t.slug, t.description, t.created_at
       FROM odb.tenants t
       JOIN odb.projects p ON t.id = p.tenant_id
       JOIN odb.versions v ON p.id = v.project_id
       WHERE t.slug = $1
         AND v.published = true
         AND v.visibility = 'public'
         AND t.deleted_at IS NULL
         AND p.deleted_at IS NULL
         AND v.deleted_at IS NULL`,
      [tenantSlug]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error: any) {
    console.error('Error fetching tenant:', error);
    return null;
  }
}

/**
 * Get project details by tenant and project slugs
 */
export async function getPublicProjectBySlug(tenantSlug: string, projectSlug: string) {
  try {
    const result = await connectionPool.query(
      `SELECT DISTINCT p.id, p.name, p.slug, p.description, p.created_at,
              t.name as tenant_name, t.slug as tenant_slug, t.description as tenant_description
       FROM odb.projects p
       JOIN odb.tenants t ON p.tenant_id = t.id
       JOIN odb.versions v ON p.id = v.project_id
       WHERE t.slug = $1
         AND p.slug = $2
         AND v.published = true
         AND v.visibility = 'public'
         AND t.deleted_at IS NULL
         AND p.deleted_at IS NULL
         AND v.deleted_at IS NULL`,
      [tenantSlug, projectSlug]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error: any) {
    console.error('Error fetching project:', error);
    return null;
  }
}

