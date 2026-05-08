import { Flags } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import { revokeCliRefreshToken } from "../../lib/auth/cli-oauth.js";
import { deleteCliOAuthCredentials, loadCliStoredAuth } from "../../lib/credentials/store.js";
import { listAvailableProfileNames, resolveProfileConfigBaseUrl } from "../../lib/cli-context.js";

export default class AuthLogout extends BaseCommand {
  static description =
    "Revoke CLI refresh token at the API (OAuth profiles) and remove stored credentials from the OS keychain and any encrypted file fallback.";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> --profile staging <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --all-profiles",
    "<%= config.bin %> --json <%= command.id %>",
  ];

  static seeAlso = ["auth login", "auth status", "docs profiles"];

  static flags = {
    ...BaseCommand.baseFlags,
    "all-profiles": Flags.boolean({
      description: "Revoke and clear stored OAuth credentials for every profile in config.",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const flags = this.flags as Record<string, unknown>;
    const allProfiles = Boolean(flags["all-profiles"] ?? flags.allProfiles);

    const targets = allProfiles
      ? listAvailableProfileNames(this.configDoc)
      : [this.context.profile];

    const cleared: string[] = [];
    const revokeFailures: string[] = [];

    for (const profile of targets) {
      const baseUrl = allProfiles
        ? resolveProfileConfigBaseUrl(this.configDoc, profile)
        : this.context.baseUrl;
      const stored = await loadCliStoredAuth(profile);
      if (stored?.kind === "oauth") {
        try {
          await revokeCliRefreshToken({
            apiBaseUrl: baseUrl,
            refreshToken: stored.refreshToken,
          });
        } catch {
          revokeFailures.push(profile);
        }
      }
      await deleteCliOAuthCredentials(profile);
      cleared.push(profile);
    }

    if (cleared.includes(this.context.profile)) {
      this.apiAuth.bearer = undefined;
    }

    if (this.context.json) {
      this.output.json({
        ok: true,
        cleared_profiles: cleared,
        revoke_failed_profiles: revokeFailures,
      });
      return;
    }

    if (revokeFailures.length > 0) {
      this.output.warn(
        `Server revoke failed for profile(s): ${revokeFailures.join(", ")}; local credentials were still cleared.`,
      );
    }

    this.output.success(
      allProfiles
        ? `Logged out (${String(cleared.length)} profile(s)).`
        : `Logged out (profile: ${this.context.profile}).`,
    );
  }
}
