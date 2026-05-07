import os from "node:os";

import { Command, Flags } from "@oclif/core";
import supportsColor from "supports-color";

import { createApiClient } from "./lib/client.js";
import {
  buildObjectifiedContext,
  resolveConfigPath,
  type GlobalCliFlags,
  type ObjectifiedContext,
} from "./lib/cli-context.js";
import { loadTomlConfigFile } from "./lib/config.js";

export abstract class BaseCommand extends Command {
  static baseFlags = {
    apiKey: Flags.string({
      name: "api-key",
      description: "API key for direct authentication (bypasses login token).",
      helpGroup: "GLOBAL",
    }),
    baseUrl: Flags.string({
      name: "base-url",
      description: "Root REST API URL.",
      helpGroup: "GLOBAL",
    }),
    config: Flags.string({
      description: `Path to config file (default: ~/.config/objectified/config.toml).`,
      helpGroup: "GLOBAL",
    }),
    json: Flags.boolean({
      description:
        "Emit machine-readable JSON (OBJECTIFIED_JSON=1; auto-enabled when stdout is not a TTY).",
      allowNo: true,
      helpGroup: "GLOBAL",
    }),
    noColor: Flags.boolean({
      name: "no-color",
      description: "Disable ANSI colors (NO_COLOR=1; colors are off when stdout is not a TTY).",
      allowNo: true,
      helpGroup: "GLOBAL",
    }),
    profile: Flags.string({
      description: "Named credentials profile (OBJECTIFIED_PROFILE).",
      helpGroup: "GLOBAL",
    }),
    quiet: Flags.boolean({
      char: "q",
      description: "Suppress non-error stdout (spinners, banners, tips).",
      helpGroup: "GLOBAL",
    }),
    verbose: Flags.boolean({
      description: "Verbose logging on stderr (OBJECTIFIED_VERBOSE=1).",
      helpGroup: "GLOBAL",
    }),
  };

  /** Parsed flags including globals and command-specific options. */
  declare flags: GlobalCliFlags & Record<string, unknown>;

  /** Resolved API/client context (flag > env > config profile > [default] > built-ins). */
  context!: ObjectifiedContext;

  /** True when --verbose or OBJECTIFIED_VERBOSE=1. */
  protected verboseEffective!: boolean;

  /** Config file path after flag/env/default resolution. */
  protected resolvedConfigPath!: string;

  /** Command arguments after parse (subcommands read typed fields from here). */
  protected commandArgs!: Record<string, unknown>;

  protected api!: ReturnType<typeof createApiClient>;

  async init(): Promise<void> {
    await super.init();
    const Cmd = this.constructor as typeof Command;
    const parsed = await this.parse(Cmd);
    const globalPart = parsed.flags as GlobalCliFlags;
    this.commandArgs = parsed.args as Record<string, unknown>;

    this.resolvedConfigPath = resolveConfigPath(globalPart.config, process.env, os.homedir);
    const configDoc = loadTomlConfigFile(this.resolvedConfigPath);

    const built = buildObjectifiedContext({
      flags: globalPart,
      env: process.env,
      stdoutIsTTY: process.stdout.isTTY,
      supportsColorStdout: typeof supportsColor.stdout === "object",
      configDoc,
      homedir: os.homedir,
    });

    this.context = built.context;
    this.verboseEffective = built.verboseEffective;
    this.flags = {
      ...parsed.flags,
      verboseEffective: built.verboseEffective,
    } as BaseCommand["flags"];
    this.api = createApiClient(this.context.baseUrl);
  }
}
