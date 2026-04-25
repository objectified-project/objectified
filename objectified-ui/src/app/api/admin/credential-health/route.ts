import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/app/utils/adminAuth';
import { runRepositoryCredentialHealthMonitor } from '@/lib/repositories/token-health-monitor';

/**
 * POST /api/admin/credential-health
 *
 * Triggers the linked-account token health monitor. Intended to be invoked by
 * an external scheduler (e.g. a daily cron job) and protected by admin
 * authentication so that it cannot be called by unprivileged users.
 */
export async function POST() {
  const isAuthenticated = await isAdminAuthenticated();

  if (!isAuthenticated) {
    return NextResponse.json(
      { error: 'Unauthorized access', message: 'Admin authentication required' },
      { status: 401 }
    );
  }

  try {
    const result = await runRepositoryCredentialHealthMonitor();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Credential health monitor failed:', error);
    return NextResponse.json(
      { error: 'Credential health monitor failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
