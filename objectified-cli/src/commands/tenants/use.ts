import fs from "node:fs";

import { Args, Flags } from "@oclif/core";
import TOML from "@iarna/toml";
import leven from "leven";

import { BaseCommand } from "../../base-command.js";
import type { ObjectifiedApi } from "../../lib/client.js";
import {
  defaultConfigToml,
  deleteNestedValue,
  loadRawTomlDocument,
  parseTomlConfig,
  saveRawTomlDocument,
  setNestedValue,
  splitDottedKey,
} from "../../lib/config.js";
import { CliError, ObjectifiedCliError } from "../../lib/errors.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";

const ME_PAGE = 100;

async function collectAccessibleSlugs(api: ObjectifiedApi): Promise<string[]> {
  const slugs: string[] = [];
  let offset = 0;
  for (;;) {
    const page = await api.listMyTenantsPage(ME_PAGE, offset);
    for (const it of page.items) slugs.push(it.slug);
    if (page.items.length === 0 || slugs.length >= page.total) break;
    offset += ME_PAGE;
    if (offset > 50_000) break;
  }
  return slugs;
}

export default class TenantsUse extends BaseCommand {
  static description =
    "Set or clear the default tenant slug for the active profile (writes tenant_slug in config.toml; validates via HEAD /v1/tenants/{slug})";

  static examples = [
    "<%= config.bin %> <%= command.id %> acme-corp",
    "<%= config.bin %> tenants use --profile staging acme-staging",
    "<%= config.bin %> --json <%= command.id %> acme-corp",
    "<%= config.bin %> <%= command.id %> --clear",
  ];

  static seeAlso = ["tenants list", "config path", "docs profiles"];

  static flags = {
    clear: Flags.boolean({
      description:
        "Remove tenant_slug from this profile so each command needs --tenant or OBJECTIFIED_TENANT.",
      default: false,
    }),
  };

  static args = {
    slug: Args.string({
      description: "Tenant slug to use as the profile default",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const clear = Boolean(this.flags.clear);
    const rawSlug = this.commandArgs.slug;
    const slugArg = typeof rawSlug === "string" ? rawSlug.trim() : "";

    if (clear && slugArg !== "") {
      throw new ObjectifiedCliError({
        message: "Use either a tenant slug or --clear, not both.",
        exitCode: EXIT_CODES.MISUSE,
        title: "Invalid usage",
      });
    }

    if (!clear && slugArg === "") {
      throw new ObjectifiedCliError({
        message: "Missing tenant slug.",
        exitCode: EXIT_CODES.MISUSE,
        title: "Invalid usage",
        hint: "Run `objectified tenants use <slug>` or `objectified tenants use --clear`.",
      });
    }

    let raw = loadRawTomlDocument(this.resolvedConfigPath);
    if (Object.keys(raw).length === 0) {
      raw = TOML.parse(defaultConfigToml());
    }

    const profile = this.context.profile;
    const dottedProfileTenant = `profile.${profile}.tenant_slug`;

    if (clear) {
      const removed = deleteNestedValue(raw, splitDottedKey(dottedProfileTenant));
      if (removed) {
        saveRawTomlDocument(this.resolvedConfigPath, raw);
        try {
          parseTomlConfig(fs.readFileSync(this.resolvedConfigPath, "utf8"));
        } catch (e) {
          throw new CliError(
            `Updated config failed validation: ${e instanceof Error ? e.message : String(e)}`,
            11,
          );
        }
      }

      if (this.context.json) {
        this.output.json({ cleared: true, profile, removed });
        return;
      }

      const msg = removed
        ? `✔ Cleared default tenant for profile '${profile}'.`
        : `Profile '${profile}' had no tenant_slug to clear.`;
      this.output.text(msg);
      return;
    }

    this.ensureAuthenticated();

    try {
      await this.api.verifyTenantAccess(slugArg);
    } catch (err: unknown) {
      if (err instanceof ObjectifiedCliError && err.exitCode === EXIT_CODES.NOT_FOUND) {
        const slugs = await collectAccessibleSlugs(this.api);
        const scored = slugs
          .map((s) => ({ s, d: leven(slugArg, s) }))
          .filter((x) => x.d > 0 && x.d < 3)
          .sort((a, b) => a.d - b.d || a.s.localeCompare(b.s))
          .slice(0, 5);
        const hint =
          scored.length > 0
            ? `Did you mean: ${scored.map((x) => x.s).join(", ")}?`
            : "Run `objectified tenants list` to see tenants you can access.";
        throw new ObjectifiedCliError({
          message: `Unknown tenant slug "${slugArg}".`,
          exitCode: EXIT_CODES.NOT_FOUND,
          title: "Tenant not found",
          hint,
          requestId: err.requestId,
          retriesAttempted: err.retriesAttempted,
        });
      }
      if (err instanceof ObjectifiedCliError && err.exitCode === EXIT_CODES.FORBIDDEN) {
        throw new ObjectifiedCliError({
          message: err.message,
          exitCode: EXIT_CODES.FORBIDDEN,
          title: "No tenant access",
          hint: "Request access from your administrator, or pick another tenant (`objectified tenants list`).",
          requestId: err.requestId,
          retriesAttempted: err.retriesAttempted,
        });
      }
      throw err;
    }

    setNestedValue(raw, splitDottedKey(dottedProfileTenant), slugArg);
    saveRawTomlDocument(this.resolvedConfigPath, raw);
    try {
      parseTomlConfig(fs.readFileSync(this.resolvedConfigPath, "utf8"));
    } catch (e) {
      throw new CliError(
        `Updated config failed validation: ${e instanceof Error ? e.message : String(e)}`,
        11,
      );
    }

    if (this.context.json) {
      this.output.json({ profile, tenant_slug: slugArg });
      return;
    }

    this.output.text(`✔ Active tenant for profile '${profile}' is now '${slugArg}'.`);
  }
}
