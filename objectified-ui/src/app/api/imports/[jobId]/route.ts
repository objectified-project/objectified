import { NextRequest } from 'next/server';
import {
  IMPORT_REST_API_BASE_URL,
  mirrorImportUpstreamResponse,
  resolveImportProxySession,
} from '@lib/api/import-rest-proxy-server';

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const ctx = await resolveImportProxySession(request);
  if (!ctx.ok) {
    return ctx.response;
  }

  const { jobId } = await context.params;
  const url = `${IMPORT_REST_API_BASE_URL}/imports/${encodeURIComponent(ctx.tenantSlug)}/${encodeURIComponent(jobId)}`;

  const headers: Record<string, string> = {
    Authorization: ctx.authorizationHeader,
  };
  const inm = request.headers.get('If-None-Match');
  if (inm) {
    headers['If-None-Match'] = inm;
  }
  if (ctx.incomingRequestId) {
    headers['x-request-id'] = ctx.incomingRequestId;
  }

  const upstream = await fetch(url, { method: 'GET', headers });
  return mirrorImportUpstreamResponse(upstream);
}
