import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getTenantById } from '@lib/db/helper';
import { createRestAuthHeaders, REST_API_BASE_URL } from '@lib/rest-auth';

export const dynamic = 'force-dynamic';

type SessionUser = {
  user_id?: string;
  email?: string | null;
  name?: string | null;
  current_tenant_id?: string;
};

async function resolveAuthContext() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }
  const user = session.user as SessionUser;
  if (!user.current_tenant_id) {
    return { error: NextResponse.json({ success: false, error: 'No tenant selected' }, { status: 400 }) };
  }
  const tenant = await getTenantById(user.current_tenant_id);
  if (!tenant?.slug) {
    return { error: NextResponse.json({ success: false, error: 'Tenant slug not found' }, { status: 400 }) };
  }
  return { sessionUser: user, tenantSlug: tenant.slug };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await resolveAuthContext();
    if ('error' in auth) return auth.error;

    const params = await context.params;
    const response = await fetch(
      `${REST_API_BASE_URL}/repositories/${encodeURIComponent(auth.tenantSlug)}/${encodeURIComponent(params.id)}`,
      {
        method: 'GET',
        headers: createRestAuthHeaders(auth.sessionUser),
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = typeof data.detail === 'string' ? data.detail : 'Failed to load repository';
      return NextResponse.json({ success: false, error: detail }, { status: response.status });
    }
    return NextResponse.json({ success: true, repository: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await resolveAuthContext();
    if ('error' in auth) return auth.error;

    const params = await context.params;
    const body = await request.json();
    const isBranchUpdate = Array.isArray(body?.branches);
    const targetPath = isBranchUpdate
      ? `${REST_API_BASE_URL}/repositories/${encodeURIComponent(auth.tenantSlug)}/${encodeURIComponent(params.id)}/branches`
      : `${REST_API_BASE_URL}/repositories/${encodeURIComponent(auth.tenantSlug)}/${encodeURIComponent(params.id)}`;
    const response = await fetch(targetPath, {
      method: 'PATCH',
      headers: createRestAuthHeaders(auth.sessionUser),
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail =
        typeof data.detail === 'string'
          ? data.detail
          : isBranchUpdate
            ? 'Failed to update repository branches'
            : 'Failed to update repository';
      return NextResponse.json({ success: false, error: detail }, { status: response.status });
    }
    return NextResponse.json({ success: true, repository: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await resolveAuthContext();
    if ('error' in auth) return auth.error;

    const params = await context.params;
    const body = await request.json();
    const response = await fetch(
      `${REST_API_BASE_URL}/repositories/${encodeURIComponent(auth.tenantSlug)}/${encodeURIComponent(params.id)}`,
      {
        method: 'DELETE',
        headers: createRestAuthHeaders(auth.sessionUser),
        body: JSON.stringify(body),
      }
    );
    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = typeof data.detail === 'string' ? data.detail : 'Failed to delete repository';
      return NextResponse.json({ success: false, error: detail }, { status: response.status });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
