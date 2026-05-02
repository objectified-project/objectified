export type AuthRejectReason = 'KEY_NOT_FOUND' | 'KEY_REVOKED' | 'KEY_EXPIRED' | 'KEY_WRONG_PURPOSE';

export type SessionCtx = {
  userId: string | null;
  tenantId: string;
  scopes: string[];
  expiresAt: string | null;
  keyId: string;
};

export type McpResolveOutcome =
  | { ok: true; ctx: SessionCtx }
  | { ok: false; reason: AuthRejectReason };
