/**
 * Apply SQL migrations from scripts/ using schema-evolution-manager-compatible tracking
 * (schema_evolution_manager.scripts.filename).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type pg from "pg";

import { CliError } from "./errors.js";

const MIGRATION_FILE_PATTERN = /^\d{8}-\d{6}\.sql$/;

/** Package root (parent of dist/ at runtime). */
export function defaultScriptsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, "..", "scripts");
}

export function isMigrationFilename(name: string): boolean {
  return MIGRATION_FILE_PATTERN.test(name);
}

export async function listMigrationFiles(scriptsDir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(scriptsDir);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new CliError(`Could not read migrations directory ${scriptsDir}: ${message}`, {
      exitCode: 2,
    });
  }
  return entries.filter(isMigrationFilename).sort();
}

export type TransactionMode = "single" | "none";

/** Parse `-- sem.attribute.transaction = none|single` from migration SQL (SEM convention). */
export function parseTransactionMode(sql: string): TransactionMode {
  const match = sql.match(/^\s*--\s*sem\.attribute\.transaction\s*=\s*(\w+)/im);
  if (!match) return "single";
  const value = match[1]?.toLowerCase();
  if (value === "none") return "none";
  return "single";
}

const ENSURE_TRACKING_TABLE = `
CREATE SCHEMA IF NOT EXISTS schema_evolution_manager;

CREATE TABLE IF NOT EXISTS schema_evolution_manager.scripts (
  filename TEXT PRIMARY KEY
);
`;

export async function ensureTrackingTable(client: pg.Client): Promise<void> {
  await client.query(ENSURE_TRACKING_TABLE);
}

export async function fetchAppliedFilenames(
  client: pg.Client,
  opts: { createTrackingTable?: boolean } = {},
): Promise<Set<string>> {
  const create = opts.createTrackingTable ?? true;
  if (create) {
    await ensureTrackingTable(client);
  }
  try {
    const res = await client.query<{ filename: string }>(
      "SELECT filename FROM schema_evolution_manager.scripts ORDER BY filename",
    );
    return new Set(res.rows.map((r) => r.filename));
  } catch (err) {
    if (isUndefinedRelation(err)) {
      return new Set();
    }
    throw err;
  }
}

function isUndefinedRelation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "42P01";
}

export type MigrationStatus = {
  scriptsDir: string;
  applied: string[];
  pending: string[];
};

export async function getMigrationStatus(
  client: pg.Client,
  scriptsDir: string,
  opts: { createTrackingTable?: boolean } = {},
): Promise<MigrationStatus> {
  const files = await listMigrationFiles(scriptsDir);
  const appliedSet = await fetchAppliedFilenames(client, opts);
  const applied = files.filter((f) => appliedSet.has(f));
  const pending = files.filter((f) => !appliedSet.has(f));
  return { scriptsDir, applied, pending };
}

export type ApplyOptions = {
  scriptsDir: string;
  dryRun?: boolean;
};

export type ApplyResult = {
  applied: string[];
  skipped: string[];
  dryRun: boolean;
};

async function applyOneFile(
  client: pg.Client,
  scriptsDir: string,
  filename: string,
): Promise<void> {
  const filePath = path.join(scriptsDir, filename);
  const sql = await fs.readFile(filePath, "utf8");
  const mode = parseTransactionMode(sql);

  if (mode === "single") {
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_evolution_manager.scripts (filename) VALUES ($1)",
        [filename],
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } else {
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_evolution_manager.scripts (filename) VALUES ($1)",
      [filename],
    );
  }
}

export async function applyPendingMigrations(
  client: pg.Client,
  opts: ApplyOptions,
): Promise<ApplyResult> {
  const { scriptsDir, dryRun = false } = opts;
  const status = await getMigrationStatus(client, scriptsDir, {
    createTrackingTable: !dryRun,
  });

  if (status.pending.length === 0) {
    return { applied: [], skipped: status.applied, dryRun };
  }

  if (dryRun) {
    return { applied: status.pending, skipped: status.applied, dryRun: true };
  }

  await ensureTrackingTable(client);

  const applied: string[] = [];
  for (const filename of status.pending) {
    try {
      await applyOneFile(client, scriptsDir, filename);
      applied.push(filename);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new CliError(`Failed applying migration ${filename}: ${message}`, {
        hint: `Fix the script or, if it was applied manually, record it:\n  INSERT INTO schema_evolution_manager.scripts (filename) VALUES ('${filename}');`,
        exitCode: 1,
      });
    }
  }

  return { applied, skipped: status.applied, dryRun };
}
