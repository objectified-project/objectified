import type { IncomingMessage } from 'node:http';

/**
 * API key used against objectified-rest (HTTP header or stdio env).
 */
export function resolveApiKeyFromEnv(): string | undefined {
  const key = process.env.OBJECTIFIED_MCP_KEY;
  return key?.trim() || undefined;
}

/** `Authorization: Bearer <token>` when present (Streamable HTTP). */
export function parseBearerAuthorization(req: IncomingMessage): string | undefined {
  const raw = req.headers.authorization ?? req.headers.Authorization;
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || !v.startsWith('Bearer ')) return undefined;
  const t = v.slice('Bearer '.length).trim();
  return t || undefined;
}

export function resolveRestBaseUrl(): string {
  const raw = process.env.OBJECTIFIED_REST_URL?.trim();
  if (raw) return raw.replace(/\/$/, '');
  return 'http://127.0.0.1:8000';
}
