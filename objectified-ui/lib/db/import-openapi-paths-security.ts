'use server';

/**
 * Import OpenAPI paths and security schemes into an existing version (#425).
 * Call after importProjectFromOpenAPI when the spec contains paths or components.securitySchemes.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const connectionPool = require('./db');
import type { ParsedPath, ParsedOperation, ParsedSecurityScheme } from '../../src/app/utils/openapi-import';

function getRefSchemaName(ref: string | undefined): string | null {
  if (!ref || typeof ref !== 'string') return null;
  const m = ref.match(/#\/components\/schemas\/(.+)/);
  return m ? m[1] : null;
}

/**
 * Import security schemes into version_security_scheme for the given version.
 */
async function importSecuritySchemes(
  client: any,
  versionId: string,
  schemes: ParsedSecurityScheme[]
): Promise<void> {
  for (const s of schemes) {
    const dataJson = s.data && Object.keys(s.data).length > 0 ? JSON.stringify(s.data) : null;
    await client.query(
      `INSERT INTO odb.version_security_scheme 
       (version_id, scheme_name, scheme_type, in_location, param_name, http_scheme, description, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (version_id, scheme_name) DO UPDATE SET
         scheme_type = EXCLUDED.scheme_type,
         in_location = EXCLUDED.in_location,
         param_name = EXCLUDED.param_name,
         http_scheme = EXCLUDED.http_scheme,
         description = EXCLUDED.description,
         data = EXCLUDED.data,
         updated_at = CURRENT_TIMESTAMP`,
      [
        versionId,
        s.scheme_name,
        s.scheme_type,
        s.in_location ?? null,
        s.param_name ?? null,
        s.http_scheme ?? null,
        s.description ?? null,
        dataJson ?? '{}',
      ]
    );
  }
}

/**
 * Import paths, operations, parameters, request bodies, and responses.
 * Resolves $ref to class_id when the referenced class exists in the version.
 */
export async function importOpenAPIPathsAndSecurity(
  versionId: string,
  paths: ParsedPath[],
  securitySchemes: ParsedSecurityScheme[]
): Promise<{ success: boolean; error?: string }> {
  const client = await connectionPool.connect();
  try {
    await client.query('BEGIN');

    if (securitySchemes.length > 0) {
      await importSecuritySchemes(client, versionId, securitySchemes);
    }

    const classRows = await client.query(
      'SELECT id, name FROM odb.classes WHERE version_id = $1',
      [versionId]
    );
    const classNameToId = new Map<string, string>();
    for (const r of classRows.rows) {
      classNameToId.set(r.name, r.id);
    }

    for (const pathItem of paths) {
      const pathRes = await client.query(
        `INSERT INTO odb.version_path (version_id, pathname, metadata)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [versionId, pathItem.path, pathItem.summary || pathItem.description ? JSON.stringify({ summary: pathItem.summary, description: pathItem.description }) : null]
      );
      const versionPathId = pathRes.rows[0].id;

      const paramIdsByKey = new Map<string, string>();
      if (pathItem.parameters?.length) {
        for (const p of pathItem.parameters) {
          const inLoc = (p.in || 'query') as 'path' | 'query' | 'header' | 'cookie';
          const key = `${p.name}:${inLoc}`;
          const data = p.schema ? { ...p.schema } : { type: 'string' };
          const pr = await client.query(
            `INSERT INTO odb.shared_path_parameter (version_path_id, name, in_location, summary, description, data)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (version_path_id, name, in_location) DO UPDATE SET description = EXCLUDED.description, data = EXCLUDED.data
             RETURNING id`,
            [versionPathId, p.name, inLoc, null, p.description || null, JSON.stringify(data)]
          );
          paramIdsByKey.set(key, pr.rows[0].id);
        }
      }

      for (const op of pathItem.operations) {
        const opRes = await client.query(
          `INSERT INTO odb.path_operation (version_path_id, operation, metadata)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [versionPathId, op.method, op.deprecated ? JSON.stringify({ deprecated: true }) : null]
        );
        const pathOperationId = opRes.rows[0].id;

        await client.query(
          `INSERT INTO odb.path_operation_description (path_operation_id, summary, description, operation_id, metadata)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (path_operation_id) DO UPDATE SET summary = EXCLUDED.summary, description = EXCLUDED.description, operation_id = EXCLUDED.operation_id`,
          [
            pathOperationId,
            op.summary ?? null,
            op.description ?? null,
            op.operationId ?? null,
            op.tags?.length ? JSON.stringify({ tags: op.tags }) : null,
          ]
        );

        const allParams = op.parameters || [];
        for (const p of allParams) {
          const inLoc = (p.in || 'query') as 'path' | 'query' | 'header' | 'cookie';
          const key = `${p.name}:${inLoc}`;
          let paramId = paramIdsByKey.get(key);
          if (!paramId) {
            const data = p.schema ? { ...p.schema } : { type: 'string' };
            const pr = await client.query(
              `INSERT INTO odb.shared_path_parameter (version_path_id, name, in_location, summary, description, data)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING id`,
              [versionPathId, p.name, inLoc, null, p.description || null, JSON.stringify(data)]
            );
            const insertedId = pr.rows[0]?.id;
            if (typeof insertedId !== 'string') throw new Error('Insert shared_path_parameter failed');
            paramId = insertedId;
            paramIdsByKey.set(key, paramId);
          }
          await client.query(
            `INSERT INTO odb.path_operation_parameter_link (path_operation_id, shared_path_parameter_id, metadata)
             VALUES ($1, $2, $3)
             ON CONFLICT (path_operation_id, shared_path_parameter_id) DO NOTHING`,
            [pathOperationId, paramId, null]
          );
        }

        if (op.requestBody?.content && Object.keys(op.requestBody.content).length > 0) {
          const rbRes = await client.query(
            `INSERT INTO odb.shared_path_request_body (version_path_id, name, description, required)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [
              versionPathId,
              `RequestBody_${op.method}_${pathOperationId}`,
              op.requestBody.description ?? null,
              op.requestBody.required === true,
            ]
          );
          const requestBodyId = rbRes.rows[0].id;
          for (const [mediaType, content] of Object.entries(op.requestBody!.content)) {
            const refName = content.$ref ? getRefSchemaName(content.$ref) : null;
            const classId = refName ? classNameToId.get(refName) ?? null : null;
            const inlineSchema = !content.$ref && content.schema
              ? (content.schema.type === 'object' && content.schema.properties
                  ? { type: 'object', properties: Object.entries(content.schema.properties).map(([name, schema]: [string, any]) => ({
                      id: `prop-${name}`,
                      name,
                      data: schema || { type: 'string' },
                      parent_id: null,
                    })) }
                  : { type: (content.schema as any).type || 'object', properties: [] })
              : null;
            if (classId || inlineSchema) {
              await client.query(
                `INSERT INTO odb.shared_path_request_body_content 
                 (shared_path_request_body_id, media_type, class_id, inline_schema)
                 VALUES ($1, $2, $3, $4)`,
                [
                  requestBodyId,
                  mediaType,
                  classId,
                  inlineSchema ? JSON.stringify(inlineSchema) : null,
                ]
              );
            }
          }
          await client.query(
            `INSERT INTO odb.path_operation_request_body_link (path_operation_id, shared_path_request_body_id, metadata)
             VALUES ($1, $2, $3)
             ON CONFLICT (path_operation_id) DO UPDATE SET shared_path_request_body_id = EXCLUDED.shared_path_request_body_id`,
            [pathOperationId, requestBodyId, null]
          );
        }

        if (op.responses && Object.keys(op.responses).length > 0) {
          for (const [statusCode, res] of Object.entries(op.responses)) {
            const content = res.content && Object.keys(res.content).length > 0 ? res.content : { 'application/json': { schema: { type: 'object', properties: [] } } };
            const firstMedia = Object.entries(content)[0];
            if (!firstMedia) continue;
            const [mediaType, mediaObj] = firstMedia;
            const refName = mediaObj?.$ref ? getRefSchemaName(mediaObj.$ref) : null;
            const classId = refName ? classNameToId.get(refName) ?? null : null;
            const inlineSchema = !mediaObj?.$ref && mediaObj?.schema
              ? (mediaObj.schema.type === 'object' && mediaObj.schema.properties
                  ? { type: 'object', properties: Object.entries(mediaObj.schema.properties).map(([name, schema]: [string, any]) => ({
                      id: `prop-${name}`,
                      name,
                      data: schema || { type: 'string' },
                      parent_id: null,
                    })) }
                  : { type: (mediaObj.schema as any).type || 'object', properties: [] })
              : { type: 'object', properties: [] };
            const dataObj: Record<string, unknown> = {};
            if (res.headers && Object.keys(res.headers).length > 0) dataObj.headers = res.headers;
            if (res.links && Object.keys(res.links).length > 0) dataObj.links = res.links;
            const respRes = await client.query(
              `INSERT INTO odb.shared_path_response (version_path_id, status_code, description, data, class_id, inline_schema, schema_mode)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (version_path_id, status_code) DO UPDATE SET description = EXCLUDED.description, data = EXCLUDED.data, class_id = COALESCE(EXCLUDED.class_id, odb.shared_path_response.class_id), inline_schema = COALESCE(EXCLUDED.inline_schema, odb.shared_path_response.inline_schema)
               RETURNING id`,
              [
                versionPathId,
                statusCode,
                res.description ?? null,
                Object.keys(dataObj).length > 0 ? JSON.stringify(dataObj) : null,
                classId ?? null,
                classId ? null : JSON.stringify(inlineSchema),
                classId ? 'class' : 'object',
              ]
            );
            const responseId = respRes.rows[0].id;
            const existingContent = await client.query(
              'SELECT id FROM odb.shared_path_response_content WHERE shared_path_response_id = $1 AND media_type = $2',
              [responseId, mediaType]
            );
            if (existingContent.rows.length === 0) {
              await client.query(
                `INSERT INTO odb.shared_path_response_content (shared_path_response_id, media_type, class_id, inline_schema)
                 VALUES ($1, $2, $3, $4)`,
                [
                  responseId,
                  mediaType,
                  classId,
                  !classId ? JSON.stringify(inlineSchema) : null,
                ]
              );
            }
            await client.query(
              `INSERT INTO odb.path_operation_response_link (path_operation_id, shared_path_response_id, metadata)
               VALUES ($1, $2, $3)
               ON CONFLICT (path_operation_id, shared_path_response_id) DO NOTHING`,
              [pathOperationId, responseId, null]
            );
          }
        }
      }
    }

    await client.query('COMMIT');
    return { success: true };
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    return { success: false, error: err?.message || 'Import paths/security failed' };
  } finally {
    client.release();
  }
}

/**
 * Server action: import paths and security schemes from OpenAPI into an existing version (#566).
 * Call from Paths Designer to capture paths from a pasted/uploaded spec.
 */
export async function importPathsFromOpenAPIForVersion(
  versionId: string,
  paths: ParsedPath[],
  securitySchemes: ParsedSecurityScheme[]
): Promise<{ success: boolean; error?: string }> {
  if (!versionId) {
    return { success: false, error: 'Version is required' };
  }
  if (!paths?.length && !securitySchemes?.length) {
    return { success: false, error: 'Spec has no paths or security schemes to import' };
  }
  return importOpenAPIPathsAndSecurity(versionId, paths || [], securitySchemes || []);
}
