import { BaseCommand } from "../../base-command.js";

export default class ConfigPath extends BaseCommand {
  static description = "Print the resolved config.toml path";

  static examples = ["<%= config.bin %> <%= command.id %>"];

  run(): Promise<void> {
    if (this.context.json) {
      process.stdout.write(JSON.stringify({ path: this.resolvedConfigPath }) + "\n");
      return Promise.resolve();
    }
    process.stdout.write(this.resolvedConfigPath + "\n");
    return Promise.resolve();
  }
}
