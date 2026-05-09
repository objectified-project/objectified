import { NextRequest } from 'next/server';
import {
  IMPORT_REST_API_BASE_URL,
  mirrorImportUpstreamResponse,
  resolveImportProxySession,
} from '@lib/api/import-rest-proxy-server';

export async function POST(request: NextRequest) {
  const ctx = await resolveImportProxySession(request);
  if (!ctx.ok) {
    return ctx.response;
  }

  const url = `${IMPORT_REST_API_BASE_URL}/imports/${encodeURIComponent(ctx.tenantSlug)}`;
  const headers: Record<string, string> = {
    Authorization: ctx.authorizationHeader,
    'Content-Type': request.headers.get('content-type') || 'application/json',
  };
  const idem = request.headers.get('Idempotency-Key');
  if (idem) {
    headers['Idempotency-Key'] = idem;
  }
  if (ctx.incomingRequestId) {
    headers['x-request-id'] = ctx.incomingRequestId;
  }

  const bodyText = await request.text();
  const upstream = await fetch(url, {
    method: 'POST',
    headers,
    body: bodyText.length > 0 ? bodyText : undefined,
  });

  return mirrorImportUpstreamResponse(upstream);
}
