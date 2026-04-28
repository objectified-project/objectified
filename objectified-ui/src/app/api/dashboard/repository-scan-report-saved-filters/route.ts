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

export async function GET() {
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

  const url = `${REST_API_BASE_URL}/dashboard/${encodeURIComponent(tenant.slug)}/repository_scan_report_saved_filters`;
  const response = await fetch(url, { method: 'GET', headers: createRestAuthHeaders(user) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const raw = data as { detail?: unknown };
    const asObj = raw.detail;
    const detailMessage =
      typeof asObj === 'string'
        ? asObj
        : asObj && typeof asObj === 'object' && asObj && 'message' in (asObj as object)
          ? String((asObj as { message?: string }).message ?? 'Request failed')
          : 'Failed to load saved filters';
    return NextResponse.json({ success: false, error: detailMessage }, { status: response.status });
  }
  return NextResponse.json({ success: true, data });
}

export async function POST(request: Request) {
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

  const body = await request.json().catch(() => ({}));
  const url = `${REST_API_BASE_URL}/dashboard/${encodeURIComponent(tenant.slug)}/repository_scan_report_saved_filters`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { ...createRestAuthHeaders(user), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const raw = data as { detail?: { code?: string; message?: string } | string };
    const d = raw.detail;
    if (response.status === 400 && d && typeof d === 'object' && d.code === 'SAVED_FILTER_LIMIT_REACHED') {
      return NextResponse.json(
        { success: false, error: d.message ?? 'Maximum saved filters reached', code: d.code },
        { status: 400 },
      );
    }
    const detailMessage =
      typeof d === 'string'
        ? d
        : d && typeof d === 'object' && 'message' in d
          ? String(d.message ?? 'Request failed')
          : 'Failed to save filter';
    return NextResponse.json({ success: false, error: detailMessage }, { status: response.status });
  }
  return NextResponse.json({ success: true, data });
}
