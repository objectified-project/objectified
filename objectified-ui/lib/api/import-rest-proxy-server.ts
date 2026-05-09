import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import jwt from 'jsonwebtoken';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getTenantById } from '@lib/db/helper';

export const IMPORT_REST_API_BASE_URL =
  process.env.NEXT_PUBLIC_REST_API_BASE_URL || 'http://localhost:8000/v1';

interface SessionUser {
  user_id?: string;
  email?: string | null;
  name?: string | null;
  current_tenant_id?: string;
}

export type ImportProxyFailure = { ok: false; response: NextResponse };
export type ImportProxySuccess = {
  ok: true;
  tenantSlug: string;
  authorizationHeader: string;
  incomingRequestId: string | undefined;
};

function sessionUnauthorized(message: string, status: number): ImportProxyFailure {
  return {
    ok: false,
    response: NextResponse.json({ detail: message }, { status }),
  };
}

export async function resolveImportProxySession(request: NextRequest): Promise<ImportProxyFailure | ImportProxySuccess> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return sessionUnauthorized('Unauthorized', 401);
  }

  const user = session.user as SessionUser;
  const tenantId = user.current_tenant_id;
  if (!tenantId) {
    return sessionUnauthorized('No tenant selected', 400);
  }

  const tenant = await getTenantById(tenantId);
  if (!tenant?.slug) {
    return sessionUnauthorized('Tenant not found', 404);
  }

  if (!user.user_id) {
    return sessionUnauthorized('Unauthorized', 401);
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return sessionUnauthorized('Authentication misconfigured', 500);
  }

  const encodedToken = jwt.sign(
    {
      user_id: user.user_id,
      sub: user.user_id,
      email: session.user.email,
      name: session.user.name,
      current_tenant_id: tenantId,
    },
    secret,
    { algorithm: 'HS256', expiresIn: '1h' }
  );

  const incomingRequestId = request.headers.get('x-request-id') ?? undefined;

  return {
    ok: true,
    tenantSlug: tenant.slug,
    authorizationHeader: `Bearer ${encodedToken}`,
    incomingRequestId,
  };
}

export function forwardImportUpstreamHeaders(upstream: Response): Headers {
  const out = new Headers();
  const ct = upstream.headers.get('content-type');
  if (ct) {
    out.set('content-type', ct);
  }
  const etag = upstream.headers.get('etag');
  if (etag) {
    out.set('etag', etag);
  }
  const xrid = upstream.headers.get('x-request-id');
  if (xrid) {
    out.set('x-request-id', xrid);
  }
  return out;
}

export async function mirrorImportUpstreamResponse(upstream: Response): Promise<NextResponse> {
  const headers = forwardImportUpstreamHeaders(upstream);
  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, { status: upstream.status, headers });
}
