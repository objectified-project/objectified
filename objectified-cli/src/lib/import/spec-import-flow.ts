import type { ObjectifiedApi, SpecImportJobStatus } from "../client.js";

const POLL_MS = [400, 800, 1600, 3200, 6400, 12_800];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pollDelayMs(attempt: number): number {
  const idx = Math.min(Math.max(attempt, 0), POLL_MS.length - 1);
  return POLL_MS[idx] ?? 12_800;
}

/** Poll until the job needs finalize, ends successfully without approval, or fails. */
export async function pollSpecImportUntilGate(opts: {
  api: Pick<ObjectifiedApi, "getSpecImportStatus">;
  tenantSlug: string;
  jobId: string;
  signal?: AbortSignal;
}): Promise<SpecImportJobStatus> {
  let attempt = 0;
  for (;;) {
    opts.signal?.throwIfAborted();
    const st = await opts.api.getSpecImportStatus(opts.tenantSlug, opts.jobId);
    if (
      st.state === "pending-approval" ||
      st.state === "completed" ||
      st.state === "failed" ||
      st.state === "canceled" ||
      st.state === "rolled-back"
    ) {
      return st;
    }
    await sleep(pollDelayMs(attempt));
    attempt++;
  }
}

/** Poll until a terminal lifecycle state (includes rolled-back). */
export async function pollSpecImportUntilTerminal(opts: {
  api: Pick<ObjectifiedApi, "getSpecImportStatus">;
  tenantSlug: string;
  jobId: string;
  signal?: AbortSignal;
}): Promise<SpecImportJobStatus> {
  let attempt = 0;
  for (;;) {
    opts.signal?.throwIfAborted();
    const st = await opts.api.getSpecImportStatus(opts.tenantSlug, opts.jobId);
    if (
      st.state === "completed" ||
      st.state === "failed" ||
      st.state === "canceled" ||
      st.state === "rolled-back"
    ) {
      return st;
    }
    await sleep(pollDelayMs(attempt));
    attempt++;
  }
}
