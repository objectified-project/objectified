import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createRestAuthHeaders, REST_API_BASE_URL } from '@lib/rest-auth';

type SessionUser = {
  user_id?: string;
  email?: string | null;
  name?: string | null;
  current_tenant_id?: string;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const response = await fetch(`${REST_API_BASE_URL}/repositories/${encodeURIComponent(params.id)}`, {
      method: 'GET',
      headers: createRestAuthHeaders(session.user as SessionUser),
    });
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
