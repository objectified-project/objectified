import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createRestAuthHeaders, REST_API_BASE_URL } from '@lib/rest-auth';

export type DeveloperModeServerSnapshot = {
  signedIn: boolean;
  entitled: boolean;
  planCode: string | null;
  developerModeEnabled: boolean;
};

function readEnabled(prefs: unknown): boolean {
  if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) return false;
  const v = (prefs as Record<string, unknown>).developerModeEnabled;
  return v === true;
}

export async function fetchDeveloperModeServerSnapshot(): Promise<DeveloperModeServerSnapshot> {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { user_id?: string; email?: string | null; name?: string | null; current_tenant_id?: string }
    | undefined;
  if (!session?.user || !user?.user_id) {
    return { signedIn: false, entitled: false, planCode: null, developerModeEnabled: false };
  }

  const headers = createRestAuthHeaders({
    user_id: user.user_id,
    email: user.email,
    name: user.name,
    current_tenant_id: user.current_tenant_id,
  });

  try {
    const [entRes, prefRes] = await Promise.all([
      fetch(`${REST_API_BASE_URL}/entitlements/developer-mode`, { headers, cache: 'no-store' }),
      fetch(`${REST_API_BASE_URL}/users/me/preferences`, { headers, cache: 'no-store' }),
    ]);

    let entitled = false;
    let planCode: string | null = null;
    if (entRes.ok) {
      const ent = (await entRes.json().catch(() => null)) as Record<string, unknown> | null;
      if (ent && typeof ent === 'object') {
        entitled = ent.allowed === true;
        const pc = ent.planCode;
        planCode = typeof pc === 'string' ? pc : pc == null ? null : String(pc);
      }
    }

    let developerModeEnabled = false;
    if (prefRes.ok) {
      const body = (await prefRes.json().catch(() => null)) as Record<string, unknown> | null;
      const prefs = body && typeof body === 'object' && 'preferences' in body ? body.preferences : null;
      developerModeEnabled = readEnabled(prefs);
    }

    if (!entitled && developerModeEnabled) {
      developerModeEnabled = false;
    }

    return { signedIn: true, entitled, planCode, developerModeEnabled };
  } catch {
    return { signedIn: true, entitled: false, planCode: null, developerModeEnabled: false };
  }
}
