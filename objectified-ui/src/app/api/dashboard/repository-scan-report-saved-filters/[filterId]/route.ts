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

type RouteContext = { params: Promise<{ filterId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const user = session.user as SessionUser;
  if (!user.current_tenant_id) {
    return NextResponse.json({ success: false, error: 'No tenant selected' }, { status: 400 });
  }
  const tenant = await getTenantById(user.current_tenant_id);
  if (!tenant?.slug) {
    return NextResponse.json({ success: false, error: 'Tenant slug not found' }, { status: 400 });
  }
  const { filterId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const url = `${REST_API_BASE_URL}/dashboard/${encodeURIComponent(tenant.slug)}/repository_scan_report_saved_filters/${encodeURIComponent(filterId)}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { ...createRestAuthHeaders(user), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const raw = data as { detail?: unknown };
    const d = raw.detail;
    const detailMessage =
      typeof d === 'string'
        ? d
        : d && typeof d === 'object' && d && 'message' in (d as object)
          ? String((d as { message?: string }).message ?? 'Request failed')
          : 'Failed to update filter';
    return NextResponse.json({ success: false, error: detailMessage }, { status: response.status });
  }
  return NextResponse.json({ success: true, data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const user = session.user as SessionUser;
  if (!user.current_tenant_id) {
    return NextResponse.json({ success: false, error: 'No tenant selected' }, { status: 400 });
  }
  const tenant = await getTenantById(user.current_tenant_id);
  if (!tenant?.slug) {
    return NextResponse.json({ success: false, error: 'Tenant slug not found' }, { status: 400 });
  }
  const { filterId } = await context.params;
  const url = `${REST_API_BASE_URL}/dashboard/${encodeURIComponent(tenant.slug)}/repository_scan_report_saved_filters/${encodeURIComponent(filterId)}`;
  const response = await fetch(url, { method: 'DELETE', headers: createRestAuthHeaders(user) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const raw = data as { detail?: unknown };
    const d = raw.detail;
    const detailMessage = typeof d === 'string' ? d : 'Failed to delete filter';
    return NextResponse.json({ success: false, error: detailMessage }, { status: response.status });
  }
  return NextResponse.json({ success: true, data });
}
