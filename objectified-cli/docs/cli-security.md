# CLI credential security

This document describes how the `objectified` CLI handles API keys and OAuth tokens, and what it does **not** guarantee.

## Storage layers

1. **Primary — OS secret service (`keytar`)**
   - **macOS:** Keychain
   - **Linux:** libsecret (GNOME Keyring / KWallet, when a secret service is available)
   - **Windows:** Credential Vault

   Each profile has one entry: service name `objectified-cli`, account name equal to the profile name (for example `default` or `staging`). The stored value is JSON (never printed by the CLI in normal operation).

2. **Fallback — encrypted file**  
   When `keytar` cannot load or use the system store (common in containers or minimal Linux images without libsecret), credentials are written under the same config directory as `config.toml`:
   - `credentials.enc` — AES-256-GCM ciphertext (format version 1, IV prepended, PBKDF2-derived key).
   - `.cli-credential-passphrase` — a one-time random passphrase used only with PBKDF2 together with a **machine binding** (for example Linux `/etc/machine-id` when present).

   Both files are created with mode **0600** on Unix. The CLI prints a **one-time warning on stderr** when this fallback is used (suppressed under Vitest when `VITEST` is set).

3. **In-memory test backend**  
   Set `OBJECTIFIED_CLI_CREDENTIAL_BACKEND=memory` so Vitest and CI never touch the real keychain or vault files.

## Resolution order (per invocation)

Credentials used for HTTP requests are resolved as documented in the product issue pack:

1. `--api-key`
2. `OBJECTIFIED_API_KEY`
3. Stored credentials: keychain first, then encrypted file for the active profile
4. None → unauthenticated commands exit with code **3** and a login hint

`OBJECTIFIED_ACCESS_TOKEN` is still evaluated for bearer-in-env flows; it does not use the vault.

## Log safety

- Verbose HTTP logging uses **redacted** API keys (`sk_***` / `pk_***`) and **never** prints bearer tokens (only `bearer=***`).
- Tokens are not passed on the process command line after login (use stored credentials or env as above).

## Profile isolation

Updates are **per profile**. Saving or deleting profile `staging` does not remove credentials for `prod` or `default`. The encrypted vault file holds a JSON map of profile name → credential payload; deleting one profile rewrites the vault without dropping others.

## Recovery and overrides

| Variable                                           | Purpose                                                                                                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `OBJECTIFIED_CLI_CREDENTIAL_VAULT_DIR`             | Store `credentials.enc` and passphrase in this directory (absolute path). Intended for tests; must remain private.                                                                                     |
| `OBJECTIFIED_CLI_CREDENTIAL_VAULT_RESET`           | When set to `1`/`true`/`yes`, the next vault operation **deletes** the vault files so a fresh vault can be created. Use after backup if you treat this as destructive logout for file-backed profiles. |
| `OBJECTIFIED_CLI_CREDENTIAL_DISABLE_FILE_FALLBACK` | When `1`/`true`/`yes`, a missing or broken keychain surfaces an error instead of silently using the file vault.                                                                                        |

## Threat model (pragmatic)

**Mitigates**

- **Casual leakage** from world-readable files: vault and passphrase are private to the user (`0600`), not world-readable.
- **Accidental git commits:** paths are under the user config dir, not the project tree.
- **Shell history:** login avoids putting secrets on the command line when using browser / stdin flows; API keys can still be passed explicitly—prefer `--api-key-file` or piping.
- **Cross-profile mistakes:** operations are scoped by profile name.

**Does not mitigate**

- **Malware or a compromised user account** with your UID can read `credentials.enc`, the passphrase file, memory, or attach a debugger. This is the same class of threat as any other local secret.
- **Root on the machine** can read all user files.
- **File backup tools** that copy `~/.config/objectified/` copy ciphertext **and** the passphrase file; treat backups like secrets.
- **Shared development machines:** anyone with your login session can use stored credentials.

**Operational guidance**

- Prefer the OS keychain on workstations.
- On servers, prefer short-lived tokens, `OBJECTIFIED_API_KEY` from a secret manager, or CI `memory` backend over long-lived file vaults on shared disks.
- Rotate API keys and run `objectified auth logout` when a machine is decommissioned.

## Related

- `objectified docs profiles` — config vs secrets.
- `objectified docs output` — verbose and redaction rules.
