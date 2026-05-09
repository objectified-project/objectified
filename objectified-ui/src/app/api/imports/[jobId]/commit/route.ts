import { NextRequest } from 'next/server';
import {
  IMPORT_REST_API_BASE_URL,
  mirrorImportUpstreamResponse,
  resolveImportProxySession,
} from '@lib/api/import-rest-proxy-server';

type RouteContext = { params: Promise<{ jobId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const ctx = await resolveImportProxySession(request);
  if (!ctx.ok) {
    return ctx.response;
  }

  const { jobId } = await context.params;
  const url = `${IMPORT_REST_API_BASE_URL}/imports/${encodeURIComponent(ctx.tenantSlug)}/${encodeURIComponent(jobId)}/commit`;

  const headers: Record<string, string> = {
    Authorization: ctx.authorizationHeader,
  };
  if (ctx.incomingRequestId) {
    headers['x-request-id'] = ctx.incomingRequestId;
  }

  const upstream = await fetch(url, { method: 'POST', headers });
  return mirrorImportUpstreamResponse(upstream);
}
