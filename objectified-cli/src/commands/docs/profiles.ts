import { BaseCommand } from "../../base-command.js";
import { docsTopicProfiles } from "../../lib/docs-content.js";

export default class DocsProfiles extends BaseCommand {
  static description = "config.toml profiles, defaults, and precedence rules";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> --profile staging config path",
    "<%= config.bin %> <%= command.id %> | sed -n '1,12p'",
  ];

  static seeAlso = ["docs", "config path", "config get"];

  run(): Promise<void> {
    if (this.context.json) {
      this.output.json({ topic: "profiles", body: docsTopicProfiles });
      return Promise.resolve();
    }
    this.output.text(docsTopicProfiles);
    return Promise.resolve();
  }
}
