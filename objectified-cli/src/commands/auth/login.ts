import { Flags } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import { readApiKeyInteractively } from "../../lib/auth/read-secret-api-key.js";
import { runCliPkceLogin } from "../../lib/auth/cli-login-flow.js";
import { API_KEY_PROMPT_SENTINEL, DEFAULT_CLI_WEB_LOGIN_URL } from "../../lib/constants.js";
import { saveCliApiKeyCredentials, saveCliOAuthCredentials } from "../../lib/credentials/store.js";
import { ObjectifiedCliError } from "../../lib/errors.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";
import { authLoginIntendsApiKeyStore } from "../../lib/normalize-argv.js";

export default class AuthLogin extends BaseCommand {
  static description =
    "Sign in via PKCE browser flow or store an API key in the OS keychain (`--api-key`).";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> --profile staging <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --no-browser",
    "<%= config.bin %> <%= command.id %> --api-key",
    "<%= config.bin %> <%= command.id %> --api-key sk_live_…",
    "<%= config.bin %> --json <%= command.id %>",
  ];

  static seeAlso = ["auth logout", "auth status", "docs profiles"];

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

    const storeApiKey = authLoginIntendsApiKeyStore(this.normalizedArgv);

    if (storeApiKey) {
      let rawKey = this.flags["api-key"] as string | undefined;
      if (rawKey === API_KEY_PROMPT_SENTINEL) {
        rawKey = await readApiKeyInteractively();
      }
      const trimmed = rawKey?.trim();
      if (trimmed === undefined || trimmed === "") {
        throw new ObjectifiedCliError({
          message: "API key is required.",
          exitCode: EXIT_CODES.MISUSE,
          title: "Invalid usage",
          hint: "Pass `--api-key <key>`, pipe stdin for non-TTY sessions, or omit the value for an interactive prompt.",
        });
      }

      await saveCliApiKeyCredentials(this.context.profile, trimmed);
      this.apiAuth.apiKey = trimmed;
      this.apiAuth.bearer = undefined;
      this.activeCredential = {
        kind: "api_key_keychain",
        authenticated: true,
      };

      if (this.context.json) {
        this.output.json({
          ok: true,
          profile: this.context.profile,
          credential: "api_key",
        });
        return;
      }

      this.output.success(`API key stored for profile '${this.context.profile}'`);
      this.output.hint(
        "Per-invocation keys (`OBJECTIFIED_API_KEY`) still override the stored key.",
      );
      return;
    }

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
    this.apiAuth.apiKey = undefined;
    this.apiAuth.bearer = bundle.accessToken;

    const tenant = this.context.tenantSlug;
    const email = bundle.displayEmail ?? "unknown user";

    if (this.context.json) {
      this.output.json({
        ok: true,
        profile: this.context.profile,
        email: bundle.displayEmail ?? null,
        tenant_slug: tenant ?? null,
        credential: "oauth",
      });
      return;
    }

    const tenantBit = tenant ? ` (tenant: ${tenant})` : "";
    this.output.success(`Logged in as ${email}${tenantBit}`);
    this.output.hint(`Profile: ${this.context.profile}`);
    this.output.hint("Run `objectified tenants use <slug>` to change the active tenant.");
  }
}
