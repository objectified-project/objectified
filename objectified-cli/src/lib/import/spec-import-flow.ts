import type { ObjectifiedApi, SpecImportJobStatus } from "../client.js";

const POLL_MS = [400, 800, 1600, 3200, 6400, 12_800];

/** Optional stderr hook for `objectified import spec --verbose`. */
export type SpecImportPollLog = (line: string) => void;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pollDelayMs(attempt: number): number {
  const idx = Math.min(Math.max(attempt, 0), POLL_MS.length - 1);
  return POLL_MS[idx] ?? 12_800;
}

/** One-line snapshot after each GET …/imports/{job_id} (for --verbose). */
export function formatSpecImportPollLine(attempt: number, st: SpecImportJobStatus): string {
  const pct = st.percent ?? 0;
  const parts = [`poll #${String(attempt)}`, `state=${st.state}`, `percent=${String(pct)}`];
  const p = st.progress;
  if (p && typeof p.phase === "string") {
    parts.push(`phase=${p.phase}`, `step=${String(p.completed)}/${String(p.total)}`);
    const cur = p.current_item;
    if (typeof cur === "string" && cur.trim() !== "") {
      parts.push(`item=${cur}`);
    }
  }
  const evs = st.events;
  if (evs !== undefined && evs.length > 0) {
    const last = evs[evs.length - 1];
    if (last?.code !== undefined && last.code !== "") {
      parts.push(`last_event=${last.code}`);
    }
  }
  return parts.join(" ");
}

/** Poll until the job needs finalize, ends successfully without approval, or fails. */
export async function pollSpecImportUntilGate(opts: {
  api: Pick<ObjectifiedApi, "getSpecImportStatus">;
  tenantSlug: string;
  jobId: string;
  signal?: AbortSignal;
  log?: SpecImportPollLog;
}): Promise<SpecImportJobStatus> {
  let attempt = 0;
  for (;;) {
    opts.signal?.throwIfAborted();
    const st = await opts.api.getSpecImportStatus(opts.tenantSlug, opts.jobId);
    opts.log?.(formatSpecImportPollLine(attempt, st));
    if (
      st.state === "pending-approval" ||
      st.state === "completed" ||
      st.state === "failed" ||
      st.state === "canceled" ||
      st.state === "rolled-back"
    ) {
      return st;
    }
    const delay = pollDelayMs(attempt);
    opts.log?.(`waiting ${String(delay)}ms before next poll`);
    await sleep(delay);
    attempt++;
  }
}

/** Poll until a terminal lifecycle state (includes rolled-back). */
export async function pollSpecImportUntilTerminal(opts: {
  api: Pick<ObjectifiedApi, "getSpecImportStatus">;
  tenantSlug: string;
  jobId: string;
  signal?: AbortSignal;
  log?: SpecImportPollLog;
}): Promise<SpecImportJobStatus> {
  let attempt = 0;
  for (;;) {
    opts.signal?.throwIfAborted();
    const st = await opts.api.getSpecImportStatus(opts.tenantSlug, opts.jobId);
    opts.log?.(formatSpecImportPollLine(attempt, st));
    if (
      st.state === "completed" ||
      st.state === "failed" ||
      st.state === "canceled" ||
      st.state === "rolled-back"
    ) {
      return st;
    }
    const delay = pollDelayMs(attempt);
    opts.log?.(`waiting ${String(delay)}ms before next poll`);
    await sleep(delay);
    attempt++;
  }
}
