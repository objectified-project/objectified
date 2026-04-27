import { NextRequest, NextResponse } from 'next/server';
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

export async function POST(request: NextRequest) {
  try {
    const auth = await resolveAuthContext();
    if ('error' in auth) return auth.error;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const url = `${REST_API_BASE_URL}/repositories/${encodeURIComponent(
      auth.tenantSlug,
    )}/scan-reports:export`;

    const response = await fetch(url, {
      method: 'POST',
      headers: createRestAuthHeaders(auth.sessionUser),
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const d = data as { detail?: unknown; message?: string };
      if (d.detail && typeof d.detail === 'object' && d.detail && 'code' in (d.detail as object)) {
        return NextResponse.json({ success: false, error: d.detail, status: response.status }, { status: response.status });
      }
      return NextResponse.json(
        { success: false, error: typeof d.detail === 'string' ? d.detail : 'Export failed' },
        { status: response.status },
      );
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
