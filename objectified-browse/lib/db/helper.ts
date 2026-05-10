'use server';

import { unstable_noStore as noStore } from 'next/cache';
import connectionPool from './db';

interface PgError {
  message?: string;
  code?: string;
}

function logError(scope: string, err: unknown) {
  const e = err as PgError;
  console.error(`[db] ${scope}:`, e?.message ?? err);
}

/**
 * Get all tenants that have at least one published public version.
 */
export async function getPublicTenants() {
  noStore();
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
  } catch (err) {
    logError('getPublicTenants', err);
    return [];
  }
}

/**
 * Get all projects for a tenant that have at least one published public version.
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
  } catch (err) {
    logError('getPublicProjectsForTenant', err);
    return [];
  }
}

/**
 * Get all published public versions for a project.
 */
export async function getPublicVersionsForProject(tenantSlug: string, projectSlug: string) {
  try {
    const result = await connectionPool.query(
      `SELECT v.id, v.version_id, v.description, v.change_log, v.published, v.visibility,
              v.created_at, v.updated_at, v.published_at
       FROM odb.versions v
       JOIN odb.projects p ON v.project_id = p.id
       JOIN odb.tenants t ON p.tenant_id = t.id
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
  } catch (err) {
    logError('getPublicVersionsForProject', err);
    return [];
  }
}

/**
 * Get version details by tenant, project, and version slugs.
 */
export async function getPublicVersionDetails(
  tenantSlug: string,
  projectSlug: string,
  versionSlug: string
) {
  try {
    const result = await connectionPool.query(
      `SELECT v.id, v.version_id, v.description, v.change_log, v.published, v.visibility,
              v.created_at, v.updated_at, v.published_at,
              p.name as project_name, p.slug as project_slug, p.description as project_description,
              t.name as tenant_name, t.slug as tenant_slug, t.description as tenant_description
       FROM odb.versions v
       JOIN odb.projects p ON v.project_id = p.id
       JOIN odb.tenants t ON p.tenant_id = t.id
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
  } catch (err) {
    logError('getPublicVersionDetails', err);
    return null;
  }
}

export type PublishedCatalogSearchHit = {
  hit_id: string;
  hit_type: string;
  tenant_slug: string;
  tenant_name: string;
  project_slug: string;
  project_name: string;
  version_slug: string;
  published_at: string | null;
  title: string;
  snippet: string;
  subtitle: string | null;
};

function escapeLikePattern(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Full plain-text search across published **public** versions only: organizations, projects,
 * version notes, OpenAPI paths/operations, schemas, parameters, and request/response documentation.
 * Private or unpublished versions never appear.
 */
export async function searchPublishedPublicCatalog(query: string): Promise<PublishedCatalogSearchHit[]> {
  noStore();
  const q = query.trim();
  if (!q) return [];

  const pattern = `%${escapeLikePattern(q)}%`;

  try {
    const result = await connectionPool.query(
      `SELECT * FROM (
        (
          SELECT DISTINCT ON (p.id)
            ('project:' || p.id::text) AS hit_id,
            'project' AS hit_type,
            t.slug AS tenant_slug,
            t.name AS tenant_name,
            p.slug AS project_slug,
            p.name AS project_name,
            v.version_id AS version_slug,
            v.published_at::text AS published_at,
            p.name AS title,
            LEFT(COALESCE(NULLIF(TRIM(p.description), ''), 'Project in ' || t.name), 400) AS snippet,
            ('Organization · ' || t.slug) AS subtitle
          FROM odb.tenants t
          JOIN odb.projects p ON p.tenant_id = t.id
          JOIN odb.versions v ON v.project_id = p.id
          WHERE v.published = true
            AND v.visibility = 'public'
            AND t.deleted_at IS NULL
            AND p.deleted_at IS NULL
            AND v.deleted_at IS NULL
            AND (
              t.name ILIKE $1 ESCAPE '\\'
              OR t.slug ILIKE $1 ESCAPE '\\'
              OR p.name ILIKE $1 ESCAPE '\\'
              OR p.slug ILIKE $1 ESCAPE '\\'
              OR COALESCE(p.description, '') ILIKE $1 ESCAPE '\\'
            )
          ORDER BY p.id, v.published_at DESC NULLS LAST, v.created_at DESC
        )

        UNION ALL

        SELECT
          ('version:' || v.id::text) AS hit_id,
          'version' AS hit_type,
          t.slug AS tenant_slug,
          t.name AS tenant_name,
          p.slug AS project_slug,
          p.name AS project_name,
          v.version_id AS version_slug,
          v.published_at::text AS published_at,
          ('Version notes · v' || v.version_id) AS title,
          LEFT(COALESCE(NULLIF(TRIM(v.description), ''), NULLIF(TRIM(v.change_log), ''), ''), 400) AS snippet,
          ('Published specification') AS subtitle
        FROM odb.versions v
        JOIN odb.projects p ON v.project_id = p.id
        JOIN odb.tenants t ON p.tenant_id = t.id
        WHERE v.published = true
          AND v.visibility = 'public'
          AND t.deleted_at IS NULL
          AND p.deleted_at IS NULL
          AND v.deleted_at IS NULL
          AND (
            COALESCE(v.description, '') ILIKE $1 ESCAPE '\\'
            OR COALESCE(v.change_log, '') ILIKE $1 ESCAPE '\\'
          )

        UNION ALL

        SELECT
          ('path:' || po.id::text) AS hit_id,
          'path' AS hit_type,
          t.slug AS tenant_slug,
          t.name AS tenant_name,
          p.slug AS project_slug,
          p.name AS project_name,
          v.version_id AS version_slug,
          v.published_at::text AS published_at,
          COALESCE(NULLIF(TRIM(pod.summary), ''), po.operation || ' ' || vp.pathname) AS title,
          LEFT(COALESCE(NULLIF(TRIM(pod.description), ''), po.operation || ' ' || vp.pathname), 400) AS snippet,
          (LOWER(po.operation) || ' · path') AS subtitle
        FROM odb.path_operation po
        JOIN odb.version_path vp ON po.version_path_id = vp.id
        JOIN odb.versions v ON vp.version_id = v.id
        JOIN odb.projects p ON v.project_id = p.id
        JOIN odb.tenants t ON p.tenant_id = t.id
        LEFT JOIN odb.path_operation_description pod ON pod.path_operation_id = po.id
        WHERE v.published = true
          AND v.visibility = 'public'
          AND t.deleted_at IS NULL
          AND p.deleted_at IS NULL
          AND v.deleted_at IS NULL
          AND (
            vp.pathname ILIKE $1 ESCAPE '\\'
            OR po.operation ILIKE $1 ESCAPE '\\'
            OR COALESCE(pod.summary, '') ILIKE $1 ESCAPE '\\'
            OR COALESCE(pod.description, '') ILIKE $1 ESCAPE '\\'
            OR COALESCE(pod.operation_id, '') ILIKE $1 ESCAPE '\\'
            OR COALESCE(pod.metadata::text, '') ILIKE $1 ESCAPE '\\'
            OR COALESCE(po.metadata::text, '') ILIKE $1 ESCAPE '\\'
          )

        UNION ALL

        SELECT
          ('class:' || c.id::text) AS hit_id,
          'schema' AS hit_type,
          t.slug AS tenant_slug,
          t.name AS tenant_name,
          p.slug AS project_slug,
          p.name AS project_name,
          v.version_id AS version_slug,
          v.published_at::text AS published_at,
          ('Schema · ' || c.name) AS title,
          LEFT(COALESCE(NULLIF(TRIM(c.description), ''), c.schema::text), 400) AS snippet,
          ('components.schemas') AS subtitle
        FROM odb.classes c
        JOIN odb.versions v ON c.version_id = v.id
        JOIN odb.projects p ON v.project_id = p.id
        JOIN odb.tenants t ON p.tenant_id = t.id
        WHERE v.published = true
          AND v.visibility = 'public'
          AND c.deleted_at IS NULL
          AND t.deleted_at IS NULL
          AND p.deleted_at IS NULL
          AND v.deleted_at IS NULL
          AND (
            c.name ILIKE $1 ESCAPE '\\'
            OR COALESCE(c.description, '') ILIKE $1 ESCAPE '\\'
            OR c.schema::text ILIKE $1 ESCAPE '\\'
          )

        UNION ALL

        SELECT
          ('prop:' || cp.id::text) AS hit_id,
          'property' AS hit_type,
          t.slug AS tenant_slug,
          t.name AS tenant_name,
          p.slug AS project_slug,
          p.name AS project_name,
          v.version_id AS version_slug,
          v.published_at::text AS published_at,
          ('Property · ' || c.name || '.' || cp.name) AS title,
          LEFT(COALESCE(NULLIF(TRIM(cp.description), ''), cp.data::text), 400) AS snippet,
          ('model property') AS subtitle
        FROM odb.class_properties cp
        JOIN odb.classes c ON cp.class_id = c.id
        JOIN odb.versions v ON c.version_id = v.id
        JOIN odb.projects p ON v.project_id = p.id
        JOIN odb.tenants t ON p.tenant_id = t.id
        WHERE v.published = true
          AND v.visibility = 'public'
          AND c.deleted_at IS NULL
          AND t.deleted_at IS NULL
          AND p.deleted_at IS NULL
          AND v.deleted_at IS NULL
          AND (
            cp.name ILIKE $1 ESCAPE '\\'
            OR COALESCE(cp.description, '') ILIKE $1 ESCAPE '\\'
            OR cp.data::text ILIKE $1 ESCAPE '\\'
          )

        UNION ALL

        SELECT
          ('sparam:' || spp.id::text) AS hit_id,
          'parameter' AS hit_type,
          t.slug AS tenant_slug,
          t.name AS tenant_name,
          p.slug AS project_slug,
          p.name AS project_name,
          v.version_id AS version_slug,
          v.published_at::text AS published_at,
          ('Parameter · ' || spp.in_location || ' · ' || spp.name) AS title,
          LEFT(COALESCE(NULLIF(TRIM(spp.summary), ''), NULLIF(TRIM(spp.description), ''), spp.data::text), 400) AS snippet,
          ('operation parameter') AS subtitle
        FROM odb.shared_path_parameter spp
        JOIN odb.version_path vp ON spp.version_path_id = vp.id
        JOIN odb.versions v ON vp.version_id = v.id
        JOIN odb.projects p ON v.project_id = p.id
        JOIN odb.tenants t ON p.tenant_id = t.id
        WHERE v.published = true
          AND v.visibility = 'public'
          AND t.deleted_at IS NULL
          AND p.deleted_at IS NULL
          AND v.deleted_at IS NULL
          AND (
            spp.name ILIKE $1 ESCAPE '\\'
            OR COALESCE(spp.summary, '') ILIKE $1 ESCAPE '\\'
            OR COALESCE(spp.description, '') ILIKE $1 ESCAPE '\\'
            OR spp.data::text ILIKE $1 ESCAPE '\\'
          )

        UNION ALL

        SELECT
          ('body:' || sprb.id::text) AS hit_id,
          'request_body' AS hit_type,
          t.slug AS tenant_slug,
          t.name AS tenant_name,
          p.slug AS project_slug,
          p.name AS project_name,
          v.version_id AS version_slug,
          v.published_at::text AS published_at,
          ('Request body · ' || sprb.name) AS title,
          LEFT(COALESCE(NULLIF(TRIM(sprb.description), ''), ''), 400) AS snippet,
          ('requestBody') AS subtitle
        FROM odb.shared_path_request_body sprb
        JOIN odb.version_path vp ON sprb.version_path_id = vp.id
        JOIN odb.versions v ON vp.version_id = v.id
        JOIN odb.projects p ON v.project_id = p.id
        JOIN odb.tenants t ON p.tenant_id = t.id
        WHERE v.published = true
          AND v.visibility = 'public'
          AND t.deleted_at IS NULL
          AND p.deleted_at IS NULL
          AND v.deleted_at IS NULL
          AND (
            sprb.name ILIKE $1 ESCAPE '\\'
            OR COALESCE(sprb.description, '') ILIKE $1 ESCAPE '\\'
          )

        UNION ALL

        SELECT
          ('bodyc:' || sprbc.id::text) AS hit_id,
          'request_body' AS hit_type,
          t.slug AS tenant_slug,
          t.name AS tenant_name,
          p.slug AS project_slug,
          p.name AS project_name,
          v.version_id AS version_slug,
          v.published_at::text AS published_at,
          ('Request body schema · ' || sprbc.media_type) AS title,
          LEFT(COALESCE(sprbc.inline_schema::text, sprbc.examples::text, ''), 400) AS snippet,
          ('inline schema') AS subtitle
        FROM odb.shared_path_request_body_content sprbc
        JOIN odb.shared_path_request_body sprb ON sprbc.shared_path_request_body_id = sprb.id
        JOIN odb.version_path vp ON sprb.version_path_id = vp.id
        JOIN odb.versions v ON vp.version_id = v.id
        JOIN odb.projects p ON v.project_id = p.id
        JOIN odb.tenants t ON p.tenant_id = t.id
        WHERE v.published = true
          AND v.visibility = 'public'
          AND t.deleted_at IS NULL
          AND p.deleted_at IS NULL
          AND v.deleted_at IS NULL
          AND (
            COALESCE(sprbc.inline_schema::text, '') ILIKE $1 ESCAPE '\\'
            OR COALESCE(sprbc.examples::text, '') ILIKE $1 ESCAPE '\\'
          )

        UNION ALL

        SELECT
          ('resp:' || spr.id::text) AS hit_id,
          'response' AS hit_type,
          t.slug AS tenant_slug,
          t.name AS tenant_name,
          p.slug AS project_slug,
          p.name AS project_name,
          v.version_id AS version_slug,
          v.published_at::text AS published_at,
          ('Response · HTTP ' || spr.status_code) AS title,
          LEFT(COALESCE(NULLIF(TRIM(spr.description), ''), spr.inline_schema::text, spr.data::text, ''), 400) AS snippet,
          ('response') AS subtitle
        FROM odb.shared_path_response spr
        JOIN odb.version_path vp ON spr.version_path_id = vp.id
        JOIN odb.versions v ON vp.version_id = v.id
        JOIN odb.projects p ON v.project_id = p.id
        JOIN odb.tenants t ON p.tenant_id = t.id
        WHERE v.published = true
          AND v.visibility = 'public'
          AND t.deleted_at IS NULL
          AND p.deleted_at IS NULL
          AND v.deleted_at IS NULL
          AND (
            COALESCE(spr.description, '') ILIKE $1 ESCAPE '\\'
            OR COALESCE(spr.inline_schema::text, '') ILIKE $1 ESCAPE '\\'
            OR COALESCE(spr.data::text, '') ILIKE $1 ESCAPE '\\'
          )

        UNION ALL

        SELECT
          ('respc:' || sprc.id::text) AS hit_id,
          'response' AS hit_type,
          t.slug AS tenant_slug,
          t.name AS tenant_name,
          p.slug AS project_slug,
          p.name AS project_name,
          v.version_id AS version_slug,
          v.published_at::text AS published_at,
          ('Response content · ' || sprc.media_type) AS title,
          LEFT(COALESCE(sprc.inline_schema::text, sprc.examples::text, ''), 400) AS snippet,
          ('response body') AS subtitle
        FROM odb.shared_path_response_content sprc
        JOIN odb.shared_path_response spr ON sprc.shared_path_response_id = spr.id
        JOIN odb.version_path vp ON spr.version_path_id = vp.id
        JOIN odb.versions v ON vp.version_id = v.id
        JOIN odb.projects p ON v.project_id = p.id
        JOIN odb.tenants t ON p.tenant_id = t.id
        WHERE v.published = true
          AND v.visibility = 'public'
          AND t.deleted_at IS NULL
          AND p.deleted_at IS NULL
          AND v.deleted_at IS NULL
          AND (
            COALESCE(sprc.inline_schema::text, '') ILIKE $1 ESCAPE '\\'
            OR COALESCE(sprc.examples::text, '') ILIKE $1 ESCAPE '\\'
          )
      ) hits
      ORDER BY published_at DESC NULLS LAST, hit_type ASC, title ASC
      LIMIT 150`,
      [pattern]
    );
    return result.rows as PublishedCatalogSearchHit[];
  } catch (err) {
    logError('searchPublishedPublicCatalog', err);
    return [];
  }
}

/**
 * Get tenant details by slug.
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
  } catch (err) {
    logError('getPublicTenantBySlug', err);
    return null;
  }
}

/**
 * Get project details by tenant and project slugs.
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
  } catch (err) {
    logError('getPublicProjectBySlug', err);
    return null;
  }
}

/**
 * Recently published public versions across all tenants/projects.
 * Used by the discovery home page.
 */
export async function getRecentlyPublishedVersions(limit = 8) {
  noStore();
  try {
    const result = await connectionPool.query(
      `SELECT v.id, v.version_id, v.description, v.published_at,
              p.name as project_name, p.slug as project_slug, p.description as project_description,
              t.name as tenant_name, t.slug as tenant_slug
       FROM odb.versions v
       JOIN odb.projects p ON v.project_id = p.id
       JOIN odb.tenants t ON p.tenant_id = t.id
       WHERE v.published = true
         AND v.visibility = 'public'
         AND t.deleted_at IS NULL
         AND p.deleted_at IS NULL
         AND v.deleted_at IS NULL
       ORDER BY v.published_at DESC NULLS LAST, v.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  } catch (err) {
    logError('getRecentlyPublishedVersions', err);
    return [];
  }
}

/**
 * Most-versioned public projects (a proxy for "active" projects).
 */
export async function getMostVersionedProjects(limit = 8) {
  noStore();
  try {
    const result = await connectionPool.query(
      `SELECT p.id, p.name, p.slug, p.description,
              t.name as tenant_name, t.slug as tenant_slug,
              COUNT(v.id)::int as version_count,
              MAX(v.published_at) as latest_published_at
       FROM odb.projects p
       JOIN odb.tenants t ON p.tenant_id = t.id
       JOIN odb.versions v ON p.id = v.project_id
       WHERE v.published = true
         AND v.visibility = 'public'
         AND t.deleted_at IS NULL
         AND p.deleted_at IS NULL
         AND v.deleted_at IS NULL
       GROUP BY p.id, p.name, p.slug, p.description, t.name, t.slug
       ORDER BY version_count DESC, latest_published_at DESC NULLS LAST
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  } catch (err) {
    logError('getMostVersionedProjects', err);
    return [];
  }
}

/**
 * Newest public organizations (those with at least one published public version).
 */
export async function getNewestTenants(limit = 8) {
  noStore();
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
       ORDER BY t.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  } catch (err) {
    logError('getNewestTenants', err);
    return [];
  }
}

/**
 * Aggregate counts for the home hero strip.
 */
export async function getDirectoryStats() {
  noStore();
  try {
    const result = await connectionPool.query(
      `SELECT
         COUNT(DISTINCT t.id)::int as tenant_count,
         COUNT(DISTINCT p.id)::int as project_count,
         COUNT(DISTINCT v.id)::int as version_count
       FROM odb.tenants t
       JOIN odb.projects p ON t.id = p.tenant_id
       JOIN odb.versions v ON p.id = v.project_id
       WHERE v.published = true
         AND v.visibility = 'public'
         AND t.deleted_at IS NULL
         AND p.deleted_at IS NULL
         AND v.deleted_at IS NULL`
    );
    return result.rows[0] ?? { tenant_count: 0, project_count: 0, version_count: 0 };
  } catch (err) {
    logError('getDirectoryStats', err);
    return { tenant_count: 0, project_count: 0, version_count: 0 };
  }
}
