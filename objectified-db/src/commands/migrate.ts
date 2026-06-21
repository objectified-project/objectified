import type pg from "pg";

import {
  applyPendingMigrations,
  defaultScriptsDir,
  getMigrationStatus,
} from "../migrate.js";
import type { OutputMode } from "../output.js";
import { note, printRecord, printRows } from "../output.js";

export type MigrateOptions = {
  scriptsDir?: string;
  dryRun?: boolean;
};

export async function runMigrateStatus(
  client: pg.Client,
  opts: MigrateOptions,
  mode: OutputMode,
): Promise<void> {
  const scriptsDir = opts.scriptsDir ?? defaultScriptsDir();
  const status = await getMigrationStatus(client, scriptsDir);

  if (mode.json) {
    printRecord(mode, status);
    return;
  }

  note(`Migrations directory: ${status.scriptsDir}`);
  note(`Applied: ${status.applied.length} · Pending: ${status.pending.length}`);

  if (status.pending.length > 0) {
    printRows(
      mode,
      status.pending.map((filename) => ({ filename })),
      [{ key: "filename", label: "filename" }],
    );
  }
  if (status.applied.length > 0 && status.pending.length === 0) {
    note("All scripts have been previously applied.");
  }
}

export async function runMigrateApply(
  client: pg.Client,
  opts: MigrateOptions,
  mode: OutputMode,
): Promise<void> {
  const scriptsDir = opts.scriptsDir ?? defaultScriptsDir();
  const result = await applyPendingMigrations(client, { scriptsDir, dryRun: opts.dryRun });

  if (mode.json) {
    printRecord(mode, { scriptsDir, ...result });
    return;
  }

  if (result.dryRun) {
    if (result.applied.length === 0) {
      note("Dry run: no pending migrations.");
    } else {
      note("Dry run: would apply:");
      for (const f of result.applied) note(`  ${f}`);
    }
    return;
  }

  if (result.applied.length === 0) {
    note("All scripts have been previously applied.");
    return;
  }

  note(`Applied ${result.applied.length} migration(s):`);
  for (const f of result.applied) note(`  ${f}`);
}
