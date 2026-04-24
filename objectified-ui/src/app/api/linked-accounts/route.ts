import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getLinkedAccountsForUser } from '@lib/db/helper';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as { user_id?: string }).user_id;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'No user id in session' }, { status: 400 });
    }
    const raw = await getLinkedAccountsForUser(userId);
    return NextResponse.json({ success: true, accounts: JSON.parse(raw) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load linked accounts';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
