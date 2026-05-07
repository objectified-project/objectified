import os from "node:os";

import { Command, Flags } from "@oclif/core";
import type { CommandError } from "@oclif/core/interfaces";
import supportsColor from "supports-color";

import { createApiClient, type ApiAuthSnapshot, type ObjectifiedApi } from "./lib/client.js";
import {
  buildObjectifiedContext,
  type GlobalCliFlags,
  type ObjectifiedContext,
} from "./lib/cli-context.js";
import {
  ensureDefaultConfigFile,
  loadTomlConfigFile,
  resolveConfigFilePath,
  type ParsedTomlConfig,
} from "./lib/config.js";
import { CliError } from "./lib/errors.js";
import { createCliOutput, localePrefersAsciiTable, type CliOutput } from "./lib/output.js";

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
      description:
        "Path to config file (default: XDG config dir / Objectified AppData on Windows — see `objectified config path`).",
      helpGroup: "GLOBAL",
    }),
    json: Flags.boolean({
      description:
        "Emit machine-readable JSON (OBJECTIFIED_JSON=1; auto-enabled when stdout is not a TTY).",
      allowNo: true,
      helpGroup: "GLOBAL",
    }),
    color: Flags.boolean({
      description:
        "Enable/disable ANSI colors (--no-color sets NO_COLOR; colors are off when stdout is not a TTY).",
      allowNo: true,
      helpGroup: "GLOBAL",
    }),
    profile: Flags.string({
      description:
        "Named credentials profile (OBJECTIFIED_PROFILE); falls back to default_profile in config.",
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

  private cliOutput?: CliOutput;

  /** Shared renderers: tables, JSON/YAML, spinners, stderr warnings (TTY / --json / --quiet aware). */
  protected get output(): CliOutput {
    this.cliOutput ??= createCliOutput({
      json: this.context.json,
      color: this.context.color,
      quiet: Boolean(this.flags.quiet),
      stdoutIsTTY: process.stdout.isTTY,
      stderrIsTTY: process.stderr.isTTY,
      langAscii: localePrefersAsciiTable(process.env),
      stdoutWrite: (chunk) => process.stdout.write(chunk),
      stderrWrite: (chunk) => process.stderr.write(chunk),
    });
    return this.cliOutput;
  }

  /** Resolved API/client context (flag > env > profile config > [default] > built-ins). */
  context!: ObjectifiedContext;

  /** Parsed config document after loading `config.toml`. */
  protected configDoc!: ParsedTomlConfig;

  /** True when --verbose or OBJECTIFIED_VERBOSE=1. */
  protected verboseEffective!: boolean;

  /** Config file path after flag/env/default resolution. */
  protected resolvedConfigPath!: string;

  /** Command arguments after parse (subcommands read typed fields from here). */
  protected commandArgs!: Record<string, unknown>;

  /** Mutable snapshot passed to the REST wrapper (401 hook may refresh credentials). */
  protected readonly apiAuth: ApiAuthSnapshot = {};

  protected api!: ObjectifiedApi;

  async init(): Promise<void> {
    await super.init();
    const Cmd = this.constructor as typeof Command;
    const parsed = await this.parse(Cmd);
    const globalPart = parsed.flags as GlobalCliFlags;
    this.commandArgs = parsed.args as Record<string, unknown>;

    this.resolvedConfigPath = resolveConfigFilePath(globalPart.config, process.env, os.homedir);
    await ensureDefaultConfigFile(this.resolvedConfigPath);
    this.configDoc = loadTomlConfigFile(this.resolvedConfigPath);

    const built = buildObjectifiedContext({
      flags: globalPart,
      env: process.env,
      stdoutIsTTY: process.stdout.isTTY,
      supportsColorStdout: typeof supportsColor.stdout === "object",
      configDoc: this.configDoc,
      configPath: this.resolvedConfigPath,
    });

    this.context = built.context;
    this.verboseEffective = built.verboseEffective;
    this.flags = {
      ...parsed.flags,
      verboseEffective: built.verboseEffective,
    } as BaseCommand["flags"];
    this.apiAuth.apiKey = this.context.apiKey;
    this.apiAuth.bearer = this.context.accessToken;
    this.api = createApiClient({
      baseUrl: this.context.baseUrl,
      auth: this.apiAuth,
      verbose: this.verboseEffective,
      stderrWrite: (line) => process.stderr.write(`${line}\n`),
    });
  }

  protected override async catch(err: CommandError): Promise<void> {
    if (err instanceof CliError) {
      this.error(err.message, { exit: err.exitCode });
      return;
    }
    await super.catch(err);
  }
}
