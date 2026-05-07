import { BaseCommand } from "../../base-command.js";
import { docsTopicPlugins } from "../../lib/docs-content.js";

export default class DocsPlugins extends BaseCommand {
  static description = "Future oclif plugin extensibility for Objectified";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --json",
    "<%= config.bin %> docs telemetry",
  ];

  static seeAlso = ["docs", "docs telemetry"];

  run(): Promise<void> {
    if (this.context.json) {
      this.output.json({ topic: "plugins", body: docsTopicPlugins });
      return Promise.resolve();
    }
    this.output.text(docsTopicPlugins);
    return Promise.resolve();
  }
}
