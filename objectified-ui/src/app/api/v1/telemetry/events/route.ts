import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';

const ALLOWED = new Set(['developer_mode.toggled']);

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { user_id?: string } | undefined;
  if (!user?.user_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const rec = body as Record<string, unknown>;
  const event = rec.event;
  const properties = rec.properties;
  if (typeof event !== 'string' || !ALLOWED.has(event)) {
    return NextResponse.json({ error: 'Unknown or missing event' }, { status: 400 });
  }
  if (properties !== undefined && (typeof properties !== 'object' || properties === null || Array.isArray(properties))) {
    return NextResponse.json({ error: 'Invalid properties' }, { status: 400 });
  }

  const props = (properties ?? {}) as Record<string, unknown>;
  if (event === 'developer_mode.toggled') {
    const from = props.from;
    const to = props.to;
    if (from !== 'off' && from !== 'on') {
      return NextResponse.json({ error: 'developer_mode.toggled requires properties.from' }, { status: 400 });
    }
    if (to !== 'off' && to !== 'on') {
      return NextResponse.json({ error: 'developer_mode.toggled requires properties.to' }, { status: 400 });
    }
  }

  console.info('[telemetry]', JSON.stringify({ userId: user.user_id, event, properties: props }));
  return new NextResponse(null, { status: 204 });
}
