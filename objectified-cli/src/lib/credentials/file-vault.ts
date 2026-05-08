import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash, randomBytes as nodeRandomBytes } from "node:crypto";

import fse from "fs-extra";

import { defaultConfigDirectory } from "../config.js";
import { ObjectifiedCliError } from "../errors.js";
import { EXIT_CODES } from "../exit-codes.js";

const MAGIC = Buffer.from("OBJF", "utf8");
const FORMAT_VERSION = 1;
const PBKDF2_ITERATIONS = 210_000;

export type VaultDeps = {
  homedir: () => string;
  env: NodeJS.ProcessEnv;
  subtle: SubtleCrypto;
  randomBytes: (n: number) => Buffer;
};

export const defaultVaultDeps: VaultDeps = {
  homedir: os.homedir,
  env: process.env,
  subtle: globalThis.crypto.subtle,
  randomBytes: (n) => nodeRandomBytes(n),
};

function vaultRootDir(deps: VaultDeps): string {
  const override = deps.env.OBJECTIFIED_CLI_CREDENTIAL_VAULT_DIR?.trim();
  if (override !== undefined && override !== "") return path.resolve(override);
  return defaultConfigDirectory(deps.env, deps.homedir);
}

export function credentialEncPath(deps: VaultDeps): string {
  const root = vaultRootDir(deps);
  return path.join(root, "credentials.enc");
}

export function credentialPassphrasePath(deps: VaultDeps): string {
  const root = vaultRootDir(deps);
  return path.join(root, ".cli-credential-passphrase");
}

function resolveMachineBinding(deps: VaultDeps): string {
  if (process.platform === "linux") {
    for (const p of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
      try {
        const s = fs.readFileSync(p, "utf8").trim();
        if (s.length > 0) return `linux:${s}`;
      } catch {
        /* ignore */
      }
    }
  }
  const home = deps.homedir();
  const tail = createHash("sha256").update(home).digest("hex").slice(0, 16);
  return `${process.platform}:${os.hostname()}:${tail}`;
}

async function deriveAesKey(
  passphrase: string,
  machineBinding: string,
  subtle: SubtleCrypto,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const saltBytes = new Uint8Array(
    await subtle.digest(
      "SHA-256",
      enc.encode(`objectified-cli/v1/credential-vault|${machineBinding}`),
    ),
  );
  const passBytes = enc.encode(passphrase);
  const keyMaterial = await subtle.importKey("raw", passBytes, "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function chmod600(filePath: string): void {
  if (process.platform === "win32") return;
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    /* ignore */
  }
}

async function readOrCreatePassphrase(deps: VaultDeps): Promise<string> {
  const passPath = credentialPassphrasePath(deps);
  if (await fse.pathExists(passPath)) {
    const existing = (await fse.readFile(passPath, "utf8")).trim();
    if (existing !== "") return existing;
  }
  await fse.ensureDir(path.dirname(passPath));
  const raw = deps.randomBytes(48).toString("base64url");
  await fse.writeFile(passPath, `${raw}\n`, { encoding: "utf8", mode: 0o600 });
  chmod600(passPath);
  return raw;
}

export type VaultPlainV1 = {
  version: 1;
  profiles: Record<string, unknown>;
};

async function encryptVaultJson(plain: VaultPlainV1, deps: VaultDeps): Promise<Buffer> {
  const machineBinding = resolveMachineBinding(deps);
  const passphrase = await readOrCreatePassphrase(deps);
  const key = await deriveAesKey(passphrase, machineBinding, deps.subtle);
  const iv = deps.randomBytes(12);
  const body = new TextEncoder().encode(JSON.stringify(plain));
  const cipherBuf = new Uint8Array(
    await deps.subtle.encrypt({ name: "AES-GCM", iv: new Uint8Array(iv) }, key, body),
  );
  const header = Buffer.alloc(4 + 1 + 12);
  MAGIC.copy(header, 0);
  header.writeUInt8(FORMAT_VERSION, 4);
  iv.copy(header, 5);
  return Buffer.concat([header, Buffer.from(cipherBuf)]);
}

async function decryptVaultToPlain(encPath: string, deps: VaultDeps): Promise<VaultPlainV1> {
  const buf = await fse.readFile(encPath);
  if (buf.length < 4 + 1 + 12 + 16) {
    throw new ObjectifiedCliError({
      message: "Credential vault file is too small or corrupt.",
      exitCode: EXIT_CODES.GENERIC,
      title: "Credential vault",
      hint: vaultCorruptHint(deps),
    });
  }
  if (!buf.subarray(0, 4).equals(MAGIC)) {
    throw new ObjectifiedCliError({
      message: "Credential vault file has an unexpected format.",
      exitCode: EXIT_CODES.GENERIC,
      title: "Credential vault",
      hint: vaultCorruptHint(deps),
    });
  }
  const ver = buf.readUInt8(4);
  if (ver !== FORMAT_VERSION) {
    throw new ObjectifiedCliError({
      message: `Credential vault format version ${String(ver)} is not supported.`,
      exitCode: EXIT_CODES.GENERIC,
      title: "Credential vault",
      hint: "Upgrade the CLI or reset the vault with the documented environment variable.",
    });
  }
  const iv = buf.subarray(5, 17);
  const ciphertext = buf.subarray(17);
  const machineBinding = resolveMachineBinding(deps);
  const passPath = credentialPassphrasePath(deps);
  if (!(await fse.pathExists(passPath))) {
    throw new ObjectifiedCliError({
      message: "Credential vault passphrase file is missing.",
      exitCode: EXIT_CODES.GENERIC,
      title: "Credential vault",
      hint: vaultCorruptHint(deps),
    });
  }
  const passphrase = (await fse.readFile(passPath, "utf8")).trim();
  if (passphrase === "") {
    throw new ObjectifiedCliError({
      message: "Credential vault passphrase file is empty.",
      exitCode: EXIT_CODES.GENERIC,
      title: "Credential vault",
      hint: vaultCorruptHint(deps),
    });
  }
  const key = await deriveAesKey(passphrase, machineBinding, deps.subtle);
  let plainBytes: ArrayBuffer;
  try {
    plainBytes = await deps.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv) },
      key,
      ciphertext,
    );
  } catch {
    throw new ObjectifiedCliError({
      message:
        "Could not decrypt the credential vault (wrong key, corrupt data, or different machine).",
      exitCode: EXIT_CODES.GENERIC,
      title: "Credential vault",
      hint: vaultCorruptHint(deps),
    });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(new Uint8Array(plainBytes))) as unknown;
  } catch {
    throw new ObjectifiedCliError({
      message: "Credential vault decrypted to invalid JSON.",
      exitCode: EXIT_CODES.GENERIC,
      title: "Credential vault",
      hint: vaultCorruptHint(deps),
    });
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ObjectifiedCliError({
      message: "Credential vault JSON has an invalid shape.",
      exitCode: EXIT_CODES.GENERIC,
      title: "Credential vault",
      hint: vaultCorruptHint(deps),
    });
  }
  const rec = parsed as Record<string, unknown>;
  if (
    rec.version !== 1 ||
    typeof rec.profiles !== "object" ||
    rec.profiles === null ||
    Array.isArray(rec.profiles)
  ) {
    throw new ObjectifiedCliError({
      message: "Credential vault JSON is missing version or profiles.",
      exitCode: EXIT_CODES.GENERIC,
      title: "Credential vault",
      hint: vaultCorruptHint(deps),
    });
  }
  return { version: 1, profiles: rec.profiles as Record<string, unknown> };
}

function vaultCorruptHint(deps: VaultDeps): string {
  const enc = credentialEncPath(deps);
  return `If you intentionally removed or rotated secrets, delete "${enc}" and "${credentialPassphrasePath(deps)}" or set OBJECTIFIED_CLI_CREDENTIAL_VAULT_RESET=1 once to remove the vault files (this logs you out of file-backed profiles).`;
}

function resetEnvTruthy(env: NodeJS.ProcessEnv): boolean {
  const v = env.OBJECTIFIED_CLI_CREDENTIAL_VAULT_RESET?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export async function removeVaultFilesIfResetRequested(deps: VaultDeps): Promise<void> {
  if (!resetEnvTruthy(deps.env)) return;
  const enc = credentialEncPath(deps);
  const pass = credentialPassphrasePath(deps);
  await fse.remove(enc).catch(() => undefined);
  await fse.remove(pass).catch(() => undefined);
}

export async function readVaultDocument(deps: VaultDeps): Promise<VaultPlainV1 | null> {
  await removeVaultFilesIfResetRequested(deps);
  const enc = credentialEncPath(deps);
  if (!(await fse.pathExists(enc))) return null;
  const st = await fse.stat(enc);
  if (!st.isFile() || st.size === 0) {
    await fse.remove(enc).catch(() => undefined);
    return null;
  }
  return decryptVaultToPlain(enc, deps);
}

export async function writeVaultDocument(doc: VaultPlainV1, deps: VaultDeps): Promise<void> {
  await removeVaultFilesIfResetRequested(deps);
  const enc = credentialEncPath(deps);
  await fse.ensureDir(path.dirname(enc));
  const tmp = `${enc}.tmp.${String(process.pid)}.${deps.randomBytes(16).toString("hex")}`;
  const payload = await encryptVaultJson(doc, deps);
  let moved = false;
  try {
    await fse.writeFile(tmp, payload, { mode: 0o600 });
    chmod600(tmp);
    await fse.move(tmp, enc, { overwrite: true });
    moved = true;
    chmod600(enc);
  } finally {
    if (!moved) await fse.remove(tmp).catch(() => undefined);
  }
}

export async function mergeProfileIntoVault(
  profile: string,
  wireCredential: Record<string, unknown>,
  deps: VaultDeps,
): Promise<void> {
  await removeVaultFilesIfResetRequested(deps);
  const enc = credentialEncPath(deps);
  let base: VaultPlainV1 = { version: 1, profiles: {} };
  if (await fse.pathExists(enc)) {
    const st = await fse.stat(enc);
    if (st.isFile() && st.size > 0) {
      try {
        base = await decryptVaultToPlain(enc, deps);
      } catch (err) {
        if (resetEnvTruthy(deps.env)) {
          await fse.remove(enc).catch(() => undefined);
          await fse.remove(credentialPassphrasePath(deps)).catch(() => undefined);
          base = { version: 1, profiles: {} };
        } else {
          throw err;
        }
      }
    }
  }
  base.profiles[profile] = wireCredential;
  await writeVaultDocument(base, deps);
}

export async function removeProfileFromVault(profile: string, deps: VaultDeps): Promise<void> {
  await removeVaultFilesIfResetRequested(deps);
  const enc = credentialEncPath(deps);
  if (!(await fse.pathExists(enc))) return;
  let doc: VaultPlainV1;
  try {
    doc = await decryptVaultToPlain(enc, deps);
  } catch {
    return;
  }
  const nextProfiles: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc.profiles)) {
    if (k !== profile) nextProfiles[k] = v;
  }
  doc.profiles = nextProfiles;
  if (Object.keys(doc.profiles).length === 0) {
    await fse.remove(enc).catch(() => undefined);
    await fse.remove(credentialPassphrasePath(deps)).catch(() => undefined);
    return;
  }
  await writeVaultDocument(doc, deps);
}
