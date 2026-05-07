import { BaseCommand } from "../../base-command.js";
import { docsTopicOutput } from "../../lib/docs-content.js";

export default class DocsOutput extends BaseCommand {
  static description = "TTY vs JSON output, quiet mode, verbose logs, and color";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> --json hello",
    "<%= config.bin %> <%= command.id %> > ./output-notes.txt",
  ];

  static seeAlso = ["docs", "docs errors", "hello"];

  run(): Promise<void> {
    if (this.context.json) {
      this.output.json({ topic: "output", body: docsTopicOutput });
      return Promise.resolve();
    }
    this.output.text(docsTopicOutput);
    return Promise.resolve();
  }
}
