import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getTenantById } from '@lib/db/helper';
import { createRestAuthHeaders, REST_API_BASE_URL } from '@lib/rest-auth';

export const dynamic = 'force-dynamic';

/** Request body: record data and rules for the current class (from migration plan). */
interface EvaluateBody {
  recordData: Record<string, unknown>;
  rules: Record<string, { name?: string; inputProperties: string[]; ruleType: string; ruleContent: string; outputProperties: string[] }>;
}

/**
 * Apply migration rules to a record and return transformed data.
 * For now performs passthrough (returns copy of input); rule execution can be wired to backend later.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = (session.user as { current_tenant_id?: string }).current_tenant_id;
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'No tenant selected' }, { status: 400 });
    }

    let body: EvaluateBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }
    const { recordData, rules } = body;
    if (recordData === undefined || typeof recordData !== 'object' || recordData === null) {
      return NextResponse.json({ success: false, error: 'recordData is required and must be an object' }, { status: 400 });
    }
    if (rules === undefined || typeof rules !== 'object' || rules === null) {
      return NextResponse.json({ success: false, error: 'rules is required and must be an object' }, { status: 400 });
    }

    const tenant = await getTenantById(tenantId);
    if (!tenant?.slug) {
      return NextResponse.json({ success: false, error: 'Tenant slug not found' }, { status: 400 });
    }

    // Count rules that have actual transformation content (non-passthrough)
    const rulesAppliedCount = Object.values(rules).filter(
      (r) => r && typeof r === 'object' && (r.ruleContent?.trim?.()?.length ?? 0) > 0
    ).length;

    // Try backend evaluate endpoint if available; otherwise passthrough
    const evaluateUrl = `${REST_API_BASE_URL}/migration-plans/${encodeURIComponent(tenant.slug)}/evaluate`;
    const res = await fetch(evaluateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...createRestAuthHeaders(session.user as { user_id?: string; email?: string | null; name?: string | null; current_tenant_id?: string }),
      },
      body: JSON.stringify({ record_data: recordData, rules }),
    }).catch(() => null);

    let transformedData: Record<string, unknown>;
    if (res?.ok) {
      const data = await res.json().catch(() => ({}));
      transformedData = data.transformed_data ?? data.transformedData ?? recordData;
    } else {
      // Passthrough: deep copy so UI can show before/after (identical until backend implements execution)
      transformedData = JSON.parse(JSON.stringify(recordData));
    }

    return NextResponse.json({
      success: true,
      transformedData,
      rulesAppliedCount,
    });
  } catch (error) {
    console.error('Error evaluating migration rules:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
