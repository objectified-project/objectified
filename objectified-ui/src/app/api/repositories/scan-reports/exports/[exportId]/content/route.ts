import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getTenantById } from '@lib/db/helper';
import { REST_API_BASE_URL } from '@lib/rest-auth';

export const dynamic = 'force-dynamic';

type SessionUser = { current_tenant_id?: string };
type RouteCtx = { params: Promise<{ exportId: string }> };

export async function GET(request: NextRequest, ctx: RouteCtx) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') || '';
  if (!token) {
    return NextResponse.json({ success: false, error: 'Missing token' }, { status: 400 });
  }
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
  const { exportId } = await ctx.params;
  const url = `${REST_API_BASE_URL}/repositories/${encodeURIComponent(
    tenant.slug,
  )}/scan-reports/exports/${encodeURIComponent(exportId)}/content?${new URLSearchParams({ token })}`;
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    return NextResponse.json(
      { success: false, error: (await response.text().catch(() => '')) || 'Download failed' },
      { status: response.status },
    );
  }
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const disposition = response.headers.get('content-disposition') || 'attachment';
  return new NextResponse(response.body, {
    status: 200,
    headers: { 'Content-Type': contentType, 'Content-Disposition': disposition },
  });
}
