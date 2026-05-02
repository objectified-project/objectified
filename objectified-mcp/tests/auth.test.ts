import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { resolveMcpKeyViaRest, sha256Hex } from '../src/auth/resolve.js';
import { SessionAuthCache } from '../src/auth/session-cache.js';
import type { AuthRejectReason } from '../src/auth/types.js';

function mockJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('MCP API key resolve (MCP-1.3)', () => {
  const longToken = 'sk_abcdefghijkl012345678901234567890abcdef';

  it('returns KEY_REVOKED from REST payload', async () => {
    const cache = new SessionAuthCache();
    const fetchImpl = mock.fn(async () => mockJsonResponse({ valid: false, reason: 'KEY_REVOKED' }));
    const out = await resolveMcpKeyViaRest(longToken, cache, {
      restBaseUrl: 'http://rest',
      internalSecret: 'sec',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.reason, 'KEY_REVOKED');
  });

  it('returns KEY_EXPIRED from REST payload', async () => {
    const cache = new SessionAuthCache();
    const fetchImpl = mock.fn(async () => mockJsonResponse({ valid: false, reason: 'KEY_EXPIRED' }));
    const out = await resolveMcpKeyViaRest(longToken, cache, {
      restBaseUrl: 'http://rest',
      internalSecret: 'sec',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.reason, 'KEY_EXPIRED');
  });

  it('returns KEY_WRONG_PURPOSE from REST payload', async () => {
    const cache = new SessionAuthCache();
    const fetchImpl = mock.fn(async () => mockJsonResponse({ valid: false, reason: 'KEY_WRONG_PURPOSE' }));
    const out = await resolveMcpKeyViaRest(longToken, cache, {
      restBaseUrl: 'http://rest',
      internalSecret: 'sec',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.reason, 'KEY_WRONG_PURPOSE');
  });

  it('returns KEY_NOT_FOUND when token missing', async () => {
    const cache = new SessionAuthCache();
    const fetchImpl = mock.fn(async () => mockJsonResponse({}));
    const out = await resolveMcpKeyViaRest(undefined, cache, {
      restBaseUrl: 'http://rest',
      internalSecret: 'sec',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.reason, 'KEY_NOT_FOUND');
    assert.equal(fetchImpl.mock.calls.length, 0);
  });

  it('returns KEY_NOT_FOUND when REST HTTP status is not ok', async () => {
    const cache = new SessionAuthCache();
    const fetchImpl = mock.fn(async () => new Response('', { status: 503 }));
    const out = await resolveMcpKeyViaRest(longToken, cache, {
      restBaseUrl: 'http://rest',
      internalSecret: 'sec',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.reason, 'KEY_NOT_FOUND');
  });

  it('caches successful resolve so fetch runs once per token', async () => {
    const cache = new SessionAuthCache();
    let calls = 0;
    const fetchImpl = mock.fn(async () => {
      calls++;
      return mockJsonResponse({
        valid: true,
        user_id: null,
        tenant_id: 'tid',
        scopes: ['read'],
        expires_at: null,
        key_id: 'kid',
      });
    });
    const opts = {
      restBaseUrl: 'http://rest',
      internalSecret: 'sec',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    };
    const first = await resolveMcpKeyViaRest(longToken, cache, opts);
    const second = await resolveMcpKeyViaRest(longToken, cache, opts);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(calls, 1);
  });

  it('happy path maps SessionCtx', async () => {
    const cache = new SessionAuthCache();
    const fetchImpl = mock.fn(async () =>
      mockJsonResponse({
        valid: true,
        user_id: 'usr',
        tenant_id: 'tid',
        scopes: ['x'],
        expires_at: '2099-01-01T00:00:00+00:00',
        key_id: 'kid',
      }),
    );
    const out = await resolveMcpKeyViaRest(longToken, cache, {
      restBaseUrl: 'http://rest',
      internalSecret: 'sec',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    assert.equal(out.ok, true);
    if (!out.ok) return;
    assert.equal(out.ctx.userId, 'usr');
    assert.equal(out.ctx.tenantId, 'tid');
    assert.deepEqual(out.ctx.scopes, ['x']);
    assert.equal(out.ctx.keyId, 'kid');
    assert.equal(out.ctx.expiresAt, '2099-01-01T00:00:00+00:00');
  });

  it('evicts cache entries by key id (Redis revoke hook)', () => {
    const cache = new SessionAuthCache();
    const h = sha256Hex(longToken);
    cache.set(h, {
      userId: null,
      tenantId: 'tid',
      scopes: [],
      expiresAt: null,
      keyId: 'kid',
    });
    assert.ok(cache.get(h));
    cache.evictByKeyId('kid');
    assert.equal(cache.get(h), undefined);
  });

  it('missing internal secret throws before fetch', async () => {
    const cache = new SessionAuthCache();
    await assert.rejects(
      async () =>
        resolveMcpKeyViaRest(longToken, cache, {
          restBaseUrl: 'http://rest',
          internalSecret: '',
          fetchImpl: mock.fn(async () => mockJsonResponse({ valid: true })) as unknown as typeof fetch,
        }),
      /OBJECTIFIED_INTERNAL_API_SECRET/,
    );
  });

  it('covers each AuthRejectReason literal from REST', async () => {
    const reasons: AuthRejectReason[] = [
      'KEY_NOT_FOUND',
      'KEY_REVOKED',
      'KEY_EXPIRED',
      'KEY_WRONG_PURPOSE',
    ];
    for (const reason of reasons) {
      const cache = new SessionAuthCache();
      const fetchImpl = mock.fn(async () => mockJsonResponse({ valid: false, reason }));
      const out = await resolveMcpKeyViaRest(longToken, cache, {
        restBaseUrl: 'http://rest',
        internalSecret: 'sec',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      assert.equal(out.ok, false);
      if (!out.ok) assert.equal(out.reason, reason);
    }
  });
});
