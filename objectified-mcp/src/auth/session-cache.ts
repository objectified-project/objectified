import type { SessionCtx } from './types.js';

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export class SessionAuthCache {
  private readonly byHash = new Map<string, { ctx: SessionCtx; expiresAt: number }>();
  private readonly keyIdToHashes = new Map<string, Set<string>>();
  private readonly ttlMs: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  get(tokenHash: string): SessionCtx | undefined {
    const row = this.byHash.get(tokenHash);
    if (!row) return undefined;
    if (Date.now() >= row.expiresAt) {
      this.evictTokenHash(tokenHash);
      return undefined;
    }
    return row.ctx;
  }

  set(tokenHash: string, ctx: SessionCtx): void {
    const expiresAt = Date.now() + this.ttlMs;
    this.byHash.set(tokenHash, { ctx, expiresAt });
    let set = this.keyIdToHashes.get(ctx.keyId);
    if (!set) {
      set = new Set();
      this.keyIdToHashes.set(ctx.keyId, set);
    }
    set.add(tokenHash);
  }

  evictTokenHash(tokenHash: string): void {
    const entry = this.byHash.get(tokenHash);
    this.byHash.delete(tokenHash);
    if (!entry) return;
    const set = this.keyIdToHashes.get(entry.ctx.keyId);
    if (set) {
      set.delete(tokenHash);
      if (set.size === 0) this.keyIdToHashes.delete(entry.ctx.keyId);
    }
  }

  evictByKeyId(keyId: string): void {
    const set = this.keyIdToHashes.get(keyId);
    if (!set) return;
    for (const h of set) {
      this.byHash.delete(h);
    }
    this.keyIdToHashes.delete(keyId);
  }
}
