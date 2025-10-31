'use server';

const connectionPool = require('./db');
const bcrypt = require('bcrypt');

export async function getUserByEmail(emailAddress: string) {
  return await connectionPool.query('SELECT * FROM odb.users WHERE email = $1', [emailAddress]);
}

export async function getTenantsForUser(userId: string) {
  const result = await connectionPool.query('SELECT a.* FROM odb.tenants a, odb.tenant_users b WHERE b.user_id = $1 AND a.id = b.tenant_id', [userId]);

  return JSON.stringify(result.rows);
}

export async function getTenantsAdministratedByUser(userId: string) {
  // Get all administrators for tenants where the current user is an admin
  const result = await connectionPool.query(
    `SELECT a.id, a.tenant_id, a.user_id, b.name, b.email 
     FROM odb.tenant_administrators a, odb.users b 
     WHERE b.id = a.user_id 
     AND a.tenant_id IN (
       SELECT tenant_id FROM odb.tenant_administrators WHERE user_id = $1
     )`,
    [userId]
  );

  return JSON.stringify(result.rows);
}

export async function getTenantUsers(tenantId: string) {
  // Get all users for a specific tenant (including administrators)
  const result = await connectionPool.query(
    `SELECT a.id, a.tenant_id, a.user_id, b.name, b.email 
     FROM odb.tenant_users a, odb.users b 
     WHERE b.id = a.user_id 
     AND a.tenant_id = $1`,
    [tenantId]
  );

  return JSON.stringify(result.rows);
}

export async function addTenantAdministrator(tenantId: string, userEmail: string) {
  try {
    // First, get the user by email
    const userResult = await connectionPool.query(
      'SELECT id FROM odb.users WHERE email = $1',
      [userEmail]
    );

    if (userResult.rowCount === 0) {
      return JSON.stringify({ success: false, error: 'User not found' });
    }

    const userId = userResult.rows[0].id;

    // Check if already an admin
    const existingAdmin = await connectionPool.query(
      'SELECT id FROM odb.tenant_administrators WHERE tenant_id = $1 AND user_id = $2',
      [tenantId, userId]
    );

    if (existingAdmin.rowCount > 0) {
      return JSON.stringify({ success: false, error: 'User is already an administrator' });
    }

    // Add to tenant_administrators
    await connectionPool.query(
      'INSERT INTO odb.tenant_administrators (tenant_id, user_id) VALUES ($1, $2)',
      [tenantId, userId]
    );

    // Ensure user is also in tenant_users
    const existingUser = await connectionPool.query(
      'SELECT id FROM odb.tenant_users WHERE tenant_id = $1 AND user_id = $2',
      [tenantId, userId]
    );

    if (existingUser.rowCount === 0) {
      await connectionPool.query(
        'INSERT INTO odb.tenant_users (tenant_id, user_id) VALUES ($1, $2)',
        [tenantId, userId]
      );
    }

    return JSON.stringify({ success: true });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function addTenantUser(tenantId: string, userEmail: string) {
  try {
    // First, get the user by email
    const userResult = await connectionPool.query(
      'SELECT id FROM odb.users WHERE email = $1',
      [userEmail]
    );

    if (userResult.rowCount === 0) {
      return JSON.stringify({ success: false, error: 'User not found' });
    }

    const userId = userResult.rows[0].id;

    // Check if already a member
    const existingUser = await connectionPool.query(
      'SELECT id FROM odb.tenant_users WHERE tenant_id = $1 AND user_id = $2',
      [tenantId, userId]
    );

    if (existingUser.rowCount > 0) {
      return JSON.stringify({ success: false, error: 'User is already a member of this tenant' });
    }

    // Add to tenant_users
    await connectionPool.query(
      'INSERT INTO odb.tenant_users (tenant_id, user_id) VALUES ($1, $2)',
      [tenantId, userId]
    );

    return JSON.stringify({ success: true });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function removeTenantAdministrator(adminRecordId: string) {
  try {
    await connectionPool.query(
      'DELETE FROM odb.tenant_administrators WHERE id = $1',
      [adminRecordId]
    );

    return JSON.stringify({ success: true });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function removeTenantUser(userRecordId: string) {
  try {
    await connectionPool.query(
      'DELETE FROM odb.tenant_users WHERE id = $1',
      [userRecordId]
    );

    return JSON.stringify({ success: true });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function updateUserName(userId: string, name: string) {
  try {
    if (!name || name.trim().length === 0) {
      return JSON.stringify({ success: false, error: 'Name cannot be empty' });
    }

    await connectionPool.query(
      'UPDATE odb.users SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [name.trim(), userId]
    );

    return JSON.stringify({ success: true });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function updateUserPassword(userId: string, currentPassword: string, newPassword: string) {
  try {
    // Validate new password format
    if (!newPassword || newPassword.length < 8) {
      return JSON.stringify({ success: false, error: 'Password must be at least 8 characters long' });
    }

    // Check for uppercase letter
    if (!/[A-Z]/.test(newPassword)) {
      return JSON.stringify({ success: false, error: 'Password must contain at least one uppercase letter' });
    }

    // Check for lowercase letter
    if (!/[a-z]/.test(newPassword)) {
      return JSON.stringify({ success: false, error: 'Password must contain at least one lowercase letter' });
    }

    // Check for number or special character
    if (!/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
      return JSON.stringify({ success: false, error: 'Password must contain at least one number or special character' });
    }

    // Get current password hash from database
    const userResult = await connectionPool.query(
      'SELECT password FROM odb.users WHERE id = $1',
      [userId]
    );

    if (userResult.rowCount === 0) {
      return JSON.stringify({ success: false, error: 'User not found' });
    }

    const currentPasswordHash = userResult.rows[0].password;

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, currentPasswordHash);
    if (!isPasswordValid) {
      return JSON.stringify({ success: false, error: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password in database
    await connectionPool.query(
      'UPDATE odb.users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, userId]
    );

    return JSON.stringify({ success: true });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

// Project Management Functions

export async function getProjectsForTenant(tenantId: string) {
  try {
    const result = await connectionPool.query(
      `SELECT p.*, u.name as creator_name, u.email as creator_email
       FROM odb.projects p
       LEFT JOIN odb.users u ON p.creator_id = u.id
       WHERE p.tenant_id = $1 AND p.deleted_at IS NULL
       ORDER BY p.created_at DESC`,
      [tenantId]
    );

    return JSON.stringify(result.rows);
  } catch (error: any) {
    return JSON.stringify([]);
  }
}

export async function createProject(tenantId: string, creatorId: string, name: string, description: string, slug: string) {
  try {
    if (!name || name.trim().length === 0) {
      return JSON.stringify({ success: false, error: 'Project name is required' });
    }

    if (!slug || slug.trim().length === 0) {
      return JSON.stringify({ success: false, error: 'Project slug is required' });
    }

    // Validate slug format (lowercase, alphanumeric, dashes only)
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug.trim())) {
      return JSON.stringify({ success: false, error: 'Slug must contain only lowercase letters, numbers, and dashes' });
    }

    const result = await connectionPool.query(
      `INSERT INTO odb.projects (tenant_id, creator_id, name, description, slug)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [tenantId, creatorId, name.trim(), description?.trim() || null, slug.trim().toLowerCase()]
    );

    return JSON.stringify({ success: true, project: result.rows[0] });
  } catch (error: any) {
    if (error.code === '23505') { // Unique constraint violation
      return JSON.stringify({ success: false, error: 'A project with this slug already exists in this tenant' });
    }
    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function updateProject(projectId: string, name: string, description: string, slug: string, enabled: boolean) {
  try {
    if (!name || name.trim().length === 0) {
      return JSON.stringify({ success: false, error: 'Project name is required' });
    }

    if (!slug || slug.trim().length === 0) {
      return JSON.stringify({ success: false, error: 'Project slug is required' });
    }

    // Validate slug format (lowercase, alphanumeric, dashes only)
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug.trim())) {
      return JSON.stringify({ success: false, error: 'Slug must contain only lowercase letters, numbers, and dashes' });
    }

    await connectionPool.query(
      `UPDATE odb.projects 
       SET name = $1, description = $2, slug = $3, enabled = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND deleted_at IS NULL`,
      [name.trim(), description?.trim() || null, slug.trim().toLowerCase(), enabled, projectId]
    );

    return JSON.stringify({ success: true });
  } catch (error: any) {
    if (error.code === '23505') { // Unique constraint violation
      return JSON.stringify({ success: false, error: 'A project with this slug already exists in this tenant' });
    }
    return JSON.stringify({ success: false, error: error.message });
  }
}

export async function deleteProject(projectId: string) {
  try {
    // Soft delete - set enabled to false and deleted_at timestamp
    await connectionPool.query(
      `UPDATE odb.projects 
       SET enabled = false, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL`,
      [projectId]
    );

    return JSON.stringify({ success: true });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

// export async function updateLastLogin(userId: string) {
//   return await connectionPool.query('UPDATE odb.user SET last_login = NOW() WHERE id = $1', [userId]);
// }
//
// export async function getTenantsForUser(userId: string) {
//   const result = await connectionPool.query('SELECT a.id, a.name, a.description, a.create_date, a.enabled, a.delete_date FROM odb.tenant a, odb.tenant_user b WHERE a.id = b.tenant_id AND b.user_id=$1', [userId]);
//
//   if (result.rowCount > 0) {
//     return result.rows;
//   }
//
//   return [];
// }
//
// export async function validateTenantForUser(tenantId: string, userId: string) {
//   const result = await connectionPool.query('SELECT * FROM odb.tenant_user WHERE tenant_id = $1 AND user_id = $2', [tenantId, userId]);
//
//   if (result.rowCount > 0) {
//     return true;
//   }
//
//   return false;
// }