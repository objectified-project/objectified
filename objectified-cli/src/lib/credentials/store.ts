import { ObjectifiedCliError } from "../errors.js";
import { EXIT_CODES } from "../exit-codes.js";

const SERVICE_NAME = "objectified-cli";

export type CliOAuthBundle = {
  accessToken: string;
  refreshToken: string;
};

const memoryBackends = new Map<string, CliOAuthBundle>();
let keytarPromise: Promise<{
  setPassword: (service: string, account: string, password: string) => Promise<void>;
  getPassword: (service: string, account: string) => Promise<string | null>;
  deletePassword: (service: string, account: string) => Promise<boolean>;
}> | null = null;

function useMemoryBackend(): boolean {
  return process.env.OBJECTIFIED_CLI_CREDENTIAL_BACKEND === "memory";
}

function toStoredBundle(bundle: CliOAuthBundle): CliOAuthBundle {
  return {
    accessToken: bundle.accessToken,
    refreshToken: bundle.refreshToken,
  };
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
        hint:
          "Install the required system keychain libraries (for example, libsecret on Linux) or set OBJECTIFIED_CLI_CREDENTIAL_BACKEND=memory for environments without a keychain.",
      });
    });
  return keytarPromise;
}

/** Test helper: clears the in-memory credential map when backend is `memory`. */
export function resetMemoryCredentialBackend(): void {
  memoryBackends.clear();
}

export async function saveCliOAuthCredentials(
  profile: string,
  bundle: CliOAuthBundle,
): Promise<void> {
  const stored = toStoredBundle(bundle);
  if (useMemoryBackend()) {
    memoryBackends.set(profile, stored);
    return;
  }
  const keytar = await loadKeytar();
  await keytar.setPassword(SERVICE_NAME, profile, JSON.stringify(stored));
}

export async function loadCliOAuthCredentials(profile: string): Promise<CliOAuthBundle | null> {
  if (useMemoryBackend()) {
    return memoryBackends.get(profile) ?? null;
  }
  const keytar = await loadKeytar();
  const raw = await keytar.getPassword(SERVICE_NAME, profile);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as CliOAuthBundle).accessToken !== "string" ||
      typeof (parsed as CliOAuthBundle).refreshToken !== "string"
    ) {
      return null;
    }
    return parsed as CliOAuthBundle;
  } catch {
    return null;
  }
}

export async function deleteCliOAuthCredentials(profile: string): Promise<void> {
  if (useMemoryBackend()) {
    memoryBackends.delete(profile);
    return;
  }
  const keytar = await loadKeytar();
  await keytar.deletePassword(SERVICE_NAME, profile);
}
