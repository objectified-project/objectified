import keytar from "keytar";

const SERVICE_NAME = "objectified-cli";

export type CliOAuthBundle = {
  accessToken: string;
  refreshToken: string;
};

const memoryBackends = new Map<string, CliOAuthBundle>();

function useMemoryBackend(): boolean {
  return process.env.OBJECTIFIED_CLI_CREDENTIAL_BACKEND === "memory";
}

/** Test helper: clears the in-memory credential map when backend is `memory`. */
export function resetMemoryCredentialBackend(): void {
  memoryBackends.clear();
}

export async function saveCliOAuthCredentials(
  profile: string,
  bundle: CliOAuthBundle,
): Promise<void> {
  if (useMemoryBackend()) {
    memoryBackends.set(profile, bundle);
    return;
  }
  await keytar.setPassword(SERVICE_NAME, profile, JSON.stringify(bundle));
}

export async function loadCliOAuthCredentials(profile: string): Promise<CliOAuthBundle | null> {
  if (useMemoryBackend()) {
    return memoryBackends.get(profile) ?? null;
  }
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
  await keytar.deletePassword(SERVICE_NAME, profile);
}
