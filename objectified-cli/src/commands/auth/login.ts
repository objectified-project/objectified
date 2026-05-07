import { Flags } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import { runCliPkceLogin } from "../../lib/auth/cli-login-flow.js";
import { DEFAULT_CLI_WEB_LOGIN_URL } from "../../lib/constants.js";
import { saveCliOAuthCredentials } from "../../lib/credentials/store.js";

export default class AuthLogin extends BaseCommand {
  static description = "Sign in via PKCE browser flow (stores tokens in the OS keychain).";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> --profile staging <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --no-browser",
    "<%= config.bin %> --json <%= command.id %>",
  ];

  static seeAlso = ["auth logout", "docs profiles"];

  static flags = {
    ...BaseCommand.baseFlags,
    "no-browser": Flags.boolean({
      description:
        "Do not launch a browser; print the login URL and read the authorization code from stdin.",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const flags = this.flags as Record<string, unknown>;
    const noBrowser = Boolean(flags["no-browser"] ?? flags.noBrowser);

    const useStdout = !this.context.json && !this.flags.quiet;
    const humanOut = (line: string): void => {
      if (useStdout) this.output.text(line);
      else process.stderr.write(`${line}\n`);
    };

    const bundle = await runCliPkceLogin({
      apiBaseUrl: this.context.baseUrl,
      webLoginUrl: DEFAULT_CLI_WEB_LOGIN_URL,
      noBrowserFlag: noBrowser,
      openBrowser: true,
      stdoutLine: humanOut,
      stderrLine: (line) => process.stderr.write(`${line}\n`),
    });

    await saveCliOAuthCredentials(this.context.profile, {
      accessToken: bundle.accessToken,
      refreshToken: bundle.refreshToken,
    });
    this.apiAuth.bearer = bundle.accessToken;

    const tenant = this.context.tenantSlug;
    const email = bundle.displayEmail ?? "unknown user";

    if (this.context.json) {
      this.output.json({
        ok: true,
        profile: this.context.profile,
        email: bundle.displayEmail ?? null,
        tenant_slug: tenant ?? null,
      });
      return;
    }

    const tenantBit = tenant ? ` (tenant: ${tenant})` : "";
    this.output.success(`Logged in as ${email}${tenantBit}`);
    this.output.hint(`Profile: ${this.context.profile}`);
    this.output.hint("Run `objectified tenants use <slug>` to change the active tenant.");
  }
}
