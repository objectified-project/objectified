import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createVersionTag, listVersionTags } from '@lib/db/helper';

/**
 * GET /api/projects/[projectId]/version-tags
 * POST /api/projects/[projectId]/version-tags — body: { name, versionId, message?, channel?, immutable? }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = (session.user as { current_tenant_id?: string }).current_tenant_id;
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'No tenant selected' }, { status: 400 });
    }
    const { projectId } = await params;
    const raw = await listVersionTags(projectId, tenantId);
    const data = JSON.parse(raw) as { success: boolean; tags?: unknown; error?: string; status?: number };
    if (!data.success) {
      const error = data.error?.toLowerCase() ?? '';
      const st =
        typeof data.status === 'number'
          ? data.status
          : error.includes('not found')
            ? 404
            : 500;
      return NextResponse.json(data, { status: st });
    }
    return NextResponse.json({ success: true, tags: data.tags });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = (session.user as { current_tenant_id?: string }).current_tenant_id;
    const userId = (session.user as { user_id?: string }).user_id;
    if (!tenantId || !userId) {
      return NextResponse.json({ success: false, error: 'No tenant or user' }, { status: 400 });
    }
    const { projectId } = await params;
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name : '';
    const versionId = typeof body.versionId === 'string' ? body.versionId : '';
    if (!name.trim() || !versionId.trim()) {
      return NextResponse.json(
        { success: false, error: 'name and versionId are required' },
        { status: 400 }
      );
    }
    const raw = await createVersionTag(projectId, tenantId, name, versionId, userId, {
      message: typeof body.message === 'string' ? body.message : null,
      channel: typeof body.channel === 'string' ? body.channel : null,
      immutable: body.immutable === true,
    });
    const data = JSON.parse(raw) as {
      success: boolean;
      tag?: unknown;
      error?: string;
      code?: string;
    };
    if (!data.success) {
      const status =
        data.code === 'TAG_NAME_CONFLICT' || data.error?.includes('already exists') ? 409 : 400;
      return NextResponse.json(data, { status });
    }
    return NextResponse.json({ success: true, tag: data.tag });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
