import os from "node:os";
import { inspect } from "node:util";

import { ObjectifiedCliError } from "../errors.js";
import { EXIT_CODES } from "../exit-codes.js";
import {
  defaultVaultDeps,
  mergeProfileIntoVault,
  readVaultDocument,
  removeProfileFromVault,
  type VaultDeps,
} from "./file-vault.js";

const SERVICE_NAME = "objectified-cli";

type KeytarModule = {
  setPassword: (service: string, account: string, password: string) => Promise<void>;
  getPassword: (service: string, account: string) => Promise<string | null>;
  deletePassword: (service: string, account: string) => Promise<boolean>;
};

export type CliOAuthBundle = {
  accessToken: string;
  refreshToken: string;
  expiresAt?: string | null;
  tenantSlug?: string | null;
};

export type StoredCliCredential =
  | ({ kind?: "oauth" } & CliOAuthBundle)
  | { kind: "api_key"; apiKey: string };

export type LoadedCliAuth =
  | { kind: "oauth"; accessToken: string; refreshToken: string }
  | { kind: "api_key"; apiKey: string };

const memoryBackends = new Map<string, StoredCliCredential>();
let keytarPromise: Promise<KeytarModule> | null = null;

let warnedFileBackend = false;

function stderrWarnFileBackend(): void {
  if (process.env.VITEST !== undefined) return;
  if (warnedFileBackend) return;
  warnedFileBackend = true;
  process.stderr.write(
    "objectified: warning: OS keychain is unavailable; using encrypted file credential storage under your Objectified config directory (credentials.enc). Prefer libsecret / a desktop keyring on Linux when available.\n",
  );
}

function useMemoryBackend(): boolean {
  return process.env.OBJECTIFIED_CLI_CREDENTIAL_BACKEND === "memory";
}

function fileFallbackDisabled(): boolean {
  const v = process.env.OBJECTIFIED_CLI_CREDENTIAL_DISABLE_FILE_FALLBACK?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function vaultDeps(): VaultDeps {
  return { ...defaultVaultDeps, homedir: os.homedir, env: process.env };
}

function toStoredOAuth(bundle: CliOAuthBundle): StoredCliCredential {
  return {
    kind: "oauth",
    accessToken: bundle.accessToken,
    refreshToken: bundle.refreshToken,
    expiresAt: bundle.expiresAt,
    tenantSlug: bundle.tenantSlug,
  };
}

function oauthWire(bundle: CliOAuthBundle): Record<string, unknown> {
  const o: Record<string, unknown> = {
    type: "oauth",
    access_token: bundle.accessToken,
    refresh_token: bundle.refreshToken,
  };
  if (bundle.expiresAt !== undefined && bundle.expiresAt !== null && bundle.expiresAt !== "") {
    o.expires_at = bundle.expiresAt;
  }
  if (bundle.tenantSlug !== undefined && bundle.tenantSlug !== null && bundle.tenantSlug !== "") {
    o.tenant_slug = bundle.tenantSlug;
  }
  return o;
}

function apiKeyWire(apiKey: string): Record<string, unknown> {
  return { type: "api_key", api_key: apiKey };
}

async function loadKeytarOrThrow(): Promise<KeytarModule> {
  keytarPromise ??= import("keytar")
    .then((mod) => mod.default)
    .catch((err: unknown) => {
      keytarPromise = null;
      const detail = err instanceof Error ? err.message : String(err);
      throw new ObjectifiedCliError({
        message: `OS keychain is unavailable for CLI credentials (${detail}).`,
        exitCode: EXIT_CODES.GENERIC,
        hint: "Install the required system keychain libraries (for example, libsecret on Linux), use encrypted file fallback (default when keychain is missing), set OBJECTIFIED_CLI_CREDENTIAL_BACKEND=memory for tests, or set OBJECTIFIED_CLI_CREDENTIAL_DISABLE_FILE_FALLBACK=1 to surface this error instead of falling back.",
      });
    });
  return keytarPromise;
}

async function tryKeytar<T>(fn: (k: KeytarModule) => Promise<T>): Promise<T | "fail"> {
  if (useMemoryBackend()) return "fail";
  try {
    const k = await import("keytar").then((m) => m.default);
    return await fn(k);
  } catch {
    return "fail";
  }
}

/** Test helper: clears the in-memory credential map when backend is `memory`. */
export function resetMemoryCredentialBackend(): void {
  memoryBackends.clear();
}

export function resetFileBackendWarningForTests(): void {
  warnedFileBackend = false;
}

export function parseStoredCredential(raw: string): LoadedCliAuth | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const rec = parsed as Record<string, unknown>;
    const typeField = rec.type;
    if (typeField === "api_key" || rec.kind === "api_key") {
      const key =
        typeof rec.api_key === "string"
          ? rec.api_key
          : typeof rec.apiKey === "string"
            ? rec.apiKey
            : undefined;
      if (key !== undefined) return { kind: "api_key", apiKey: key };
      return null;
    }
    const accessToken =
      typeof rec.access_token === "string"
        ? rec.access_token
        : typeof rec.accessToken === "string"
          ? rec.accessToken
          : undefined;
    const refreshToken =
      typeof rec.refresh_token === "string"
        ? rec.refresh_token
        : typeof rec.refreshToken === "string"
          ? rec.refreshToken
          : undefined;
    if (
      typeof accessToken === "string" &&
      typeof refreshToken === "string" &&
      (typeField === "oauth" || typeField === undefined) &&
      (rec.kind === undefined || rec.kind === "oauth")
    ) {
      return { kind: "oauth", accessToken, refreshToken };
    }
    return null;
  } catch {
    return null;
  }
}

async function loadFromFileVault(profile: string): Promise<LoadedCliAuth | null> {
  if (useMemoryBackend() || fileFallbackDisabled()) return null;
  try {
    const doc = await readVaultDocument(vaultDeps());
    if (!doc) return null;
    const row = doc.profiles[profile];
    if (!row || typeof row !== "object") return null;
    return parseStoredCredential(JSON.stringify(row));
  } catch (e: unknown) {
    if (e instanceof ObjectifiedCliError) throw e;
    return null;
  }
}

function keychainUnavailableError(cause: string): ObjectifiedCliError {
  return new ObjectifiedCliError({
    message: `Could not store CLI credentials (${cause}).`,
    exitCode: EXIT_CODES.GENERIC,
    hint: "Install a system keychain (libsecret on Linux), unset OBJECTIFIED_CLI_CREDENTIAL_DISABLE_FILE_FALLBACK if set, or use OBJECTIFIED_CLI_CREDENTIAL_BACKEND=memory in CI.",
  });
}

export async function saveCliOAuthCredentials(
  profile: string,
  bundle: CliOAuthBundle,
): Promise<void> {
  const stored = toStoredOAuth(bundle);
  if (useMemoryBackend()) {
    memoryBackends.set(profile, stored);
    return;
  }
  const wire = oauthWire(bundle);
  const json = JSON.stringify(wire);
  const kt = await tryKeytar((k) => k.setPassword(SERVICE_NAME, profile, json));
  if (kt !== "fail") return;
  if (fileFallbackDisabled()) {
    const k = await loadKeytarOrThrow();
    await k.setPassword(SERVICE_NAME, profile, json);
    return;
  }
  stderrWarnFileBackend();
  try {
    await mergeProfileIntoVault(profile, wire, vaultDeps());
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw keychainUnavailableError(msg);
  }
}

export async function saveCliApiKeyCredentials(profile: string, apiKey: string): Promise<void> {
  const stored: StoredCliCredential = { kind: "api_key", apiKey };
  if (useMemoryBackend()) {
    memoryBackends.set(profile, stored);
    return;
  }
  const wire = apiKeyWire(apiKey);
  const json = JSON.stringify(wire);
  const kt = await tryKeytar((k) => k.setPassword(SERVICE_NAME, profile, json));
  if (kt !== "fail") return;
  if (fileFallbackDisabled()) {
    const k = await loadKeytarOrThrow();
    await k.setPassword(SERVICE_NAME, profile, json);
    return;
  }
  stderrWarnFileBackend();
  try {
    await mergeProfileIntoVault(profile, wire, vaultDeps());
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw keychainUnavailableError(msg);
  }
}

/** Loads OAuth tokens only (legacy helper for callers that ignore API keys). */
export async function loadCliOAuthCredentials(profile: string): Promise<CliOAuthBundle | null> {
  const auth = await loadCliStoredAuth(profile);
  if (auth?.kind !== "oauth") return null;
  return { accessToken: auth.accessToken, refreshToken: auth.refreshToken };
}

export async function loadCliStoredAuth(profile: string): Promise<LoadedCliAuth | null> {
  if (useMemoryBackend()) {
    const hit = memoryBackends.get(profile);
    if (!hit) return null;
    if (hit.kind === "api_key") return { kind: "api_key", apiKey: hit.apiKey };
    return { kind: "oauth", accessToken: hit.accessToken, refreshToken: hit.refreshToken };
  }
  const kt = await tryKeytar((k) => k.getPassword(SERVICE_NAME, profile));
  if (kt !== "fail") {
    if (kt !== null && kt !== "") {
      return parseStoredCredential(kt);
    }
    const fromFile = await loadFromFileVault(profile);
    if (fromFile) stderrWarnFileBackend();
    return fromFile;
  }
  if (!fileFallbackDisabled()) {
    const fromFile = await loadFromFileVault(profile);
    if (fromFile) stderrWarnFileBackend();
    return fromFile;
  }
  try {
    const k = await loadKeytarOrThrow();
    const raw = await k.getPassword(SERVICE_NAME, profile);
    if (raw === null || raw === "") return null;
    return parseStoredCredential(raw);
  } catch (e: unknown) {
    if (e instanceof ObjectifiedCliError) throw e;
    return null;
  }
}

export async function deleteCliOAuthCredentials(profile: string): Promise<void> {
  if (useMemoryBackend()) {
    memoryBackends.delete(profile);
    return;
  }
  let keychainError: unknown;
  if (fileFallbackDisabled()) {
    try {
      const k = await loadKeytarOrThrow();
      await k.deletePassword(SERVICE_NAME, profile);
    } catch (err: unknown) {
      keychainError = err;
    }
  } else {
    await tryKeytar((k) => k.deletePassword(SERVICE_NAME, profile));
  }
  try {
    await removeProfileFromVault(profile, vaultDeps());
  } catch {
    /* ignore vault cleanup failures */
  }
  if (keychainError !== undefined) {
    if (keychainError instanceof Error) throw keychainError;
    if (typeof keychainError === "string") throw new Error(keychainError);
    throw new Error(`Could not delete credentials from OS keychain: ${inspect(keychainError)}`);
  }
}
