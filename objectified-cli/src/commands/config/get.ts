import { Args } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import {
  formatConfigScalar,
  getNestedValue,
  loadRawTomlDocument,
  splitDottedKey,
} from "../../lib/config.js";
import { CliError } from "../../lib/errors.js";

export default class ConfigGet extends BaseCommand {
  static description = "Print a single config value by dotted key";

  static examples = [
    "<%= config.bin %> <%= command.id %> default_profile",
    "<%= config.bin %> <%= command.id %> profile.prod.base_url",
    "<%= config.bin %> --json <%= command.id %> profile.staging.tenant_slug",
  ];

  static seeAlso = ["config set", "config path"];

  static args = {
    key: Args.string({
      description: "Dotted path (e.g. default_profile, profile.prod.base_url)",
      required: true,
    }),
  };

  run(): Promise<void> {
    const key = this.commandArgs.key;
    if (typeof key !== "string") throw new CliError("Missing config key.", 11);

    const raw = loadRawTomlDocument(this.resolvedConfigPath);
    const parts = splitDottedKey(key);
    const value = getNestedValue(raw, parts);
    if (value === undefined) {
      throw new CliError(`No value for "${key}".`, 11);
    }

    const printed = formatConfigScalar(value);
    if (this.context.json) {
      process.stdout.write(JSON.stringify({ key, value: printed }) + "\n");
      return Promise.resolve();
    }
    process.stdout.write(printed + "\n");
    return Promise.resolve();
  }
}
