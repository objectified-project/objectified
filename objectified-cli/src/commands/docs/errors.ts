import { BaseCommand } from "../../base-command.js";
import { exitCodeReferenceJson, formatExitCodeDocs } from "../../lib/exit-codes.js";

export default class DocsErrors extends BaseCommand {
  static description = "Exit codes, hints, and error-handling reference";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --json",
    "<%= config.bin %> projects list --json",
  ];

  static seeAlso = ["docs", "docs output", "hello"];

  run(): Promise<void> {
    if (this.context.json) {
      this.output.json(exitCodeReferenceJson());
      return Promise.resolve();
    }
    this.output.text(formatExitCodeDocs());
    return Promise.resolve();
  }
}
