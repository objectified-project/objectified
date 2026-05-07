import fs from "node:fs";

import TOML from "@iarna/toml";
import { Args } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import {
  assertWritableConfigKey,
  defaultConfigToml,
  loadRawTomlDocument,
  parseTomlConfig,
  saveRawTomlDocument,
  setNestedValue,
  splitDottedKey,
} from "../../lib/config.js";
import { CliError } from "../../lib/errors.js";

export default class ConfigSet extends BaseCommand {
  static description = "Set a config value by dotted key and persist config.toml";

  static examples = [
    "<%= config.bin %> <%= command.id %> profile.staging.base_url https://api.staging.example",
    "<%= config.bin %> <%= command.id %> default_profile staging",
    "<%= config.bin %> --json <%= command.id %> profile.prod.tenant_slug acme-corp",
  ];

  static seeAlso = ["config get", "docs profiles"];

  static args = {
    key: Args.string({
      description: "Dotted path (e.g. default_profile, profile.prod.tenant_slug)",
      required: true,
    }),
    value: Args.string({
      description: "New value (stored as a TOML string)",
      required: true,
    }),
  };

  run(): Promise<void> {
    const key = this.commandArgs.key;
    const value = this.commandArgs.value;
    if (typeof key !== "string" || typeof value !== "string") {
      throw new CliError("Usage: objectified config set <key> <value>", 11);
    }

    assertWritableConfigKey(key);

    let raw = loadRawTomlDocument(this.resolvedConfigPath);
    if (Object.keys(raw).length === 0) {
      raw = TOML.parse(defaultConfigToml());
    }

    setNestedValue(raw, splitDottedKey(key), value);
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
      process.stdout.write(JSON.stringify({ key, value }) + "\n");
    }
    return Promise.resolve();
  }
}
