import { Args } from "@oclif/core";

import { BaseCommand } from "../base-command.js";
import { logInfo } from "../lib/output.js";

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

  async run(): Promise<void> {
    const { args } = await this.parse(Hello);
    const who = args.name ?? "world";
    logInfo(this, `Hello ${who} from Objectified CLI`);
  }
}
