import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../auth/[...nextauth]/route';
import { createRestAuthHeaders, REST_API_BASE_URL } from '@lib/rest-auth';

type SessionUser = {
  user_id?: string;
  email?: string | null;
  name?: string | null;
  current_tenant_id?: string;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user?.user_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const headers = createRestAuthHeaders(user);
  try {
    const res = await fetch(`${REST_API_BASE_URL}/users/me/preferences`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    const body = await res.json().catch(() => ({}));
    return NextResponse.json(body, { status: res.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upstream error';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user?.user_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const headers = createRestAuthHeaders(user);
  try {
    const res = await fetch(`${REST_API_BASE_URL}/users/me/preferences`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(json ?? {}),
    });
    const body = await res.json().catch(() => ({}));
    return NextResponse.json(body, { status: res.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upstream error';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
