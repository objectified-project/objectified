'use server';

const connectionPool = require('./db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Helper to standardize error responses
const errorResponse = (error: string) => JSON.stringify({ success: false, error });
const successResponse = (data: any = {}) => JSON.stringify({ success: true, ...data });

export const getUserByEmail = async (emailAddress: string) =>
  connectionPool.query('SELECT * FROM odb.users WHERE email = $1', [emailAddress]);

export const getUserById = async (userId: string) =>
  connectionPool.query('SELECT * FROM odb.users WHERE id = $1 AND deleted_at IS NULL', [userId]);

const emptyStats = {
  total_tenants: 0, admin_tenants: 0, total_projects: 0, created_projects: 0,
  total_versions: 0, created_versions: 0, published_versions: 0, total_classes: 0,
  total_properties: 0, total_class_properties: 0, last_activity: null
};

export async function getDashboardStats(userId: string) {
  try {
    const userTenants = '(SELECT tenant_id FROM odb.tenant_users WHERE user_id = $1)';
    const result = await connectionPool.query(
      `SELECT 
        (SELECT COUNT(DISTINCT tenant_id) FROM odb.tenant_users WHERE user_id = $1) as total_tenants,
        (SELECT COUNT(DISTINCT tenant_id) FROM odb.tenant_administrators WHERE user_id = $1) as admin_tenants,
        (SELECT COUNT(DISTINCT p.id) FROM odb.projects p WHERE p.tenant_id IN ${userTenants} AND p.deleted_at IS NULL) as total_projects,
        (SELECT COUNT(*) FROM odb.projects WHERE creator_id = $1 AND deleted_at IS NULL) as created_projects,
        (SELECT COUNT(DISTINCT v.id) FROM odb.versions v JOIN odb.projects p ON v.project_id = p.id WHERE p.tenant_id IN ${userTenants} AND v.deleted_at IS NULL) as total_versions,
        (SELECT COUNT(*) FROM odb.versions WHERE creator_id = $1 AND deleted_at IS NULL) as created_versions,
        (SELECT COUNT(DISTINCT v.id) FROM odb.versions v JOIN odb.projects p ON v.project_id = p.id WHERE p.tenant_id IN ${userTenants} AND v.published = true AND v.deleted_at IS NULL) as published_versions,
        (SELECT COUNT(DISTINCT c.id) FROM odb.classes c JOIN odb.versions v ON c.version_id = v.id JOIN odb.projects p ON v.project_id = p.id WHERE p.tenant_id IN ${userTenants} AND c.deleted_at IS NULL AND v.deleted_at IS NULL) as total_classes,
        (SELECT COUNT(DISTINCT pr.id) FROM odb.properties pr JOIN odb.projects p ON pr.project_id = p.id WHERE p.tenant_id IN ${userTenants} AND pr.deleted_at IS NULL) as total_properties,
        (SELECT COUNT(DISTINCT cp.id) FROM odb.class_properties cp JOIN odb.classes c ON cp.class_id = c.id JOIN odb.versions v ON c.version_id = v.id JOIN odb.projects p ON v.project_id = p.id WHERE p.tenant_id IN ${userTenants} AND c.deleted_at IS NULL AND v.deleted_at IS NULL) as total_class_properties,
        (SELECT MAX(created_at) FROM (SELECT created_at FROM odb.projects WHERE creator_id = $1 UNION ALL SELECT created_at FROM odb.versions WHERE creator_id = $1 UNION ALL SELECT c.created_at FROM odb.classes c JOIN odb.versions v ON c.version_id = v.id WHERE v.creator_id = $1 AND c.deleted_at IS NULL) activities) as last_activity`,
      [userId]
    );
    return JSON.stringify(result.rows[0]);
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    return JSON.stringify(emptyStats);
  }
}

export async function getRecentActivity(userId: string, limit: number = 10) {
  try {
    const result = await connectionPool.query(
      `SELECT * FROM (
        SELECT 'project' as type, p.id, p.name, p.description, p.created_at, t.name as tenant_name, t.slug as tenant_slug
        FROM odb.projects p JOIN odb.tenants t ON p.tenant_id = t.id
        WHERE p.creator_id = $1 AND p.deleted_at IS NULL
        UNION ALL
        SELECT 'version' as type, v.id, v.version_id as name, v.description, v.created_at, t.name as tenant_name, t.slug as tenant_slug
        FROM odb.versions v JOIN odb.projects p ON v.project_id = p.id JOIN odb.tenants t ON p.tenant_id = t.id
        WHERE v.creator_id = $1 AND v.deleted_at IS NULL
        UNION ALL
        SELECT 'class' as type, c.id, c.name, c.description, c.created_at, t.name as tenant_name, t.slug as tenant_slug
        FROM odb.classes c JOIN odb.versions v ON c.version_id = v.id JOIN odb.projects p ON v.project_id = p.id JOIN odb.tenants t ON p.tenant_id = t.id
        WHERE p.creator_id = $1 AND c.deleted_at IS NULL AND v.deleted_at IS NULL
        UNION ALL
        SELECT 'property' as type, pr.id, pr.name, pr.description, pr.created_at, t.name as tenant_name, t.slug as tenant_slug
        FROM odb.properties pr JOIN odb.projects p ON pr.project_id = p.id JOIN odb.tenants t ON p.tenant_id = t.id
        WHERE p.creator_id = $1 AND pr.deleted_at IS NULL
      ) activities ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );

    return JSON.stringify(result.rows);
  } catch (error: any) {
    console.error('Error fetching recent activity:', error);
    return JSON.stringify([]);
  }
}

export async function getTenantsForUser(userId: string) {
  const result = await connectionPool.query(
    'SELECT a.* FROM odb.tenants a, odb.tenant_users b WHERE b.user_id = $1 AND a.id = b.tenant_id', [userId]);
  return JSON.stringify(result.rows);
}

export async function getTenantsAdministratedByUser(userId: string) {
  const result = await connectionPool.query(
    `SELECT a.id, a.tenant_id, a.user_id, b.name, b.email FROM odb.tenant_administrators a, odb.users b 
     WHERE b.id = a.user_id AND a.tenant_id IN (SELECT tenant_id FROM odb.tenant_administrators WHERE user_id = $1)`,
    [userId]);
  return JSON.stringify(result.rows);
}

export async function getTenantUsers(tenantId: string) {
  const result = await connectionPool.query(
    `SELECT a.id, a.tenant_id, a.user_id, b.name, b.email FROM odb.tenant_users a, odb.users b 
     WHERE b.id = a.user_id AND a.tenant_id = $1`,
    [tenantId]);
  return JSON.stringify(result.rows);
}

export async function addTenantAdministrator(tenantId: string, userEmail: string) {
  try {
    const userResult = await connectionPool.query('SELECT id FROM odb.users WHERE email = $1', [userEmail]);
    if (userResult.rowCount === 0) return errorResponse('User not found');

    const userId = userResult.rows[0].id;
    const existingAdmin = await connectionPool.query(
      'SELECT id FROM odb.tenant_administrators WHERE tenant_id = $1 AND user_id = $2', [tenantId, userId]);
    if (existingAdmin.rowCount > 0) return errorResponse('User is already an administrator');

    await connectionPool.query('INSERT INTO odb.tenant_administrators (tenant_id, user_id) VALUES ($1, $2)', [tenantId, userId]);

    // Ensure user is also in tenant_users
    const existingUser = await connectionPool.query(
      'SELECT id FROM odb.tenant_users WHERE tenant_id = $1 AND user_id = $2', [tenantId, userId]);
    if (existingUser.rowCount === 0) {
      await connectionPool.query('INSERT INTO odb.tenant_users (tenant_id, user_id) VALUES ($1, $2)', [tenantId, userId]);
    }

    return successResponse();
  } catch (error: any) {
    return errorResponse(error.message);
  }
}

export async function addTenantUser(tenantId: string, userEmail: string) {
  try {
    const userResult = await connectionPool.query('SELECT id FROM odb.users WHERE email = $1', [userEmail]);
    if (userResult.rowCount === 0) return errorResponse('User not found');

    const userId = userResult.rows[0].id;
    const existingUser = await connectionPool.query(
      'SELECT id FROM odb.tenant_users WHERE tenant_id = $1 AND user_id = $2', [tenantId, userId]);
    if (existingUser.rowCount > 0) return errorResponse('User is already a member of this tenant');

    await connectionPool.query('INSERT INTO odb.tenant_users (tenant_id, user_id) VALUES ($1, $2)', [tenantId, userId]);
    return successResponse();
  } catch (error: any) {
    return errorResponse(error.message);
  }
}

export async function removeTenantAdministrator(adminRecordId: string) {
  try {
    await connectionPool.query('DELETE FROM odb.tenant_administrators WHERE id = $1', [adminRecordId]);
    return successResponse();
  } catch (error: any) {
    return errorResponse(error.message);
  }
}

export async function removeTenantUser(userRecordId: string) {
  try {
    await connectionPool.query('DELETE FROM odb.tenant_users WHERE id = $1', [userRecordId]);
    return successResponse();
  } catch (error: any) {
    return errorResponse(error.message);
  }
}

const slugRegex = /^[a-z0-9-]+$/;
const generateSlug = (name: string) =>
  name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');

const validateSlug = (slug: string) => {
  if (!slugRegex.test(slug)) return 'Slug must contain only lowercase letters, numbers, and dashes';
  return null;
};

export async function updateTenant(tenantId: string, name: string, description: string, customSlug?: string) {
  try {
    if (!name?.trim()) return errorResponse('Tenant name cannot be empty');

    const slug = customSlug?.trim() || generateSlug(name);
    const slugError = validateSlug(slug);
    if (slugError) return errorResponse(slugError);

    const existingTenant = await connectionPool.query(
      'SELECT id FROM odb.tenants WHERE slug = $1 AND id != $2', [slug, tenantId]);
    if (existingTenant.rowCount > 0) return errorResponse('A tenant with this slug already exists');

    await connectionPool.query(
      'UPDATE odb.tenants SET name = $1, slug = $2, description = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
      [name.trim(), slug, description.trim(), tenantId]);
    return successResponse({ slug });
  } catch (error: any) {
    return errorResponse(error.message);
  }
}

export async function updateUserName(userId: string, name: string) {
  try {
    if (!name?.trim()) return errorResponse('Name cannot be empty');
    await connectionPool.query('UPDATE odb.users SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [name.trim(), userId]);
    return successResponse();
  } catch (error: any) {
    return errorResponse(error.message);
  }
}

const validatePassword = (password: string) => {
  if (!password || password.length < 8) return 'Password must be at least 8 characters long';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return 'Password must contain at least one number or special character';
  return null;
};

export async function updateUserPassword(userId: string, currentPassword: string, newPassword: string) {
  try {
    const validationError = validatePassword(newPassword);
    if (validationError) return errorResponse(validationError);

    const userResult = await connectionPool.query('SELECT password FROM odb.users WHERE id = $1', [userId]);
    if (userResult.rowCount === 0) return errorResponse('User not found');

    const isPasswordValid = await bcrypt.compare(currentPassword, userResult.rows[0].password);
    if (!isPasswordValid) return errorResponse('Current password is incorrect');

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await connectionPool.query('UPDATE odb.users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newPasswordHash, userId]);
    return successResponse();
  } catch (error: any) {
    return errorResponse(error.message);
  }
}

// Project Management Functions

export async function getProjectsForTenant(tenantId: string) {
  try {
    const result = await connectionPool.query(
      `SELECT p.*, u.name as creator_name, u.email as creator_email FROM odb.projects p 
       LEFT JOIN odb.users u ON p.creator_id = u.id WHERE p.tenant_id = $1 AND p.deleted_at IS NULL ORDER BY p.created_at DESC`,
      [tenantId]);
    return JSON.stringify(result.rows);
  } catch (error: any) {
    return JSON.stringify([]);
  }
}

export async function createProject(tenantId: string, creatorId: string, name: string, description: string, slug: string) {
  try {
    if (!name?.trim()) return errorResponse('Project name is required');
    if (!slug?.trim()) return errorResponse('Project slug is required');
    const slugError = validateSlug(slug.trim());
    if (slugError) return errorResponse(slugError);

    const result = await connectionPool.query(
      `INSERT INTO odb.projects (tenant_id, creator_id, name, description, slug) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenantId, creatorId, name.trim(), description?.trim() || null, slug.trim().toLowerCase()]);
    return successResponse({ project: result.rows[0] });
  } catch (error: any) {
    if (error.code === '23505') return errorResponse('A project with this slug already exists in this tenant');
    return errorResponse(error.message);
  }
}

export async function updateProject(projectId: string, name: string, description: string, slug: string, enabled: boolean) {
  try {
    if (!name?.trim()) return errorResponse('Project name is required');
    if (!slug?.trim()) return errorResponse('Project slug is required');
    const slugError = validateSlug(slug.trim());
    if (slugError) return errorResponse(slugError);

    await connectionPool.query(
      `UPDATE odb.projects SET name = $1, description = $2, slug = $3, enabled = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 AND deleted_at IS NULL`,
      [name.trim(), description?.trim() || null, slug.trim().toLowerCase(), enabled, projectId]);
    return successResponse();
  } catch (error: any) {
    if (error.code === '23505') return errorResponse('A project with this slug already exists in this tenant');
    return errorResponse(error.message);
  }
}

export async function deleteProject(projectId: string) {
  try {
    await connectionPool.query(
      `UPDATE odb.projects SET enabled = false, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL`,
      [projectId]);
    return successResponse();
  } catch (error: any) {
    return errorResponse(error.message);
  }
}

// Version Management Functions

export async function getVersionsForProject(projectId: string) {
  try {
    const result = await connectionPool.query(
      `SELECT v.*, u.name as creator_name, u.email as creator_email FROM odb.versions v 
       LEFT JOIN odb.users u ON v.creator_id = u.id WHERE v.project_id = $1 AND v.deleted_at IS NULL ORDER BY v.created_at DESC`,
      [projectId]);
    return JSON.stringify(result.rows);
  } catch (error: any) {
    return JSON.stringify([]);
  }
}

export async function getLatestVersionForProject(projectId: string) {
  try {
    const result = await connectionPool.query(
      `SELECT version_id FROM odb.versions WHERE project_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      [projectId]);
    return result.rowCount > 0 ? result.rows[0].version_id : null;
  } catch (error: any) {
    return null;
  }
}

const parseSemanticVersion = (version: string) => {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? { major: parseInt(match[1], 10), minor: parseInt(match[2], 10), patch: parseInt(match[3], 10) } : null;
};

const bumpMinorVersion = (version: string) => {
  const parsed = parseSemanticVersion(version);
  return parsed ? `${parsed.major}.${parsed.minor + 1}.0` : '0.1.0';
};

const bumpPatchVersion = (version: string) => {
  const parsed = parseSemanticVersion(version);
  return parsed ? `${parsed.major}.${parsed.minor}.${parsed.patch + 1}` : '0.1.0';
};

export async function copyClassesFromVersion(sourceVersionId: string, targetVersionId: string) {
  try {
    // Copy all classes from source version to target version
    const result = await connectionPool.query(
      `INSERT INTO odb.classes (version_id, name, description, schema, enabled)
       SELECT $1, name, description, schema, enabled
       FROM odb.classes
       WHERE version_id = $2 AND deleted_at IS NULL
       RETURNING id, name`,
      [targetVersionId, sourceVersionId]
    );

    const copiedClasses = result.rows;

    // For each copied class, copy its properties
    for (const copiedClass of copiedClasses) {
      // Find the original class by name in the source version
      const originalClassResult = await connectionPool.query(
        `SELECT id FROM odb.classes
         WHERE version_id = $1 AND name = $2 AND deleted_at IS NULL`,
        [sourceVersionId, copiedClass.name]
      );

      if (originalClassResult.rowCount > 0) {
        const originalClassId = originalClassResult.rows[0].id;
        const newClassId = copiedClass.id;

        // Copy all class properties (including parent_id for nested properties)
        // We need to map old property IDs to new ones to maintain parent_id relationships
        
        // First, get all properties from the original class
        const originalPropertiesResult = await connectionPool.query(
          `SELECT id, property_id, name, description, data, parent_id
           FROM odb.class_properties
           WHERE class_id = $1`,
          [originalClassId]
        );

        const oldToNewIdMap = new Map<string, string>();
        const allProperties = originalPropertiesResult.rows;
        const processedIds = new Set<string>();

        // Recursive function to copy properties level by level (breadth-first)
        // This ensures parent properties are created before their children
        const copyPropertiesRecursively = async (parentId: string | null) => {
          // Find all properties with the given parent_id
          const propsAtThisLevel = allProperties.filter(
            (p: any) => (p.parent_id === parentId || (p.parent_id === null && parentId === null)) && !processedIds.has(p.id)
          );

          // Copy each property at this level
          for (const prop of propsAtThisLevel) {
            // Resolve the new parent_id (will be null for top-level, or mapped ID for nested)
            const newParentId = prop.parent_id ? oldToNewIdMap.get(prop.parent_id) || null : null;

            // Insert the property with the updated parent_id
            const insertResult = await connectionPool.query(
              `INSERT INTO odb.class_properties (class_id, property_id, name, description, data, parent_id)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING id`,
              [newClassId, prop.property_id, prop.name, prop.description, prop.data, newParentId]
            );

            // Map the old property ID to the new one
            const newId = insertResult.rows[0].id;
            oldToNewIdMap.set(prop.id, newId);
            processedIds.add(prop.id);

            // Recursively copy children of this property
            await copyPropertiesRecursively(prop.id);
          }
        };

        // Start with top-level properties (parent_id = null)
        await copyPropertiesRecursively(null);
      }
    }

    return JSON.stringify({ success: true, copiedCount: copiedClasses.length });
  } catch (error: any) {
    console.error('Error copying classes from version:', error);
    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function createVersion(projectId: string, creatorId: string, versionId: string | null, description: string, changeLog: string, sourceVersionId?: string | null, bumpStrategy?: 'patch' | 'minor') {
  try {
    let finalVersionId = versionId;

    // If no version ID provided, auto-generate by bumping the latest version
    if (!finalVersionId || finalVersionId.trim().length === 0) {
      const latestVersion = await getLatestVersionForProject(projectId);
      if (latestVersion) {
        // Use the provided bump strategy, default to 'patch' if not specified
        finalVersionId = (bumpStrategy === 'minor')
          ? bumpMinorVersion(latestVersion)
          : bumpPatchVersion(latestVersion);
      } else {
        finalVersionId = '0.1.0';
      }
    }

    // Validate semantic versioning format
    if (!parseSemanticVersion(finalVersionId)) {
      return JSON.stringify({ success: false, error: 'Version ID must follow semantic versioning format (e.g., 1.0.0)' });
    }

    const result = await connectionPool.query(
      `INSERT INTO odb.versions (project_id, creator_id, version_id, description, change_log)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [projectId, creatorId, finalVersionId.trim(), description?.trim() || null, changeLog?.trim() || null]
    );

    const newVersion = result.rows[0];

    // If a source version was provided, copy its classes and properties
    if (sourceVersionId && sourceVersionId.trim().length > 0) {
      const copyResult = await copyClassesFromVersion(sourceVersionId, newVersion.id);
      const copyResponse = JSON.parse(copyResult);

      if (!copyResponse.success) {
        // If copy fails, still return success but include warning
        return JSON.stringify({
          success: true,
          version: newVersion,
          copyWarning: copyResponse.error
        });
      }

      return JSON.stringify({
        success: true,
        version: newVersion,
        copiedClasses: copyResponse.copiedCount
      });
    }

    return JSON.stringify({ success: true, version: newVersion });
  } catch (error: any) {
    if (error.code === '23505') { // Unique constraint violation
      return JSON.stringify({ success: false, error: 'A version with this ID already exists for this project' });
    }
    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function updateVersion(versionRecordId: string, description: string, changeLog: string, enabled: boolean) {
  try {
    // Check if version is published (frozen)
    const versionCheck = await connectionPool.query(
      'SELECT published FROM odb.versions WHERE id = $1 AND deleted_at IS NULL',
      [versionRecordId]
    );

    if (versionCheck.rowCount === 0) {
      return JSON.stringify({ success: false, error: 'Version not found' });
    }

    if (versionCheck.rows[0].published) {
      return JSON.stringify({ success: false, error: 'Cannot edit a published version. Published versions are frozen.' });
    }

    await connectionPool.query(
      `UPDATE odb.versions 
       SET description = $1, change_log = $2, enabled = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND deleted_at IS NULL`,
      [description?.trim() || null, changeLog?.trim() || null, enabled, versionRecordId]
    );

    return JSON.stringify({ success: true });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function publishVersion(versionRecordId: string, userId: string) {
  try {
    const result = await connectionPool.query(
      `UPDATE odb.versions v
       SET published = true, published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE v.id = $1
         AND v.deleted_at IS NULL
         AND (
           v.creator_id = $2
           OR EXISTS (
             SELECT 1
             FROM odb.projects p
             JOIN odb.tenant_administrators ta ON ta.tenant_id = p.tenant_id
             WHERE p.id = v.project_id
               AND ta.user_id = $2
           )
         )`,
      [versionRecordId, userId]
    );

    if (result.rowCount === 0) {
      return JSON.stringify({ success: false, error: 'Only the version owner or a tenant administrator can publish this version' });
    }

    return JSON.stringify({ success: true });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function unpublishVersion(versionRecordId: string, userId: string) {
  try {
    const result = await connectionPool.query(
      `UPDATE odb.versions v
       SET published = false, published_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE v.id = $1
         AND v.deleted_at IS NULL
         AND (
           v.creator_id = $2
           OR EXISTS (
             SELECT 1
             FROM odb.projects p
             JOIN odb.tenant_administrators ta ON ta.tenant_id = p.tenant_id
             WHERE p.id = v.project_id
               AND ta.user_id = $2
           )
         )`,
      [versionRecordId, userId]
    );

    if (result.rowCount === 0) {
      return JSON.stringify({ success: false, error: 'Only the version owner or a tenant administrator can unpublish this version' });
    }

    return JSON.stringify({ success: true });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function getPublishedVersionsForTenant(tenantId: string) {
  try {
    const result = await connectionPool.query(
      `SELECT 
        v.id,
        v.version_id,
        v.description,
        v.visibility,
        v.published_at,
        v.created_at,
        p.id as project_id,
        p.name as project_name,
        p.slug as project_slug,
        t.id as tenant_id,
        t.name as tenant_name,
        t.slug as tenant_slug,
        u.name as creator_name,
        u.email as creator_email
       FROM odb.versions v
       JOIN odb.projects p ON v.project_id = p.id
       JOIN odb.tenants t ON p.tenant_id = t.id
       LEFT JOIN odb.users u ON v.creator_id = u.id
       WHERE p.tenant_id = $1 
         AND v.published = true 
         AND v.deleted_at IS NULL
         AND p.deleted_at IS NULL
         AND t.deleted_at IS NULL
       ORDER BY v.published_at DESC, v.created_at DESC`,
      [tenantId]
    );

    return JSON.stringify(result.rows);
  } catch (error: any) {
    console.error('Error fetching published versions:', error);
    return JSON.stringify([]);
  }
}

export async function updateVersionVisibility(versionRecordId: string, visibility: 'public' | 'private') {
  try {
    await connectionPool.query(
      `UPDATE odb.versions 
       SET visibility = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND deleted_at IS NULL AND published = true`,
      [visibility, versionRecordId]
    );

    return JSON.stringify({ success: true });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function deleteVersion(versionRecordId: string) {
  try {
    // Soft delete - set deleted_at timestamp
    await connectionPool.query(
      `UPDATE odb.versions 
       SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL`,
      [versionRecordId]
    );

    return JSON.stringify({ success: true });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

// Property Management Functions

export async function getPropertiesForProject(projectId: string) {
  try {
    const result = await connectionPool.query(
      `SELECT id, project_id, name, description, data, enabled, created_at, updated_at
       FROM odb.properties
       WHERE project_id = $1 AND deleted_at IS NULL
       ORDER BY name ASC`,
      [projectId]
    );

    return JSON.stringify(result.rows);
  } catch (error: any) {
    console.error('Error fetching properties:', error);
    return JSON.stringify([]);
  }
}

export async function createProperty(projectId: string, name: string, description: string | null, data: any) {
  try {
    if (!name || name.trim().length === 0) {
      return JSON.stringify({ success: false, error: 'Property name is required' });
    }

    if (!data) {
      return JSON.stringify({ success: false, error: 'Property data is required' });
    }

    const result = await connectionPool.query(
      `INSERT INTO odb.properties (project_id, name, description, data)
       VALUES ($1, $2, $3, $4)
       RETURNING id, project_id, name, description, data, enabled, created_at, updated_at`,
      [projectId, name.trim(), description, JSON.stringify(data)]
    );

    return JSON.stringify({ success: true, property: result.rows[0] });
  } catch (error: any) {
    console.error('Error creating property:', error);

    // Handle unique constraint violation (duplicate name in same project)
    if (error.code === '23505') {
      return JSON.stringify({ success: false, error: 'A property with this name already exists in this project' });
    }

    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function updateProperty(propertyId: string, name: string, description: string | null, data: any) {
  try {
    if (!name || name.trim().length === 0) {
      return JSON.stringify({ success: false, error: 'Property name is required' });
    }

    if (!data) {
      return JSON.stringify({ success: false, error: 'Property data is required' });
    }

    const result = await connectionPool.query(
      `UPDATE odb.properties
       SET name = $1, description = $2, data = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND deleted_at IS NULL
       RETURNING id, project_id, name, description, data, enabled, created_at, updated_at`,
      [name.trim(), description, JSON.stringify(data), propertyId]
    );

    if (result.rowCount === 0) {
      return JSON.stringify({ success: false, error: 'Property not found' });
    }

    return JSON.stringify({ success: true, property: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating property:', error);

    // Handle unique constraint violation
    if (error.code === '23505') {
      return JSON.stringify({ success: false, error: 'A property with this name already exists in this project' });
    }

    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function deleteProperty(propertyId: string) {
  try {
    // Soft delete - set deleted_at timestamp
    const result = await connectionPool.query(
      `UPDATE odb.properties
       SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [propertyId]
    );

    if (result.rowCount === 0) {
      return JSON.stringify({ success: false, error: 'Property not found' });
    }

    return JSON.stringify({ success: true });
  } catch (error: any) {
    console.error('Error deleting property:', error);
    return JSON.stringify({ success: false, error: error.message });
  }
}

// Class Management Functions

export async function getClassesForVersion(versionId: string) {
  try {
    const result = await connectionPool.query(
      `SELECT id, version_id, name, description, schema, enabled, created_at, updated_at
       FROM odb.classes
       WHERE version_id = $1 AND deleted_at IS NULL
       ORDER BY name ASC`,
      [versionId]
    );

    return JSON.stringify(result.rows);
  } catch (error: any) {
    console.error('Error fetching classes:', error);
    return JSON.stringify([]);
  }
}

export async function createClass(versionId: string, name: string, description: string | null, schema: any) {
  try {
    if (!name || name.trim().length === 0) {
      return JSON.stringify({ success: false, error: 'Class name is required' });
    }

    if (!schema) {
      return JSON.stringify({ success: false, error: 'Class schema is required' });
    }

    const result = await connectionPool.query(
      `INSERT INTO odb.classes (version_id, name, description, schema)
       VALUES ($1, $2, $3, $4)
       RETURNING id, version_id, name, description, schema, enabled, created_at, updated_at`,
      [versionId, name.trim(), description, JSON.stringify(schema)]
    );

    return JSON.stringify({ success: true, class: result.rows[0] });
  } catch (error: any) {
    console.error('Error creating class:', error);

    // Handle unique constraint violation (duplicate name in same version)
    if (error.code === '23505') {
      return JSON.stringify({ success: false, error: 'A class with this name already exists in this version' });
    }

    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function updateClass(classId: string, name: string, description: string | null, schema: any) {
  try {
    if (!name || name.trim().length === 0) {
      return JSON.stringify({ success: false, error: 'Class name is required' });
    }

    if (!schema) {
      return JSON.stringify({ success: false, error: 'Class schema is required' });
    }

    const result = await connectionPool.query(
      `UPDATE odb.classes
       SET name = $1, description = $2, schema = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND deleted_at IS NULL
       RETURNING id, version_id, name, description, schema, enabled, created_at, updated_at`,
      [name.trim(), description, JSON.stringify(schema), classId]
    );

    if (result.rowCount === 0) {
      return JSON.stringify({ success: false, error: 'Class not found' });
    }

    return JSON.stringify({ success: true, class: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating class:', error);

    // Handle unique constraint violation
    if (error.code === '23505') {
      return JSON.stringify({ success: false, error: 'A class with this name already exists in this version' });
    }

    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function deleteClass(classId: string) {
  try {
    // Soft delete - set deleted_at timestamp
    const result = await connectionPool.query(
      `UPDATE odb.classes
       SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [classId]
    );

    if (result.rowCount === 0) {
      return JSON.stringify({ success: false, error: 'Class not found' });
    }

    return JSON.stringify({ success: true });
  } catch (error: any) {
    console.error('Error deleting class:', error);
    return JSON.stringify({ success: false, error: error.message });
  }
}

// Class-Property Relationship Management Functions

export async function getPropertiesForClass(classId: string) {
  try {
    const result = await connectionPool.query(
      `SELECT cp.id, cp.class_id, cp.property_id, cp.name, cp.description, cp.data, cp.parent_id,
              p.id as property_source_id, p.name as property_source_name
       FROM odb.class_properties cp
       LEFT JOIN odb.properties p ON cp.property_id = p.id
       WHERE cp.class_id = $1
       ORDER BY cp.parent_id NULLS FIRST, cp.name ASC`,
      [classId]
    );

    return JSON.stringify(result.rows);
  } catch (error: any) {
    console.error('Error fetching class properties:', error);
    return JSON.stringify([]);
  }
}

export async function addPropertyToClass(classId: string, propertyId: string | null, name: string, description: string | null, data: any, parentId: string | null = null) {
  try {
    if (!name || name.trim().length === 0) {
      return JSON.stringify({ success: false, error: 'Property name is required' });
    }

    if (!data) {
      return JSON.stringify({ success: false, error: 'Property data is required' });
    }

    // Check if property already exists in this class with the same parent
    const existingCheck = await connectionPool.query(
      'SELECT id FROM odb.class_properties WHERE class_id = $1 AND name = $2 AND (parent_id = $3 OR (parent_id IS NULL AND $3 IS NULL))',
      [classId, name, parentId]
    );

    if (existingCheck.rowCount > 0) {
      return JSON.stringify({ success: false, error: 'A property with this name already exists at this level' });
    }

    const result = await connectionPool.query(
      `INSERT INTO odb.class_properties (class_id, property_id, name, description, data, parent_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, class_id, property_id, name, description, data, parent_id`,
      [classId, propertyId, name.trim(), description, JSON.stringify(data), parentId]
    );

    return JSON.stringify({ success: true, classProperty: result.rows[0] });
  } catch (error: any) {
    console.error('Error adding property to class:', error);

    // Handle unique constraint violation
    if (error.code === '23505') {
      return JSON.stringify({ success: false, error: 'A property with this name already exists at this level' });
    }

    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function updateClassProperty(classPropertyId: string, name: string, description: string | null, data: any) {
  try {
    if (!name || name.trim().length === 0) {
      return JSON.stringify({ success: false, error: 'Property name is required' });
    }

    if (!data) {
      return JSON.stringify({ success: false, error: 'Property data is required' });
    }

    const result = await connectionPool.query(
      `UPDATE odb.class_properties
       SET name = $1, description = $2, data = $3
       WHERE id = $4
       RETURNING id, class_id, property_id, name, description, data, parent_id`,
      [name.trim(), description, JSON.stringify(data), classPropertyId]
    );

    if (result.rowCount === 0) {
      return JSON.stringify({ success: false, error: 'Class property relationship not found' });
    }

    return JSON.stringify({ success: true, classProperty: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating class property:', error);

    // Handle unique constraint violation
    if (error.code === '23505') {
      return JSON.stringify({ success: false, error: 'A property with this name already exists at this level' });
    }

    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function removePropertyFromClass(classPropertyId: string) {
  try {
    const result = await connectionPool.query(
      `DELETE FROM odb.class_properties
       WHERE id = $1
       RETURNING id`,
      [classPropertyId]
    );

    if (result.rowCount === 0) {
      return JSON.stringify({ success: false, error: 'Class property relationship not found' });
    }

    return JSON.stringify({ success: true });
  } catch (error: any) {
    console.error('Error removing property from class:', error);
    return JSON.stringify({ success: false, error: error.message });
  }
}

// OpenAPI Import Functions

export async function importProjectFromOpenAPI(
  tenantId: string,
  creatorId: string,
  projectName: string,
  projectSlug: string,
  projectDescription: string | null,
  versionId: string,
  versionDescription: string | null,
  classes: any[]
) {
  const client = await connectionPool.connect();

  // Helper: deep sort object keys for stable equality checks
  const sortKeysDeep = (value: any): any => {
    if (Array.isArray(value)) {
      return value.map(sortKeysDeep);
    }
    if (value && typeof value === 'object') {
      const sorted: any = {};
      Object.keys(value).sort().forEach((k) => {
        const v = (value as any)[k];
        if (v !== undefined) {
          sorted[k] = sortKeysDeep(v);
        }
      });
      return sorted;
    }
    return value;
  };

  // Helper: stable stringify for equality comparison
  const stableStringify = (obj: any) => JSON.stringify(sortKeysDeep(obj));

  // Helper: remove class-specific flags from root property data (e.g., required)
  const sanitizeRootPropertyData = (data: any): any => {
    if (!data || typeof data !== 'object') return data;
    const clone = JSON.parse(JSON.stringify(data));
    if (typeof clone.required === 'boolean') delete clone.required; // class-level concern only
    return clone;
  };

  const extractRefName = (ref: string | undefined): string | null => {
    if (!ref) return null;
    const parts = ref.split('/');
    return parts[parts.length - 1] || null;
  };

  // Produce a compact alphanumeric type code
  const typeCodeFor = (data: any): string => {
    if (!data || typeof data !== 'object') return 'X';
    if (data.$ref) {
      const refName = extractRefName(data.$ref) || 'Ref';
      return 'R' + refName.replace(/[^A-Za-z0-9]/g, '').slice(0, 20);
    }
    const t = data.type;
    if (t === 'array') {
      const items = data.items || {};
      if (items.$ref) {
        const refName = extractRefName(items.$ref) || 'Ref';
        return 'A' + refName.replace(/[^A-Za-z0-9]/g, '').slice(0, 20);
      }
      if (items.type) {
        return 'A' + String(items.type).replace(/[^A-Za-z0-9]/g, '').slice(0, 20).toUpperCase();
      }
      return 'A';
    }
    if (t) {
      const map: Record<string,string> = {
        string: 'S', integer: 'I', number: 'N', boolean: 'B', object: 'O'
      };
      return map[t] || String(t).replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase() || 'X';
    }
    if (data.oneOf) return 'ONEOF';
    if (data.anyOf) return 'ANYOF';
    if (data.allOf) return 'ALLOF';
    return 'SCHEMA';
  };

  const shortHash = (s: string) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 8).toUpperCase();
  const sanitizeBase = (name: string): string => {
    const cleaned = name.replace(/[^A-Za-z0-9]/g, '');
    return cleaned.length > 0 ? cleaned : 'Property';
  };

  try {
    await client.query('BEGIN');

    // 1. Create project
    const projectResult = await client.query(
      `INSERT INTO odb.projects (tenant_id, creator_id, name, description, slug)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [tenantId, creatorId, projectName.trim(), projectDescription?.trim() || null, projectSlug.trim().toLowerCase()]
    );
    const project = projectResult.rows[0];

    // 2. Create version
    const versionResult = await client.query(
      `INSERT INTO odb.versions (project_id, creator_id, version_id, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [project.id, creatorId, versionId.trim(), versionDescription?.trim() || null]
    );
    const version = versionResult.rows[0];

    // 3. Flatten properties (include nested)
    type PropertyInfo = { name: string; data: any; description?: string; _className?: string };
    const allPropsFlat: PropertyInfo[] = [];
    const collectAll = (props: any[], className: string) => {
      for (const p of props || []) {
        allPropsFlat.push({ name: p.name, data: p.data, description: p.description, _className: className });
        if (p.children && p.children.length) collectAll(p.children, className);
      }
    };
    for (const cls of classes) collectAll(cls.properties || [], cls.name);

    // Helper: check if property data is a reference ($ref at root or items.$ref for arrays)
    const isReference = (data: any): boolean => {
      if (!data || typeof data !== 'object') return false;
      if (data.$ref) return true;
      if (data.type === 'array' && data.items?.$ref) return true;
      return false;
    };

    // Group signatures per original base name (exclude references - they won't go into property library)
    interface SigRecord { canonical: any; sig: string; typeCode: string; original: PropertyInfo; }
    const baseToSigRecords = new Map<string, SigRecord[]>();

    for (const p of allPropsFlat) {
      // Skip references - they will be created directly as class properties
      if (isReference(p.data)) continue;

      const canonical = sanitizeRootPropertyData(p.data);
      const sig = stableStringify(canonical);
      const typeCode = typeCodeFor(canonical);
      const arr = baseToSigRecords.get(p.name) || [];
      // Avoid storing duplicate identical signature records (same schema reused across classes)
      if (!arr.some(r => r.sig === sig)) {
        arr.push({ canonical, sig, typeCode, original: p });
      }
      baseToSigRecords.set(p.name, arr);
    }

    // 4. Decide project-level property names (alphanumeric only)
    const projectNameToData = new Map<string, { canonical: any; description?: string }>();
    const signatureToProjectName = new Map<string, string>(); // sig -> project name

    for (const [baseName, records] of baseToSigRecords.entries()) {
      const multi = records.length > 1;
      const baseSanitized = sanitizeBase(baseName); // sanitized base for naming

      for (const rec of records) {
        let projectPropName: string;
        if (!multi) {
          // Single signature group: prefer base sanitized
            projectPropName = baseSanitized;
            // Collision fallback: if name already taken by different signature, decorate
            if (projectNameToData.has(projectPropName)) {
              const existingSig = Array.from(signatureToProjectName.entries()).find(([s,n]) => n === projectPropName)?.[0];
              if (existingSig && existingSig !== rec.sig) {
                projectPropName = `${baseSanitized}${rec.typeCode}${shortHash(rec.sig)}`.slice(0,255);
              }
            }
        } else {
          // Multiple distinct signatures: decorate with type code + hash
          projectPropName = `${baseSanitized}${rec.typeCode}${shortHash(rec.sig)}`;
          if (projectPropName.length > 255) projectPropName = projectPropName.slice(0,255);
        }

        // Ensure only alphanumeric (sanitization might have left non-alnum from typeCode/hash but both are alnum already)
        projectPropName = projectPropName.replace(/[^A-Za-z0-9]/g, '');

        if (!projectNameToData.has(projectPropName)) {
          projectNameToData.set(projectPropName, { canonical: rec.canonical, description: rec.original.description });
          signatureToProjectName.set(rec.sig, projectPropName);
        } else {
          // If identical signature but different candidate name (rare), reuse existing mapping
          const existingName = signatureToProjectName.get(rec.sig);
          if (!existingName) signatureToProjectName.set(rec.sig, projectPropName);
        }
      }
    }

    // 5. Insert project-level properties (reuse by computed alphanumeric name)
    const propertyIdByProjectName = new Map<string, string>();
    for (const [propName, payload] of projectNameToData.entries()) {
      const insertRes = await client.query(
        `INSERT INTO odb.properties (project_id, name, description, data)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [project.id, propName, payload.description?.trim() || null, JSON.stringify(payload.canonical)]
      );
      propertyIdByProjectName.set(propName, insertRes.rows[0].id);
    }

    // 6. Create classes and link properties (preserve original class property names)
    const linkProperties = async (classId: string, props: any[], parentId: string | null = null) => {
      for (const p of props || []) {
        let propertyId: string | null = null;

        // Check if this is a reference property
        if (isReference(p.data)) {
          // References are created directly as class properties without a property_id
          // They are class-specific relationships, not reusable properties
          propertyId = null;
        } else {
          // Non-reference properties use the property library
          const canonical = sanitizeRootPropertyData(p.data);
          const sig = stableStringify(canonical);
          const projectName = signatureToProjectName.get(sig);
          if (!projectName) continue; // safety
          const pid = propertyIdByProjectName.get(projectName);
          if (!pid) continue;
          propertyId = pid;
        }

        const classPropRes = await client.query(
          `INSERT INTO odb.class_properties (class_id, property_id, name, description, data, parent_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [classId, propertyId, p.name.trim(), p.description?.trim() || null, JSON.stringify(p.data), parentId]
        );

        if (p.children && p.children.length) {
          await linkProperties(classId, p.children, classPropRes.rows[0].id);
        }
      }
    };

    for (const cls of classes) {
      // Use the schema from the class if available, otherwise default to { type: 'object' }
      const schema = cls.schema || { type: 'object' };
      const classRes = await client.query(
        `INSERT INTO odb.classes (version_id, name, description, schema)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [version.id, cls.name.trim(), cls.description?.trim() || null, JSON.stringify(schema)]
      );
      await linkProperties(classRes.rows[0].id, cls.properties || [], null);
    }

    await client.query('COMMIT');
    return JSON.stringify({ success: true, projectId: project.id, versionId: version.id });
  } catch (error: any) {
    try { await client.query('ROLLBACK'); } catch {}

    if (error && error.code === '23505') {
      const msg = (error.detail || error.message || '').toLowerCase();
      if (msg.includes('projects') && msg.includes('slug')) {
        return JSON.stringify({ success: false, error: 'A project with this slug already exists in this tenant' });
      }
      if (msg.includes('versions') && msg.includes('version_id')) {
        return JSON.stringify({ success: false, error: 'A version with this ID already exists for this project' });
      }
      if (msg.includes('properties') && msg.includes('project_id') && msg.includes('name')) {
        return JSON.stringify({ success: false, error: 'A property with this name already exists in this project' });
      }
    }

    return JSON.stringify({ success: false, error: error?.message || 'Failed to import project from OpenAPI' });
  } finally {
    client.release();
  }
}

export async function getApiKeysForTenant(tenantId: string) {
  try {
    const result = await connectionPool.query(
      `SELECT * FROM odb.api_keys 
       WHERE tenant_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [tenantId]
    );

    return JSON.stringify(result.rows);
  } catch (error: any) {
    return JSON.stringify([]);
  }
}

export async function createApiKey(tenantId: string, name: string, description: string, expiresInDays: number | null) {
  try {
    if (!name || name.trim().length === 0) {
      return JSON.stringify({ success: false, error: 'API key name is required' });
    }

    // Generate a random API key
    const apiKey = 'sk_' + crypto.randomBytes(32).toString('hex');
    const keyPrefix = apiKey.substring(0, 12) + '...';

    // Hash the API key for storage
    const saltRounds = 10;
    const keyHash = await bcrypt.hash(apiKey, saltRounds);

    // Calculate expiration date if provided
    let expiresAt = null;
    if (expiresInDays && expiresInDays > 0) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + expiresInDays);
      expiresAt = expirationDate;
    }

    // Insert the API key
    const result = await connectionPool.query(
      `INSERT INTO odb.api_keys (tenant_id, name, description, key_hash, key_prefix, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, key_prefix, created_at`,
      [tenantId, name.trim(), description?.trim() || null, keyHash, keyPrefix, expiresAt]
    );

    // Return the plain API key (only time it will be visible)
    return JSON.stringify({
      success: true,
      apiKey: apiKey,
      id: result.rows[0].id,
      keyPrefix: result.rows[0].key_prefix,
      createdAt: result.rows[0].created_at
    });
  } catch (error: any) {
    if (error.code === '23505') { // Unique constraint violation
      return JSON.stringify({ success: false, error: 'An API key with this name already exists for this tenant' });
    }
    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function deleteApiKey(apiKeyId: string) {
  try {
    // Soft delete the API key
    await connectionPool.query(
      'UPDATE odb.api_keys SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
      [apiKeyId]
    );

    return JSON.stringify({ success: true });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function toggleApiKeyStatus(apiKeyId: string, enabled: boolean) {
  try {
    await connectionPool.query(
      'UPDATE odb.api_keys SET enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [enabled, apiKeyId]
    );

    return JSON.stringify({ success: true });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function updateApiKeyLastUsed(apiKeyId: string) {
  try {
    await connectionPool.query(
      'UPDATE odb.api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1',
      [apiKeyId]
    );

    return JSON.stringify({ success: true });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function validateApiKey(apiKey: string) {
  try {
    // Extract prefix for faster lookup
    const keyPrefix = apiKey.substring(0, 12) + '...';

    // Get all API keys with matching prefix
    const result = await connectionPool.query(
      `SELECT ak.id, ak.tenant_id, ak.key_hash, ak.expires_at, ak.enabled, t.id as tenant_id, t.name as tenant_name
       FROM odb.api_keys ak
       JOIN odb.tenants t ON ak.tenant_id = t.id
       WHERE ak.key_prefix = $1 
       AND ak.deleted_at IS NULL 
       AND ak.enabled = true
       AND t.deleted_at IS NULL
       AND t.enabled = true`,
      [keyPrefix]
    );

    // Check each result to find matching hash
    for (const row of result.rows) {
      const isValid = await bcrypt.compare(apiKey, row.key_hash);

      if (isValid) {
        // Check expiration
        if (row.expires_at && new Date(row.expires_at) < new Date()) {
          return JSON.stringify({ success: false, error: 'API key has expired' });
        }

        // Update last used timestamp
        await updateApiKeyLastUsed(row.id);

        return JSON.stringify({
          success: true,
          tenantId: row.tenant_id,
          tenantName: row.tenant_name,
          apiKeyId: row.id
        });
      }
    }

    return JSON.stringify({ success: false, error: 'Invalid API key' });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function updateClassPropertyRef(classPropertyId: string, targetClassId: string) {
  try {
    // Load current class property data and owning class
    const cpRes = await connectionPool.query(
      `SELECT cp.id, cp.class_id, cp.data
       FROM odb.class_properties cp
       WHERE cp.id = $1`,
      [classPropertyId]
    );
    if (cpRes.rowCount === 0) {
      return JSON.stringify({ success: false, error: 'Class property not found' });
    }

    const classId = cpRes.rows[0].class_id;
    const rawData = cpRes.rows[0].data;
    const data = typeof rawData === 'string' ? JSON.parse(rawData) : (rawData || {});

    // Load target class name for $ref construction
    const clsRes = await connectionPool.query(
      `SELECT name FROM odb.classes WHERE id = $1 AND deleted_at IS NULL`,
      [targetClassId]
    );
    if (clsRes.rowCount === 0) {
      return JSON.stringify({ success: false, error: 'Target class not found' });
    }
    const targetClassName = clsRes.rows[0].name;
    const refPath = `#/components/schemas/${targetClassName}`;

    // Update $ref depending on array vs non-array
    if (data && data.type === 'array') {
      const items = data.items && typeof data.items === 'object' ? { ...data.items } : {};
      // Assign items.$ref and remove conflicting items.type
      items.$ref = refPath;
      if (items.type) delete items.type;
      data.items = items;
    } else {
      // Assign direct $ref and remove conflicting type
      data.$ref = refPath;
      if (data.type) delete data.type;
      // If had inline properties for object, keep them as-is; UI may still allow.
    }

    await connectionPool.query(
      `UPDATE odb.class_properties SET data = $1 WHERE id = $2`,
      [JSON.stringify(data), classPropertyId]
    );

    return JSON.stringify({ success: true, classId });
  } catch (error: any) {
    console.error('Error updating class property $ref:', error);
    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function createSignupRequest(name: string, email: string, password: string, signupSource: string) {
  try {
    // Check if email already exists in signup table
    const existingSignup = await connectionPool.query(
      'SELECT email_address FROM odb.signup WHERE email_address = $1',
      [email]
    );

    if (existingSignup.rowCount > 0) {
      return JSON.stringify({
        success: false,
        duplicate: true,
        message: 'You have already requested account access, thank you for your continued interest!'
      });
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert the signup request
    await connectionPool.query(
      'INSERT INTO odb.signup (name, email_address, password, signup_source) VALUES ($1, $2, $3, $4)',
      [name, email, hashedPassword, signupSource]
    );

    return JSON.stringify({
      success: true,
      message: 'Your signup was accepted, and you will be contacted by a member of the Objectified staff shortly.'
    });
  } catch (error: any) {
    console.error('Error creating signup request:', error);
    return JSON.stringify({ success: false, error: error.message });
  }
}

// External Authentication Provider Functions

export async function getLinkedAccountsForUser(userId: string) {
  try {
    const result = await connectionPool.query(
      `SELECT id, provider, provider_user_id, provider_email, provider_username, 
              created_at, last_login_at
       FROM odb.external_auth_providers
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return JSON.stringify(result.rows);
  } catch (error: any) {
    console.error('Error fetching linked accounts:', error);
    return JSON.stringify([]);
  }
}

export async function linkExternalAccount(
  userId: string,
  provider: string,
  providerUserId: string,
  providerEmail: string,
  providerUsername: string | null,
  accessToken: string | null,
  refreshToken: string | null,
  tokenExpiresAt: Date | null,
  profileData: any
) {
  try {
    // Check if this provider is already linked to this user
    const existingLink = await connectionPool.query(
      'SELECT id FROM odb.external_auth_providers WHERE user_id = $1 AND provider = $2',
      [userId, provider]
    );

    if (existingLink.rowCount > 0) {
      return JSON.stringify({
        success: false,
        error: `You have already linked a ${provider} account`
      });
    }

    // Check if this provider account is already linked to another user
    const existingProviderAccount = await connectionPool.query(
      'SELECT user_id FROM odb.external_auth_providers WHERE provider = $1 AND provider_user_id = $2',
      [provider, providerUserId]
    );

    if (existingProviderAccount.rowCount > 0) {
      return JSON.stringify({
        success: false,
        error: 'This provider account is already linked to another user'
      });
    }

    // Insert the linked account
    const result = await connectionPool.query(
      `INSERT INTO odb.external_auth_providers (
        user_id, provider, provider_user_id, provider_email, provider_username,
        access_token, refresh_token, token_expires_at, profile_data, last_login_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      RETURNING id, provider, provider_username, provider_email`,
      [
        userId,
        provider,
        providerUserId,
        providerEmail,
        providerUsername,
        accessToken,
        refreshToken,
        tokenExpiresAt,
        profileData ? JSON.stringify(profileData) : null
      ]
    );

    return JSON.stringify({
      success: true,
      linkedAccount: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error linking external account:', error);
    if (error.code === '23505') { // Unique constraint violation
      return JSON.stringify({
        success: false,
        error: 'This account is already linked'
      });
    }
    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function unlinkExternalAccount(userId: string, linkedAccountId: string) {
  try {
    // Verify the linked account belongs to this user before deleting
    const result = await connectionPool.query(
      'DELETE FROM odb.external_auth_providers WHERE id = $1 AND user_id = $2 RETURNING provider',
      [linkedAccountId, userId]
    );

    if (result.rowCount === 0) {
      return JSON.stringify({
        success: false,
        error: 'Linked account not found or does not belong to you'
      });
    }

    return JSON.stringify({
      success: true,
      provider: result.rows[0].provider
    });
  } catch (error: any) {
    console.error('Error unlinking external account:', error);
    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function getLinkedAccountByProvider(provider: string, providerUserId: string) {
  try {
    const result = await connectionPool.query(
      `SELECT id, user_id, provider, provider_user_id, provider_email, provider_username,
              access_token, refresh_token, token_expires_at, profile_data,
              created_at, last_login_at
       FROM odb.external_auth_providers
       WHERE provider = $1 AND provider_user_id = $2`,
      [provider, providerUserId]
    );

    if (result.rowCount === 0) {
      return JSON.stringify({ found: false });
    }

    return JSON.stringify({ found: true, account: result.rows[0] });
  } catch (error: any) {
    console.error('Error fetching linked account by provider:', error);
    return JSON.stringify({ found: false, error: error.message });
  }
}

export async function getLinkedAccountByProviderForUser(userId: string, provider: string) {
  try {
    const result = await connectionPool.query(
      `SELECT id, provider, provider_user_id, provider_email, provider_username,
              access_token, refresh_token, token_expires_at, profile_data,
              created_at, last_login_at
       FROM odb.external_auth_providers
       WHERE user_id = $1 AND provider = $2`,
      [userId, provider]
    );

    if (result.rowCount === 0) {
      return JSON.stringify({ found: false });
    }

    return JSON.stringify({ found: true, account: result.rows[0] });
  } catch (error: any) {
    console.error('Error fetching linked account by provider for user:', error);
    return JSON.stringify({ found: false, error: error.message });
  }
}

export async function updateLinkedAccountLastLogin(provider: string, providerUserId: string) {
  try {
    await connectionPool.query(
      `UPDATE odb.external_auth_providers 
       SET last_login_at = CURRENT_TIMESTAMP
       WHERE provider = $1 AND provider_user_id = $2`,
      [provider, providerUserId]
    );

    return JSON.stringify({ success: true });
  } catch (error: any) {
    console.error('Error updating last login:', error);
    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function getLinkedAccountById(accountId: string, userId: string) {
  try {
    const result = await connectionPool.query(
      `SELECT id, user_id, provider, provider_user_id, provider_email, provider_username,
              access_token, refresh_token, token_expires_at, profile_data,
              created_at, last_login_at
       FROM odb.external_auth_providers
       WHERE id = $1 AND user_id = $2`,
      [accountId, userId]
    );

    if (result.rowCount === 0) {
      return JSON.stringify({ found: false, error: 'Account not found or does not belong to user' });
    }

    return JSON.stringify({ found: true, account: result.rows[0] });
  } catch (error: any) {
    console.error('Error fetching linked account by ID:', error);
    return JSON.stringify({ found: false, error: error.message });
  }
}

