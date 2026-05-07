import { BaseCommand } from "../base-command.js";
import { DOCS_TOPIC_INDEX } from "../lib/docs-index.js";

export default class Docs extends BaseCommand {
  static description =
    "List documentation topics (`objectified docs`) or open one with `objectified docs <topic>`.";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> output",
    "<%= config.bin %> --json <%= command.id %>",
  ];

  static seeAlso = ["docs errors", "hello", "config path"];

  run(): Promise<void> {
    if (this.context.json) {
      this.output.json({ topics: DOCS_TOPIC_INDEX });
      return Promise.resolve();
    }

    this.output.table(
      DOCS_TOPIC_INDEX.map((t) => ({
        topic: t.topic,
        summary: t.summary,
      })),
      [
        { key: "topic", label: "Topic" },
        { key: "summary", label: "Summary" },
      ],
    );
    this.output.text(
      `\nRun ${this.config.bin} docs <topic> for full prose (try ${this.config.bin} docs output).`,
    );
    return Promise.resolve();
  }
}
