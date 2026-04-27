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

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const auth = await resolveAuthContext();
    if ('error' in auth) return auth.error;

    const params = await context.params;
    const body = await request.json().catch(() => ({}));
    const path = [
      'repositories',
      encodeURIComponent(auth.tenantSlug),
      encodeURIComponent(params.id),
      'specs',
      `${encodeURIComponent(params.fileId)}:importNow`,
    ].join('/');

    const response = await fetch(`${REST_API_BASE_URL}/${path}`, {
      method: 'POST',
      headers: {
        ...createRestAuthHeaders(auth.sessionUser),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data.detail;
      if (typeof detail === 'object' && detail !== null && 'message' in detail) {
        return NextResponse.json(
          { success: false, error: (detail as { message?: string }).message, detail },
          { status: response.status },
        );
      }
      const errText = typeof data.detail === 'string' ? data.detail : 'Import Now failed';
      return NextResponse.json(
        { success: false, error: errText, detail: data.detail ?? null },
        { status: response.status },
      );
    }
    return NextResponse.json(
      { success: true, importJobId: (data as { importJobId?: string }).importJobId },
      { status: 202 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
