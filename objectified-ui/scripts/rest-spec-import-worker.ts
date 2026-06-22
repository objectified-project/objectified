/**
 * Runs a single specification import for objectified-rest (tsx subprocess).
 * Reads JSON stdin from the REST layer; prints newline-delimited JSON to stdout (logs on stderr only).
 * While the import is in progress, emits `{ partial: true, status }` lines; the final line omits `partial`.
 */

import { stdin as input } from "node:process";

import { getImportStatus, startImport } from "../lib/db/import-helper";
import {
  buildImportJobInput,
  type WorkerImportPayload,
} from "../lib/repository-auto-refresh-import";

type Payload = WorkerImportPayload;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of input) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function progressToRest(st: Awaited<ReturnType<typeof getImportStatus>>): Record<string, unknown> | undefined {
  const p = st.progress;
  if (!p) {
    return undefined;
  }
  return {
    phase: p.phase,
    total: p.total,
    completed: p.completed,
    current_item: p.currentItem ?? null,
  };
}

function resultToRest(
  st: Awaited<ReturnType<typeof getImportStatus>>,
  meta: Payload["metadata"],
): Record<string, unknown> | undefined {
  const r = st.result;
  if (!r?.projectId || !r.versionId) {
    return undefined;
  }
  return {
    project_id: r.projectId,
    project_slug: meta.project.slug,
    version_id: meta.version.version_id,
    version_record_id: r.versionId,
  };
}

function buildRestStatus(
  st: Awaited<ReturnType<typeof getImportStatus>>,
  restJobId: string,
  meta: Payload["metadata"],
): Record<string, unknown> {
  return {
    job_id: restJobId,
    state: st.state,
    percent: st.percent,
    events: st.events.map((e) => ({
      id: e.id,
      ts: e.ts,
      level: e.level,
      code: e.code,
      message: e.message,
      context: e.context ?? null,
    })),
    progress: progressToRest(st),
    summary: st.summary ?? null,
    result: resultToRest(st, meta),
  };
}

/** One JSON object per line so objectified-rest can update poll status while the import runs. */
function writeWorkerStdoutLine(obj: unknown): void {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

async function runFromPayload(payload: Payload): Promise<void> {
  // Resolve the importer kind, options, and document. For a repository
  // auto-refresh (source_kind === 'repository_auto_import') this hydrates options
  // and source descriptor from the stored import spec so the refresh replays the
  // user's original request instead of importer defaults (RAR-4.1).
  const inputPayload = buildImportJobInput(payload);

  const { jobId } = await startImport(inputPayload);

  const pending = new Set(["queued", "running", "committing"]);

  for (;;) {
    const st = await getImportStatus(jobId);
    const restStatus = buildRestStatus(st, payload.rest_job_id, payload.metadata);
    if (!pending.has(st.state)) {
      writeWorkerStdoutLine({ ok: true, job_id: payload.rest_job_id, status: restStatus });
      return;
    }
    writeWorkerStdoutLine({
      ok: true,
      partial: true,
      job_id: payload.rest_job_id,
      status: restStatus,
    });
    await sleep(400);
  }
}

async function main(): Promise<void> {
  const raw = await readStdin();
  let payload: Payload;
  try {
    payload = JSON.parse(raw) as Payload;
  } catch (e: unknown) {
    throw new Error(`Invalid JSON stdin: ${(e as Error)?.message ?? e}`);
  }
  await runFromPayload(payload);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  writeWorkerStdoutLine({ ok: false, error: message });
  process.exit(1);
});
