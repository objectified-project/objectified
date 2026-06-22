import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withDatabaseOverride } from "../src/db.js";
import {
  DEFAULT_REGISTRY_DATABASE,
  MAINTENANCE_DATABASE,
  defaultRegistryScriptsDir,
  ensureRegistryDatabase,
  maintenanceConnection,
  quoteIdentifier,
  registryConnection,
  resolveRegistryDatabaseName,
} from "../src/registry.js";

const ENV_KEYS = ["OBJECTIFIED_DB_URL", "DATABASE_URL", "OBJECTIFIED_TYPES_DB", "OBJECTIFIED_TYPES_DB_URL"];

describe("registry connection resolution", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  describe("resolveRegistryDatabaseName", () => {
    it("defaults to objectified-types-db", () => {
      expect(resolveRegistryDatabaseName()).toBe(DEFAULT_REGISTRY_DATABASE);
      expect(DEFAULT_REGISTRY_DATABASE).toBe("objectified-types-db");
    });

    it("prefers an explicit name over the env var", () => {
      process.env.OBJECTIFIED_TYPES_DB = "from-env";
      expect(resolveRegistryDatabaseName("explicit")).toBe("explicit");
    });

    it("falls back to OBJECTIFIED_TYPES_DB env when no explicit name", () => {
      process.env.OBJECTIFIED_TYPES_DB = "from-env";
      expect(resolveRegistryDatabaseName()).toBe("from-env");
    });
  });

  describe("withDatabaseOverride", () => {
    it("overrides the discrete database field when no URL is configured", () => {
      const out = withDatabaseOverride({ host: "h", port: "6", user: "u", password: "p" }, "registry");
      expect(out.database).toBe("registry");
      expect(out.host).toBe("h");
      expect(out.databaseUrl).toBeUndefined();
    });

    it("rewrites the path segment of an explicit connection URL", () => {
      const out = withDatabaseOverride(
        { databaseUrl: "postgresql://u:p@host:5432/objectified" },
        "objectified-types-db",
      );
      expect(out.databaseUrl).toBe("postgresql://u:p@host:5432/objectified-types-db");
    });

    it("rewrites an OBJECTIFIED_DB_URL env URL rather than leaking the core database", () => {
      process.env.OBJECTIFIED_DB_URL = "postgresql://u:p@host:5432/objectified";
      const out = withDatabaseOverride({}, "objectified-types-db");
      expect(out.databaseUrl).toBe("postgresql://u:p@host:5432/objectified-types-db");
    });
  });

  describe("registryConnection", () => {
    it("reuses the base connection with only the database swapped", () => {
      const out = registryConnection({ host: "db", port: "5432", user: "postgres", password: "pw" });
      expect(out.database).toBe("objectified-types-db");
      expect(out.host).toBe("db");
      expect(out.password).toBe("pw");
    });

    it("honors a dedicated OBJECTIFIED_TYPES_DB_URL", () => {
      process.env.OBJECTIFIED_TYPES_DB_URL = "postgresql://u:p@other:5433/registry";
      const out = registryConnection({ host: "db" });
      expect(out.databaseUrl).toBe("postgresql://u:p@other:5433/registry");
    });
  });

  describe("maintenanceConnection", () => {
    it("targets the postgres maintenance database for CREATE DATABASE", () => {
      const out = maintenanceConnection({ host: "db", port: "5432", user: "postgres", password: "pw" });
      expect(out.database).toBe(MAINTENANCE_DATABASE);
      expect(out.database).toBe("postgres");
    });

    it("rewrites a dedicated registry URL to the maintenance database", () => {
      process.env.OBJECTIFIED_TYPES_DB_URL = "postgresql://u:p@other:5433/registry";
      const out = maintenanceConnection({ host: "db" });
      expect(out.databaseUrl).toBe("postgresql://u:p@other:5433/postgres");
    });
  });
});

describe("quoteIdentifier", () => {
  it("double-quotes identifiers so hyphenated names are valid CREATE DATABASE targets", () => {
    expect(quoteIdentifier("objectified-types-db")).toBe('"objectified-types-db"');
  });

  it("escapes embedded double quotes", () => {
    expect(quoteIdentifier('a"b')).toBe('"a""b"');
  });
});

describe("defaultRegistryScriptsDir", () => {
  it("points at a registry-scripts directory", () => {
    expect(defaultRegistryScriptsDir().endsWith("registry-scripts")).toBe(true);
  });
});

describe("ensureRegistryDatabase", () => {
  it("creates the database when it does not exist", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // pg_database lookup
      .mockResolvedValueOnce({ rowCount: 0, rows: [] }); // CREATE DATABASE
    const client = { query } as unknown as import("pg").Client;

    const result = await ensureRegistryDatabase(client, "objectified-types-db");

    expect(result).toEqual({ database: "objectified-types-db", created: true });
    expect(query).toHaveBeenNthCalledWith(1, "SELECT 1 FROM pg_database WHERE datname = $1", [
      "objectified-types-db",
    ]);
    expect(query).toHaveBeenNthCalledWith(2, 'CREATE DATABASE "objectified-types-db"');
  });

  it("is idempotent when the database already exists", async () => {
    const query = vi.fn().mockResolvedValueOnce({ rowCount: 1, rows: [{ "?column?": 1 }] });
    const client = { query } as unknown as import("pg").Client;

    const result = await ensureRegistryDatabase(client, "objectified-types-db");

    expect(result).toEqual({ database: "objectified-types-db", created: false });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
