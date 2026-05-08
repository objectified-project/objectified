import { BaseCommand } from "../../base-command.js";
import {
  buildAuthStatusStableJson,
  fetchCliWhoami,
  formatAuthStatusHumanLines,
} from "../../lib/auth/cli-whoami.js";
import { loadCliStoredAuth, saveCliOAuthCredentials } from "../../lib/credentials/store.js";
import { ObjectifiedCliError } from "../../lib/errors.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";

export default class AuthStatus extends BaseCommand {
  static description =
    "Show active profile, API base URL, tenant, user, auth type, token expiry, and plan (GET /v1/auth/cli/whoami).";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> --profile staging <%= command.id %>",
    "<%= config.bin %> --json <%= command.id %>",
  ];

  static aliases = ["whoami"];

  static seeAlso = ["auth login", "auth logout", "docs output", "docs profiles"];

  async run(): Promise<void> {
    if (!this.activeCredential.authenticated) {
      throw new ObjectifiedCliError({
        message: "No credentials configured for this invocation.",
        exitCode: EXIT_CODES.NOT_AUTHENTICATED,
        title: "Not authenticated",
        hint: "Run `objectified auth login`, set OBJECTIFIED_API_KEY, or pass --api-key / --api-key-file.",
      });
    }

    const stored =
      this.activeCredential.kind === "oauth_keychain"
        ? await loadCliStoredAuth(this.context.profile)
        : undefined;
    const oauthRefresh =
      stored?.kind === "oauth" && this.activeCredential.kind === "oauth_keychain"
        ? {
            refreshToken: stored.refreshToken,
            onRotated: async (accessToken: string, refreshToken: string) => {
              await saveCliOAuthCredentials(this.context.profile, {
                accessToken,
                refreshToken,
              });
            },
          }
        : undefined;

    const model = await fetchCliWhoami({
      baseUrl: this.context.baseUrl,
      auth: this.apiAuth,
      activeCredentialKind: this.activeCredential.kind,
      oauthRefresh,
    });

    if (this.context.json) {
      this.output.json(
        buildAuthStatusStableJson({
          profile: this.context.profile,
          baseUrl: this.context.baseUrl,
          profileTenantSlug: this.context.tenantSlug,
          model,
          activeCredentialKind: this.activeCredential.kind,
          bearer: this.apiAuth.bearer,
        }),
      );
      return;
    }

    for (const line of formatAuthStatusHumanLines({
      profile: this.context.profile,
      baseUrl: this.context.baseUrl,
      profileTenantSlug: this.context.tenantSlug,
      model,
      activeCredentialKind: this.activeCredential.kind,
      bearer: this.apiAuth.bearer,
    })) {
      this.output.text(line);
    }
  }
}
