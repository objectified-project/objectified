/**
 * Connection resolution and provisioning for the **separate type-registry database**
 * (`objectified-types-db`), kept apart from the core `objectified` database so the
 * registry's namespaces / type definitions / `$ref` edges never share tables with the
 * core ADE schema (`odb`). See docs/ROADMAP_TYPE_REGISTRY_GOVERNANCE.md §1.1 (#3446).
 *
 * The registry reuses the operator's host/port/user/password and only swaps the target
 * database name. Migration files live in their own `registry-scripts/` directory and are
 * tracked independently (each database keeps its own `schema_evolution_manager.scripts`).
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import type pg from "pg";

import { type ConnectionOptions, withDatabaseOverride } from "./db.js";

/** Default registry database name (overridable via `--registry-database` / `OBJECTIFIED_TYPES_DB`). */
export const DEFAULT_REGISTRY_DATABASE = "objectified-types-db";

/** The Postgres maintenance database used to issue `CREATE DATABASE`. */
export const MAINTENANCE_DATABASE = "postgres";

/** Package root (parent of dist/ at runtime), where `registry-scripts/` is shipped. */
export function defaultRegistryScriptsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, "..", "registry-scripts");
}

/**
 * Resolve the registry database name from (highest precedence first):
 * an explicit option → `OBJECTIFIED_TYPES_DB` env → {@link DEFAULT_REGISTRY_DATABASE}.
 */
export function resolveRegistryDatabaseName(registryDatabase?: string): string {
  const explicit = registryDatabase?.trim();
  if (explicit) return explicit;
  const fromEnv = process.env.OBJECTIFIED_TYPES_DB?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_REGISTRY_DATABASE;
}

/**
 * Build the connection options that target the registry database.
 *
 * A dedicated `OBJECTIFIED_TYPES_DB_URL` connection string, when set, takes precedence
 * (allowing the registry to live on a different server entirely); otherwise the base
 * connection is reused with only the database name overridden.
 */
export function registryConnection(
  base: ConnectionOptions,
  registryDatabase?: string,
): ConnectionOptions {
  const dedicatedUrl = process.env.OBJECTIFIED_TYPES_DB_URL?.trim();
  if (dedicatedUrl) {
    return { databaseUrl: dedicatedUrl };
  }
  return withDatabaseOverride(base, resolveRegistryDatabaseName(registryDatabase));
}

/**
 * Build the connection options that target the maintenance database (`postgres`) on the
 * same server as the registry, so `CREATE DATABASE` can run (you cannot create a database
 * while connected to it).
 */
export function maintenanceConnection(base: ConnectionOptions): ConnectionOptions {
  const dedicatedUrl = process.env.OBJECTIFIED_TYPES_DB_URL?.trim();
  if (dedicatedUrl) {
    return withDatabaseOverride({ databaseUrl: dedicatedUrl }, MAINTENANCE_DATABASE);
  }
  return withDatabaseOverride(base, MAINTENANCE_DATABASE);
}

/**
 * Quote a SQL identifier (double-quote, doubling embedded quotes) so a database name with
 * hyphens — e.g. `objectified-types-db` — is a legal `CREATE DATABASE` target.
 */
export function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export type ProvisionResult = {
  database: string;
  created: boolean;
};

/**
 * Ensure the registry database exists, creating it if absent. Must be called on a client
 * connected to the maintenance database. Idempotent: returns `created: false` when the
 * database was already present.
 *
 * `CREATE DATABASE` cannot run inside a transaction block, so this issues it directly.
 *
 * @param maintenanceClient Client connected to the `postgres` maintenance database.
 * @param database          Registry database name to ensure.
 * @returns                 Whether the database was newly created.
 */
export async function ensureRegistryDatabase(
  maintenanceClient: pg.Client,
  database: string,
): Promise<ProvisionResult> {
  const existing = await maintenanceClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [
    database,
  ]);
  if ((existing.rowCount ?? 0) > 0) {
    return { database, created: false };
  }
  await maintenanceClient.query(`CREATE DATABASE ${quoteIdentifier(database)}`);
  return { database, created: true };
}
