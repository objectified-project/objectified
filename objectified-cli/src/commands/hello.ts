import { Args } from "@oclif/core";

import { BaseCommand } from "../base-command.js";
import { logInfo, writeJsonLine } from "../lib/output.js";

export default class Hello extends BaseCommand {
  static description = "Smoke-test greeting for the Objectified CLI";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> Ada",
  ];

  static args = {
    name: Args.string({
      description: "Who to greet",
      required: false,
    }),
  };

  run(): Promise<void> {
    const rawName = this.commandArgs.name;
    const who = typeof rawName === "string" ? rawName : "world";
    const message = `Hello ${who} from Objectified CLI`;
    writeJsonLine(this, { message });
    logInfo(this, message);
    return Promise.resolve();
  }
}
