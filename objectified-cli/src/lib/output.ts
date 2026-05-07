import chalk, { Chalk, type ChalkInstance } from "chalk";
import Table from "cli-table3";
import ora, { type Ora } from "ora";
import { stringify as stringifyYaml } from "yaml";

/** True when LC_ALL/LANG indicate C/POSIX-style locale (ASCII table borders). */
export function localePrefersAsciiTable(env: NodeJS.ProcessEnv): boolean {
  const loc = (env.LC_ALL ?? env.LANG ?? "").trim();
  if (!loc) return false;
  return loc === "C" || loc === "POSIX" || loc.startsWith("C.");
}

/** Recursively sort object keys for stable JSON/YAML output. */
export function stableDeepSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableDeepSort);
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const sortedKeys = Object.keys(o).sort((a, b) => a.localeCompare(b));
    const out: Record<string, unknown> = {};
    for (const k of sortedKeys) out[k] = stableDeepSort(o[k]);
    return out;
  }
  return value;
}

export type OutputColumn = { key: string; label?: string };

export type CliOutputOptions = {
  json: boolean;
  color: boolean;
  quiet: boolean;
  stdoutIsTTY: boolean;
  stderrIsTTY: boolean;
  langAscii: boolean;
  stdoutWrite: (chunk: string) => void;
  stderrWrite: (chunk: string) => void;
};

export type CliOutput = {
  table(rows: Record<string, unknown>[], columns: OutputColumn[]): void;
  json(value: unknown): void;
  yaml(value: unknown): void;
  text(line: string): void;
  kv(entries: Record<string, unknown>): void;
  spinner(text: string): Ora;
  success(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  banner(message: string): void;
  hint(message: string): void;
};

const ASCII_TABLE_CHARS = {
  top: "-",
  "top-mid": "-",
  "top-left": "+",
  "top-right": "+",
  bottom: "-",
  "bottom-mid": "-",
  "bottom-left": "+",
  "bottom-right": "+",
  left: "|",
  "left-mid": "+",
  mid: "-",
  "mid-mid": "+",
  right: "|",
  "right-mid": "+",
  middle: "|",
} as const;

/** Chalk instance that respects resolved CLI color (NO_COLOR / non-TTY → no ANSI). */
export function chalkForContext(color: boolean): ChalkInstance {
  return color ? chalk : new Chalk({ level: 0 });
}

function suppressHumanStdout(opts: CliOutputOptions): boolean {
  return opts.quiet || opts.json;
}

function suppressAuxHumanStdout(opts: CliOutputOptions): boolean {
  return opts.quiet || opts.json || !opts.stdoutIsTTY;
}

function jsonPretty(opts: CliOutputOptions): boolean {
  return opts.stdoutIsTTY && !opts.quiet;
}

function stableJsonString(opts: CliOutputOptions, value: unknown): string {
  const sorted = stableDeepSort(value);
  const body = jsonPretty(opts)
    ? `${JSON.stringify(sorted, null, 2)}\n`
    : `${JSON.stringify(sorted)}\n`;
  return body;
}

function formatUnknownCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  if (
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "boolean" ||
    typeof v === "bigint" ||
    typeof v === "symbol"
  ) {
    return String(v);
  }
  if (typeof v === "function") return `[function ${v.name || "anonymous"}]`;
  return "";
}

function tsvCell(v: unknown): string {
  return formatUnknownCell(v).replace(/\r?\n/g, " ").replace(/\t/g, " ");
}

export function createCliOutput(opts: CliOutputOptions): CliOutput {
  const c = chalkForContext(opts.color);
  const useAsciiBorders = !opts.color || opts.langAscii;

  const writeStdout = (chunk: string): void => {
    opts.stdoutWrite(chunk);
  };

  const writeStderr = (chunk: string): void => {
    opts.stderrWrite(chunk);
  };

  return {
    table(rows: Record<string, unknown>[], columns: OutputColumn[]): void {
      if (suppressHumanStdout(opts)) {
        if (opts.json) writeStdout(stableJsonString(opts, rows));
        return;
      }

      if (opts.stdoutIsTTY) {
        const head = columns.map((col) => col.label ?? col.key);
        const table = new Table({
          head,
          chars: useAsciiBorders ? { ...ASCII_TABLE_CHARS } : undefined,
          style: {
            head: opts.color ? ["cyan"] : [],
            border: opts.color ? ["gray"] : [],
          },
          wordWrap: true,
        });
        for (const row of rows) {
          table.push(columns.map((col) => formatUnknownCell(row[col.key])));
        }
        writeStdout(`${table.toString()}\n`);
        return;
      }

      const header = columns.map((col) => tsvCell(col.label ?? col.key)).join("\t");
      const lines = [header, ...rows.map((row) => columns.map((col) => tsvCell(row[col.key])).join("\t"))];
      writeStdout(`${lines.join("\n")}\n`);
    },

    json(value: unknown): void {
      writeStdout(stableJsonString(opts, value));
    },

    yaml(value: unknown): void {
      if (suppressHumanStdout(opts)) return;
      const sorted = stableDeepSort(value);
      const doc = stringifyYaml(sorted, {
        sortMapEntries: (a, b) => String(a.key).localeCompare(String(b.key)),
        lineWidth: 0,
      });
      writeStdout(doc.endsWith("\n") ? doc : `${doc}\n`);
    },

    text(line: string): void {
      if (suppressHumanStdout(opts)) return;
      writeStdout(`${line}\n`);
    },

    kv(entries: Record<string, unknown>): void {
      if (suppressHumanStdout(opts)) return;
      const keys = Object.keys(entries).sort((a, b) => a.localeCompare(b));
      const labelWidth = keys.reduce((m, k) => Math.max(m, k.length), 0);
      for (const key of keys) {
        const pad = " ".repeat(Math.max(1, labelWidth - key.length + 1));
        writeStdout(`${c.bold(key)}:${pad}${formatUnknownCell(entries[key])}\n`);
      }
    },

    spinner(text: string): Ora {
      const allow = opts.stdoutIsTTY && !opts.json && !opts.quiet;
      return ora({
        text,
        color: opts.color ? "cyan" : undefined,
        isSilent: !allow,
        stream: process.stderr,
      });
    },

    success(message: string): void {
      if (suppressHumanStdout(opts)) return;
      const mark = opts.color ? c.green("✔") : "OK";
      writeStdout(`${mark} ${message}\n`);
    },

    warn(message: string): void {
      const prefix = opts.color ? c.yellow("Warning:") : "Warning:";
      writeStderr(`${prefix} ${message}\n`);
    },

    error(message: string): void {
      const prefix = opts.color ? c.red("Error:") : "Error:";
      writeStderr(`${prefix} ${message}\n`);
    },

    banner(message: string): void {
      if (suppressAuxHumanStdout(opts)) return;
      writeStdout(`${c.bold(message)}\n`);
    },

    hint(message: string): void {
      if (suppressAuxHumanStdout(opts)) return;
      writeStdout(`${c.dim(message)}\n`);
    },
  };
}

export type OutputCapableCommand = {
  flags: { quiet?: boolean };
  context: { json: boolean; color: boolean };
  log: (msg?: string, ...args: unknown[]) => void;
};

function commandToOpts(cmd: Pick<OutputCapableCommand, "context" | "flags">): CliOutputOptions {
  return {
    json: cmd.context.json,
    color: cmd.context.color,
    quiet: Boolean(cmd.flags.quiet),
    stdoutIsTTY: process.stdout.isTTY,
    stderrIsTTY: process.stderr.isTTY,
    langAscii: localePrefersAsciiTable(process.env),
    stdoutWrite: (chunk) => process.stdout.write(chunk),
    stderrWrite: (chunk) => process.stderr.write(chunk),
  };
}

/** Normal informational line (respects --quiet and JSON mode). */
export function logInfo(cmd: OutputCapableCommand, message: string): void {
  createCliOutput(commandToOpts(cmd)).text(chalkForContext(cmd.context.color).bold(message));
}

/** Structured stdout for JSON mode (single JSON document per invocation). */
export function writeJsonLine(
  cmd: Pick<OutputCapableCommand, "context"> & { flags?: { quiet?: boolean } },
  payload: unknown,
): void {
  if (!cmd.context.json) return;
  createCliOutput(
    commandToOpts({ context: cmd.context, flags: cmd.flags ?? {} } as OutputCapableCommand),
  ).json(payload);
}
