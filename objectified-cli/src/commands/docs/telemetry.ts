import { BaseCommand } from "../../base-command.js";
import { docsTopicTelemetry } from "../../lib/docs-content.js";

export default class DocsTelemetry extends BaseCommand {
  static description = "Telemetry posture and safe verbose debugging";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> --verbose hello\n<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> > notes.txt",
  ];

  static seeAlso = ["docs errors", "docs output"];

  run(): Promise<void> {
    if (this.context.json) {
      this.output.json({ topic: "telemetry", body: docsTopicTelemetry });
      return Promise.resolve();
    }
    this.output.text(docsTopicTelemetry);
    return Promise.resolve();
  }
}
