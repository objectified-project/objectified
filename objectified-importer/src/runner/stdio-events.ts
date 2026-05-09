import type { Writable } from 'node:stream';
import { once } from 'node:events';

import type { ImportEvent, ProgressEvent } from '../engine/import-helper';

/** NDJSON payloads written to stdout (one JSON object per line). */
export type RunnerNdjsonLine =
  | { type: 'event'; event: ImportEvent }
  | { type: 'progress'; progress: ProgressEvent }
  | {
      type: 'result';
      state: string;
      summary?: unknown;
      /** Catalog UUIDs when the engine has committed import metadata (or dry-run completion). */
      result?: { projectId?: string; versionId?: string };
    }
  | { type: 'error'; code: string; message: string; context?: unknown };

export async function writeNdjsonLine(stream: Writable, line: RunnerNdjsonLine): Promise<void> {
  const ok = stream.write(`${JSON.stringify(line)}\n`);
  if (!ok) {
    await once(stream, 'drain');
  }
}
