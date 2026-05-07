import TOML from "@iarna/toml";

import { BaseCommand } from "../../base-command.js";
import { loadRawTomlDocument } from "../../lib/config.js";

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const sortedKeys = Object.keys(o).sort();
    const out: Record<string, unknown> = {};
    for (const k of sortedKeys) out[k] = sortKeysDeep(o[k]);
    return out;
  }
  return value;
}

export default class ConfigList extends BaseCommand {
  static description = "Print the entire config file (stable JSON with --json, otherwise TOML)";

  static examples = ["<%= config.bin %> <%= command.id %>"];

  run(): Promise<void> {
    const raw = loadRawTomlDocument(this.resolvedConfigPath);
    if (this.context.json) {
      process.stdout.write(JSON.stringify(sortKeysDeep(raw), null, 2) + "\n");
      return Promise.resolve();
    }
    process.stdout.write(TOML.stringify(raw) + "\n");
    return Promise.resolve();
  }
}
