import { BaseCommand } from "../../base-command.js";
import { logInfo, writeJsonLine } from "../../lib/output.js";

export default class ProjectsList extends BaseCommand {
  static description = "List Objectified projects";

  static examples = ["<%= config.bin %> <%= command.id %>"];

  run(): Promise<void> {
    const payload = { projects: [] as unknown[] };
    writeJsonLine(this, payload);
    logInfo(this, "No projects yet.");
    return Promise.resolve();
  }
}
