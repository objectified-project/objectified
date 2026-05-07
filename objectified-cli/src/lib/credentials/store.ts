import { ObjectifiedCliError } from "../errors.js";
import { EXIT_CODES } from "../exit-codes.js";

const SERVICE_NAME = "objectified-cli";
type KeytarModule = {
  setPassword: (service: string, account: string, password: string) => Promise<void>;
  getPassword: (service: string, account: string) => Promise<string | null>;
  deletePassword: (service: string, account: string) => Promise<boolean>;
};

export type CliOAuthBundle = {
  accessToken: string;
  refreshToken: string;
};

export type StoredCliCredential =
  | ({ kind?: "oauth" } & CliOAuthBundle)
  | { kind: "api_key"; apiKey: string };

export type LoadedCliAuth =
  | { kind: "oauth"; accessToken: string; refreshToken: string }
  | { kind: "api_key"; apiKey: string };

const memoryBackends = new Map<string, StoredCliCredential>();
let keytarPromise: Promise<KeytarModule> | null = null;

function useMemoryBackend(): boolean {
  return process.env.OBJECTIFIED_CLI_CREDENTIAL_BACKEND === "memory";
}

function toStoredOAuth(bundle: CliOAuthBundle): StoredCliCredential {
  return { kind: "oauth", accessToken: bundle.accessToken, refreshToken: bundle.refreshToken };
}

async function loadKeytar() {
  keytarPromise ??= import("keytar")
    .then((mod) => mod.default)
    .catch((err: unknown) => {
      keytarPromise = null;
      const detail = err instanceof Error ? err.message : String(err);
      throw new ObjectifiedCliError({
        message: `OS keychain is unavailable for CLI credentials (${detail}).`,
        exitCode: EXIT_CODES.GENERIC,
        hint: "Install the required system keychain libraries (for example, libsecret on Linux) or set OBJECTIFIED_CLI_CREDENTIAL_BACKEND=memory for environments without a keychain.",
      });
    });
  return keytarPromise;
}

/** Test helper: clears the in-memory credential map when backend is `memory`. */
export function resetMemoryCredentialBackend(): void {
  memoryBackends.clear();
}

function parseStoredCredential(raw: string): LoadedCliAuth | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const rec = parsed as Record<string, unknown>;
    if (rec.kind === "api_key" && typeof rec.apiKey === "string")
      return { kind: "api_key", apiKey: rec.apiKey };
    if (
      typeof rec.accessToken === "string" &&
      typeof rec.refreshToken === "string" &&
      (rec.kind === undefined || rec.kind === "oauth")
    ) {
      return { kind: "oauth", accessToken: rec.accessToken, refreshToken: rec.refreshToken };
    }
    return null;
  } catch {
    return null;
  }
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
  const keytar = await loadKeytar();
  await keytar.setPassword(SERVICE_NAME, profile, JSON.stringify(stored));
}

export async function saveCliApiKeyCredentials(profile: string, apiKey: string): Promise<void> {
  const stored: StoredCliCredential = { kind: "api_key", apiKey };
  if (useMemoryBackend()) {
    memoryBackends.set(profile, stored);
    return;
  }
  const keytar = await loadKeytar();
  await keytar.setPassword(SERVICE_NAME, profile, JSON.stringify(stored));
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
  const keytar = await loadKeytar();
  const raw = await keytar.getPassword(SERVICE_NAME, profile);
  if (raw === null) return null;
  return parseStoredCredential(raw);
}

export async function deleteCliOAuthCredentials(profile: string): Promise<void> {
  if (useMemoryBackend()) {
    memoryBackends.delete(profile);
    return;
  }
  const keytar = await loadKeytar();
  await keytar.deletePassword(SERVICE_NAME, profile);
}
