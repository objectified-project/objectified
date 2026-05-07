import { Command } from "@oclif/core";

import { createApiClient } from "./lib/client.js";
import { resolveConfig } from "./lib/config.js";

/** Base for commands that talk to the Objectified HTTP API (expanded in later roadmap tickets). */
export abstract class BaseCommand extends Command {
  /** Minimal API handle until OpenAPI codegen lands. */
  protected api!: ReturnType<typeof createApiClient>;

  async init(): Promise<void> {
    await super.init();
    const cfg = resolveConfig();
    this.api = createApiClient(cfg.baseUrl);
  }
}
