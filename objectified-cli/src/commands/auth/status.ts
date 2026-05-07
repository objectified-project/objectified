import { BaseCommand } from "../../base-command.js";
import { credentialKindLabel } from "../../lib/active-credential.js";
import { ObjectifiedCliError } from "../../lib/errors.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";

export default class AuthStatus extends BaseCommand {
  static description =
    "Show the active profile, base URL, and whether you are using an API key or OAuth token.";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> --profile staging <%= command.id %>",
    "<%= config.bin %> --json <%= command.id %>",
  ];

  static seeAlso = ["auth login", "auth logout", "docs profiles"];

  run(): Promise<void> {
    if (!this.activeCredential.authenticated) {
      throw new ObjectifiedCliError({
        message: "No credentials configured for this invocation.",
        exitCode: EXIT_CODES.NOT_AUTHENTICATED,
        title: "Not authenticated",
        hint: "Run `objectified auth login`, set OBJECTIFIED_API_KEY, or pass --api-key / --api-key-file.",
      });
    }

    if (this.context.json) {
      this.output.json({
        profile: this.context.profile,
        base_url: this.context.baseUrl,
        tenant_slug: this.context.tenantSlug ?? null,
        credential_kind: this.activeCredential.kind,
        authenticated: true,
      });
      return Promise.resolve();
    }

    this.output.text(`Profile:    ${this.context.profile}`);
    this.output.text(`Base URL:   ${this.context.baseUrl}`);
    const tenant =
      this.context.tenantSlug !== undefined && this.context.tenantSlug !== ""
        ? this.context.tenantSlug
        : "(not set)";
    this.output.text(`Tenant:     ${tenant}`);
    this.output.text(`Credential: ${credentialKindLabel(this.activeCredential.kind)}`);
    return Promise.resolve();
  }
}
