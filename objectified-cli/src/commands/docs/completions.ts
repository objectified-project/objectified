import { BaseCommand } from "../../base-command.js";
import { docsTopicCompletions } from "../../lib/docs-content.js";

export default class DocsCompletions extends BaseCommand {
  static description = "Shell completions roadmap and interim guidance";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> --help",
    "<%= config.bin %> <%= command.id %> --json",
  ];

  static seeAlso = ["docs", "docs output"];

  run(): Promise<void> {
    if (this.context.json) {
      this.output.json({ topic: "completions", body: docsTopicCompletions });
      return Promise.resolve();
    }
    this.output.text(docsTopicCompletions);
    return Promise.resolve();
  }
}
