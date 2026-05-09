/**
 * Browser client for `/api/imports` proxies (REST-backed spec import jobs).
 */

export type ImportJobStatusPayload = {
  jobId: string;
  state: string;
  percent: number;
  events?: Array<Record<string, unknown>>;
  progress?: unknown;
  summary?: Record<string, unknown> | null;
  result?: unknown;
  transactionPending?: boolean;
  error?: unknown;
};

function extractErrorDetail(data: unknown): string | undefined {
  if (data == null) return undefined;
  if (typeof data === 'string') return data;
  if (typeof data !== 'object') return undefined;
  const d = data as Record<string, unknown>;
  const detail = d.detail;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object') {
    const o = detail as Record<string, unknown>;
    if (typeof o.message === 'string') return o.message;
  }
  if (typeof d.message === 'string') return d.message;
  return undefined;
}

async function parseJsonBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function postImportJob(
  body: unknown,
  init?: { idempotencyKey?: string; signal?: AbortSignal }
): Promise<{ jobId: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init?.idempotencyKey) {
    headers['Idempotency-Key'] = init.idempotencyKey;
  }
  const res = await fetch('/api/imports', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: init?.signal,
  });
  const data = await parseJsonBody(res);
  if (!res.ok) {
    throw new Error(extractErrorDetail(data) ?? `Import start failed (${res.status})`);
  }
  const jobId = (data as { jobId?: string })?.jobId;
  if (!jobId) {
    throw new Error('Import start succeeded but response missing jobId');
  }
  return { jobId };
}

export async function getImportJobStatus(jobId: string): Promise<ImportJobStatusPayload> {
  const res = await fetch(`/api/imports/${encodeURIComponent(jobId)}`);
  const data = await parseJsonBody(res);
  if (!res.ok) {
    throw new Error(extractErrorDetail(data) ?? `Import status failed (${res.status})`);
  }
  return data as ImportJobStatusPayload;
}

export async function postImportCancel(jobId: string): Promise<ImportJobStatusPayload> {
  const res = await fetch(`/api/imports/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST',
  });
  const data = await parseJsonBody(res);
  if (!res.ok) {
    throw new Error(extractErrorDetail(data) ?? `Import cancel failed (${res.status})`);
  }
  return data as ImportJobStatusPayload;
}

export async function postImportCommit(jobId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/imports/${encodeURIComponent(jobId)}/commit`, {
    method: 'POST',
  });
  if (res.ok) {
    return { ok: true };
  }
  const data = await parseJsonBody(res);
  return { ok: false, error: extractErrorDetail(data) ?? `Commit failed (${res.status})` };
}

export async function postImportRollback(jobId: string): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`/api/imports/${encodeURIComponent(jobId)}/rollback`, {
    method: 'POST',
  });
  if (res.ok) {
    return { success: true };
  }
  const data = await parseJsonBody(res);
  return { success: false, error: extractErrorDetail(data) ?? `Rollback failed (${res.status})` };
}
