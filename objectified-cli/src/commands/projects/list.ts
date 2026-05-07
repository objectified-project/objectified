import { BaseCommand } from "../../base-command.js";
import { chalkForContext } from "../../lib/output.js";

export default class ProjectsList extends BaseCommand {
  static description = "List Objectified projects";

  static examples = ["<%= config.bin %> <%= command.id %>"];

  run(): Promise<void> {
    const payload = { projects: [] as unknown[] };
    if (this.context.json) {
      this.output.json(payload);
    } else {
      this.output.text(chalkForContext(this.context.color).bold("No projects yet."));
    }
    return Promise.resolve();
  }
}
