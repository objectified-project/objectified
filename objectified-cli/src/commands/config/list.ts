import TOML from "@iarna/toml";

import { BaseCommand } from "../../base-command.js";
import { loadRawTomlDocument } from "../../lib/config.js";

export default class ConfigList extends BaseCommand {
  static description = "Print the entire config file (stable JSON with --json, otherwise TOML)";

  static examples = ["<%= config.bin %> <%= command.id %>"];

  run(): Promise<void> {
    const raw = loadRawTomlDocument(this.resolvedConfigPath);
    if (this.context.json) {
      this.output.json(raw);
      return Promise.resolve();
    }
    process.stdout.write(TOML.stringify(raw) + "\n");
    return Promise.resolve();
  }
}
