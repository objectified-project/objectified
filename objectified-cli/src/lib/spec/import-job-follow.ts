import fs from "node:fs";
import path from "node:path";

import type { Ora } from "ora";

import type { ImportJobResponse, ObjectifiedApi } from "../client.js";
import { ObjectifiedCliError } from "../errors.js";
import { EXIT_CODES } from "../exit-codes.js";

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const err = new Error("Aborted");
      err.name = "AbortError";
      reject(err);
      return;
    }
    function onAbort(): void {
      clearTimeout(t);
      signal?.removeEventListener("abort", onAbort);
      const err = new Error("Aborted");
      err.name = "AbortError";
      reject(err);
    }
    function onTimeout(): void {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }
    const t = setTimeout(onTimeout, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function ndjsonLine(obj: unknown): string {
  return `${JSON.stringify(obj)}\n`;
}

function stableProgressKey(p: ImportJobResponse["progress"]): string {
  if (p === undefined || p === null || typeof p !== "object") return "";
  return JSON.stringify(p);
}

export type ImportReportSink = {
  writeLine(obj: unknown): void;
  close(): Promise<void>;
};

/** Append NDJSON report; creates parent dirs. Caller writes the final summary line via writeReportSummaryLine. */
export function openImportReportSink(reportPath: string): ImportReportSink {
  const abs = path.resolve(process.cwd(), reportPath);
  const dir = path.dirname(abs);
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    throw new ObjectifiedCliError({
      message: `--report path is a directory: ${abs}`,
      exitCode: EXIT_CODES.VALIDATION,
      title: "Validation failed",
      hint: "Pass a file path for the NDJSON report.",
    });
  }
  const stream = fs.createWriteStream(abs, { flags: "a" });
  return {
    writeLine(obj: unknown) {
      stream.write(ndjsonLine(obj));
    },
    close() {
      return new Promise((resolve, reject) => {
        const onError = (err: Error): void => {
          stream.off("finish", onFinish);
          reject(err);
        };
        const onFinish = (): void => {
          stream.off("error", onError);
          resolve();
        };
        stream.once("error", onError);
        stream.once("finish", onFinish);
        stream.end();
      });
    },
  };
}

export function writeReportSummaryLine(
  sink: ImportReportSink | undefined,
  payload: {
    summary: ImportJobResponse["summary"];
    result: ImportJobResponse["result"];
    exitCode: number;
  },
): void {
  sink?.writeLine({
    type: "summary",
    summary: payload.summary ?? null,
    result: payload.result ?? null,
    exitCode: payload.exitCode,
  });
}

export type FollowImportJobOptions = {
  api: ObjectifiedApi;
  tenantSlug: string;
  initial: ImportJobResponse;
  /** Stop polling when state is pending-approval (CI hold). */
  reviewMode: boolean;
  ndjson: boolean;
  verbose: boolean;
  /** When false, show ora spinner on stderr during polling (human mode). */
  showSpinner: boolean;
  reportSink: ImportReportSink | undefined;
  spinnerText: (job: ImportJobResponse) => string;
  createSpinner: (text: string) => Ora;
  stderrLine: (line: string) => void;
  onJobUpdate?: (job: ImportJobResponse) => void;
};

export type FollowImportJobResult = {
  job: ImportJobResponse;
  /** True when --review was set but the job reached another terminal state first. */
  reviewMiss: boolean;
};

function isTerminalForReview(state: string, reviewMode: boolean): boolean {
  if (reviewMode && state === "pending-approval") return true;
  return (
    state === "completed" ||
    state === "failed" ||
    state === "canceled" ||
    state === "rolled-back" ||
    state === "pending-approval"
  );
}

function reviewViolatedTerminal(state: string): boolean {
  return (
    state === "completed" || state === "failed" || state === "canceled" || state === "rolled-back"
  );
}

export async function followImportJobPoll(
  opts: FollowImportJobOptions,
): Promise<FollowImportJobResult> {
  let job = opts.initial;
  let emittedEvents = 0;
  let lastProgressKey = "";

  const emitDelta = (current: ImportJobResponse): void => {
    opts.onJobUpdate?.(current);

    const evs = current.events;
    if (Array.isArray(evs) && evs.length > emittedEvents) {
      for (let i = emittedEvents; i < evs.length; i++) {
        const event = evs[i];
        const rec = { type: "event" as const, event };
        if (opts.ndjson) {
          process.stdout.write(ndjsonLine(rec));
        }
        opts.reportSink?.writeLine(rec);
        if (opts.verbose) {
          opts.stderrLine(`event: ${JSON.stringify(event)}`);
        }
      }
      emittedEvents = evs.length;
    }

    const pk = stableProgressKey(current.progress);
    if (pk !== "" && pk !== lastProgressKey) {
      lastProgressKey = pk;
      const progress = current.progress;
      const rec = { type: "progress" as const, progress };
      if (opts.ndjson) {
        process.stdout.write(ndjsonLine(rec));
      }
      opts.reportSink?.writeLine(rec);
      if (opts.verbose && progress !== undefined && progress !== null) {
        opts.stderrLine(`progress: ${JSON.stringify(progress)}`);
      }
    }
  };

  emitDelta(job);

  const ac = new AbortController();
  const onSigint = (): void => {
    ac.abort();
  };
  process.once("SIGINT", onSigint);

  const spin = opts.showSpinner ? opts.createSpinner(opts.spinnerText(job)) : undefined;
  spin?.start();

  try {
    const pollEpoch = Date.now();
    let delayMs = 1000;

    while (!isTerminalForReview(job.state, opts.reviewMode)) {
      try {
        await sleep(delayMs, ac.signal);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          throw new ObjectifiedCliError({
            message: "Import polling canceled.",
            exitCode: EXIT_CODES.GENERIC,
            title: "Canceled",
            hint: "Interrupted by Ctrl-C.",
          });
        }
        throw e;
      }

      const elapsed = Date.now() - pollEpoch;
      if (elapsed >= 30_000) {
        delayMs = Math.min(5000, delayMs * 2);
      }

      job = await opts.api.getImportJob(opts.tenantSlug, job.jobId);
      if (spin !== undefined) {
        spin.text = opts.spinnerText(job);
      }
      emitDelta(job);
    }

    const reviewMiss =
      opts.reviewMode && job.state !== "pending-approval" && reviewViolatedTerminal(job.state);

    return { job, reviewMiss };
  } finally {
    process.off("SIGINT", onSigint);
    spin?.stop();
  }
}
