import type { Writable } from 'node:stream';

import type { ImportEvent, ProgressEvent } from '../engine/import-helper';

/** NDJSON payloads written to stdout (one JSON object per line). */
export type RunnerNdjsonLine =
  | { type: 'event'; event: ImportEvent }
  | { type: 'progress'; progress: ProgressEvent }
  | { type: 'result'; state: string; summary?: unknown }
  | { type: 'error'; code: string; message: string; context?: unknown };

export function writeNdjsonLine(stream: Writable, line: RunnerNdjsonLine): void {
  stream.write(`${JSON.stringify(line)}\n`);
}
