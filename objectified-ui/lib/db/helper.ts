'use server';

const connectionPool = require('./db');

export async function getUserIdByEmail(emailAddress: string) {
  return await connectionPool.query('SELECT id FROM odb.users WHERE email = $1', [emailAddress]);
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