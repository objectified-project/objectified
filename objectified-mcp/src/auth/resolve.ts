import { createHash } from 'node:crypto';

import type { SessionAuthCache } from './session-cache.js';
import type { AuthRejectReason, McpResolveOutcome, SessionCtx } from './types.js';

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

type ResolveJson =
  | { valid: true; user_id: string | null; tenant_id: string; scopes: string[]; expires_at: string | null; key_id: string }
  | { valid: false; reason: AuthRejectReason };

function mapCtx(body: Extract<ResolveJson, { valid: true }>): SessionCtx {
  return {
    userId: body.user_id,
    tenantId: body.tenant_id,
    scopes: body.scopes ?? [],
    expiresAt: body.expires_at,
    keyId: body.key_id,
  };
}

export async function resolveMcpKeyViaRest(
  token: string | undefined,
  cache: SessionAuthCache,
  options: {
    restBaseUrl: string;
    internalSecret: string;
    fetchImpl?: typeof fetch;
  },
): Promise<McpResolveOutcome> {
  if (!options.internalSecret) {
    throw new Error('OBJECTIFIED_INTERNAL_API_SECRET is not set; cannot resolve MCP API keys');
  }
  if (!token?.trim()) {
    return { ok: false, reason: 'KEY_NOT_FOUND' };
  }
  const raw = token.trim();
  const tokenHash = sha256Hex(raw);

  const cached = cache.get(tokenHash);
  if (cached) {
    return { ok: true, ctx: cached };
  }

  const fetchFn = options.fetchImpl ?? fetch;
  const url = `${options.restBaseUrl.replace(/\/$/, '')}/v1/internal/api_keys/resolve`;
  const res = await fetchFn(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Objectified-Internal-Secret': options.internalSecret,
    },
    body: JSON.stringify({ token: raw, purpose: 'mcp' }),
  });

  if (!res.ok) {
    return { ok: false, reason: 'KEY_NOT_FOUND' };
  }

  const body = (await res.json()) as ResolveJson;
  if (!body || typeof body !== 'object' || !('valid' in body)) {
    return { ok: false, reason: 'KEY_NOT_FOUND' };
  }
  if (!body.valid) {
    const r = 'reason' in body ? body.reason : 'KEY_NOT_FOUND';
    return { ok: false, reason: r };
  }

  const ctx = mapCtx(body);
  cache.set(tokenHash, ctx);
  return { ok: true, ctx };
}
