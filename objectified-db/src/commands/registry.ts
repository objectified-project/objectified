/**
 * `registry` command group — manage the separate type-registry database
 * (`objectified-types-db`): provision it, apply its migrations, and verify connectivity.
 *
 * The migration machinery is shared with the core database (see migrate.ts); only the
 * target connection and scripts directory differ. See registry.ts and #3446.
 */

import {
  applyPendingMigrations,
  getMigrationStatus,
} from "../migrate.js";
import {
  type ConnectionOptions,
  describeConnection,
  withClient,
} from "../db.js";
import {
  defaultRegistryScriptsDir,
  ensureRegistryDatabase,
  maintenanceConnection,
  registryConnection,
  resolveRegistryDatabaseName,
} from "../registry.js";
import type { OutputMode } from "../output.js";
import { note, printRecord, printRows } from "../output.js";

export type RegistryOptions = {
  registryDatabase?: string;
  scriptsDir?: string;
  dryRun?: boolean;
};

/**
 * Create the registry database if it does not already exist.
 *
 * @param base Base connection (host/port/user/password) — the database is overridden to
 *             the maintenance database to run `CREATE DATABASE`.
 */
export async function runRegistryProvision(
  base: ConnectionOptions,
  opts: RegistryOptions,
  mode: OutputMode,
): Promise<void> {
  const database = resolveRegistryDatabaseName(opts.registryDatabase);
  const result = await withClient(maintenanceConnection(base), (client) =>
    ensureRegistryDatabase(client, database),
  );

  if (mode.json) {
    printRecord(mode, result);
    return;
  }
  note(
    result.created
      ? `Created registry database "${result.database}".`
      : `Registry database "${result.database}" already exists.`,
  );
}

/**
 * Apply pending registry migrations, provisioning the database first if needed so a single
 * command takes a fresh server all the way to a migrated registry database.
 */
export async function runRegistryMigrate(
  base: ConnectionOptions,
  opts: RegistryOptions,
  mode: OutputMode,
): Promise<void> {
  const database = resolveRegistryDatabaseName(opts.registryDatabase);
  const scriptsDir = opts.scriptsDir ?? defaultRegistryScriptsDir();

  // Ensure the database exists before connecting to it (skipped on --dry-run, which is read-only).
  if (!opts.dryRun) {
    await withClient(maintenanceConnection(base), (client) =>
      ensureRegistryDatabase(client, database),
    );
  }

  const result = await withClient(registryConnection(base, opts.registryDatabase), (client) =>
    applyPendingMigrations(client, { scriptsDir, dryRun: opts.dryRun }),
  );

  if (mode.json) {
    printRecord(mode, { database, scriptsDir, ...result });
    return;
  }

  if (result.dryRun) {
    if (result.applied.length === 0) {
      note("Dry run: no pending registry migrations.");
    } else {
      note("Dry run: would apply:");
      for (const f of result.applied) note(`  ${f}`);
    }
    return;
  }

  if (result.applied.length === 0) {
    note("All registry scripts have been previously applied.");
    return;
  }

  note(`Applied ${result.applied.length} registry migration(s) to "${database}":`);
  for (const f of result.applied) note(`  ${f}`);
}

/** List applied and pending registry migration scripts (read-only; does not provision). */
export async function runRegistryMigrateStatus(
  base: ConnectionOptions,
  opts: RegistryOptions,
  mode: OutputMode,
): Promise<void> {
  const scriptsDir = opts.scriptsDir ?? defaultRegistryScriptsDir();
  const status = await withClient(registryConnection(base, opts.registryDatabase), (client) =>
    getMigrationStatus(client, scriptsDir),
  );

  if (mode.json) {
    printRecord(mode, status);
    return;
  }

  note(`Registry migrations directory: ${status.scriptsDir}`);
  note(`Applied: ${status.applied.length} · Pending: ${status.pending.length}`);
  if (status.pending.length > 0) {
    printRows(
      mode,
      status.pending.map((filename) => ({ filename })),
      [{ key: "filename", label: "filename" }],
    );
  }
  if (status.applied.length > 0 && status.pending.length === 0) {
    note("All registry scripts have been previously applied.");
  }
}

/** Verify connectivity to the registry database. */
export async function runRegistryPing(
  base: ConnectionOptions,
  opts: RegistryOptions,
  mode: OutputMode,
): Promise<void> {
  const conn = registryConnection(base, opts.registryDatabase);
  await withClient(conn, async (client) => {
    await client.query("SELECT 1");
    printRecord(mode, { status: "ok", target: describeConnection(conn) });
  });
}
