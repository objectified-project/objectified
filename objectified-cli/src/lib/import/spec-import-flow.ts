import type { ObjectifiedApi, SpecImportJobStatus } from "../client.js";

/** Default interval between GET …/imports/{job_id} polls when `--poll` is omitted (ms). */
export const DEFAULT_SPEC_IMPORT_POLL_INTERVAL_MS = 400;

const POLL_MS_MIN = 50;
const POLL_MS_MAX = 120_000;

/** Optional stderr hook for `objectified import spec --verbose`. */
export type SpecImportPollLog = (line: string) => void;

/** Clamp `--poll` values to a supported range (ms). */
export function clampSpecImportPollIntervalMs(ms: number): number {
  return Math.min(Math.max(ms, POLL_MS_MIN), POLL_MS_MAX);
}

function resolvePollIntervalMs(pollMs: number | undefined): number {
  return pollMs === undefined
    ? DEFAULT_SPEC_IMPORT_POLL_INTERVAL_MS
    : clampSpecImportPollIntervalMs(pollMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  /** Interval between polls (ms); see `--poll` on import spec (default {@link DEFAULT_SPEC_IMPORT_POLL_INTERVAL_MS}). */
  pollIntervalMs?: number;
}): Promise<SpecImportJobStatus> {
  const intervalMs = resolvePollIntervalMs(opts.pollIntervalMs);
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
    opts.log?.(`waiting ${String(intervalMs)}ms before next poll`);
    await sleep(intervalMs);
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
  /** Interval between polls (ms); see `--poll` on import spec (default {@link DEFAULT_SPEC_IMPORT_POLL_INTERVAL_MS}). */
  pollIntervalMs?: number;
}): Promise<SpecImportJobStatus> {
  const intervalMs = resolvePollIntervalMs(opts.pollIntervalMs);
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
    opts.log?.(`waiting ${String(intervalMs)}ms before next poll`);
    await sleep(intervalMs);
    attempt++;
  }
}
