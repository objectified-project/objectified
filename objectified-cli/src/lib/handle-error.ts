import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CLIError, ExitError } from "@oclif/core/errors";
import { Chalk } from "chalk";
import leven from "leven";

import { EXIT_CODES } from "./exit-codes.js";
import { ObjectifiedCliError } from "./errors.js";

const MANIFEST_REL = "../../oclif.manifest.json";

export type HandleCliErrorOptions = {
  /** When true, include JS stack traces after the formatted message. */
  debugStacks: boolean;
  /** When false, disable ANSI emphasis. */
  color: boolean;
};

let cachedCommandIds: string[] | undefined;

function loadRegisteredCommandIds(): string[] {
  if (cachedCommandIds !== undefined) return cachedCommandIds;
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(join(here, MANIFEST_REL), "utf8");
    const manifest = JSON.parse(raw) as { commands?: Record<string, unknown> };
    cachedCommandIds = Object.keys(manifest.commands ?? {}).sort();
    return cachedCommandIds;
  } catch {
    cachedCommandIds = [];
    return cachedCommandIds;
  }
}

export function resolveDebugStacks(argv: string[], env: NodeJS.ProcessEnv): boolean {
  if (env.OBJECTIFIED_DEBUG === "1" || env.OBJECTIFIED_DEBUG === "true") return true;
  return argv.some((a) => a === "--verbose" || a.startsWith("--verbose="));
}

export function truncateRequestId(id: string): string {
  const t = id.trim();
  if (t.length <= 12) return t;
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

function suggestDidYouMean(rawId: string): string | undefined {
  const q = rawId.trim();
  if (q === "") return undefined;
  const ids = loadRegisteredCommandIds();
  const scored = ids
    .map((id) => ({ id, d: leven(q, id) }))
    .filter((x) => x.d > 0 && x.d < 3)
    .sort((a, b) => a.d - b.d || a.id.localeCompare(b.id));
  if (scored.length === 0) return undefined;
  const best = scored[0];
  if (best === undefined) return undefined;
  const bin = "objectified";
  const pretty = best.id.replace(/:/g, " ");
  return `Did you mean \`${bin} ${pretty}\`?`;
}

function formatCommandNotFoundMessage(message: string): { headline: string; hint?: string } {
  const m = /^command (.+) not found$/i.exec(message.trim());
  if (!m || m[1] === undefined) return { headline: message };
  const typed = m[1];
  const hint = suggestDidYouMean(typed);
  return {
    headline: `Unknown command "${typed}".`,
    hint,
  };
}

function defaultHeadlineForExit(code: number): string {
  switch (code) {
    case EXIT_CODES.MISUSE:
      return "Invalid usage";
    case EXIT_CODES.NOT_AUTHENTICATED:
      return "Not authenticated";
    case EXIT_CODES.FORBIDDEN:
      return "Forbidden";
    case EXIT_CODES.NOT_FOUND:
      return "Not found";
    case EXIT_CODES.CONFLICT:
      return "Conflict";
    case EXIT_CODES.VALIDATION:
      return "Validation failed";
    case EXIT_CODES.SERVER_ERROR:
      return "Server error";
    case EXIT_CODES.NETWORK:
      return "Network error";
    case EXIT_CODES.RATE_LIMITED:
      return "Rate limited";
    case EXIT_CODES.CONFIG:
      return "Configuration error";
    default:
      return "Command failed";
  }
}

/** Canonical string formatter for CLI failures (#3191). */
export function handleError(err: unknown, opts: HandleCliErrorOptions): string {
  return formatHandleableError(err, opts);
}

/** Shared formatter for stderr (also used from snapshot tests). */
export function formatHandleableError(err: unknown, opts: HandleCliErrorOptions): string {
  const c = new Chalk({ level: opts.color && process.stderr.isTTY ? 3 : 0 });

  const lines: string[] = [];

  const pushHint = (h?: string) => {
    if (h !== undefined && h !== "") lines.push(`${c.dim("Hint:")}   ${h}`);
  };

  if (err instanceof ExitError) {
    return "";
  }

  if (err instanceof ObjectifiedCliError) {
    const headline = err.title ?? defaultHeadlineForExit(err.exitCode);
    lines.push(`${c.red("✖")} ${c.bold(headline)}`);
    lines.push(`${c.dim("Reason:")} ${err.message}`);
    pushHint(err.hint);
    if (err.requestId !== undefined && err.requestId !== "") {
      lines.push(`${c.dim("Request-Id:")} ${truncateRequestId(err.requestId)}`);
    }
    lines.push(`${c.dim("Exit code:")}  ${String(err.exitCode)}`);
    return lines.join("\n");
  }

  if (err instanceof CLIError) {
    const exit =
      typeof err.oclif.exit === "number" && Number.isFinite(err.oclif.exit)
        ? err.oclif.exit
        : EXIT_CODES.GENERIC;
    const raw = err.message;
    const isCmdMissing = /^command .+ not found$/i.test(raw.trim());
    const misuse =
      exit === EXIT_CODES.MISUSE ||
      err.constructor.name === "CLIParseError" ||
      raw.includes("See more help with --help") ||
      raw.includes("Unexpected flag") ||
      raw.includes("Nonexistent flag") ||
      raw.includes("Unexpected argument");

    if (isCmdMissing) {
      const { headline, hint } = formatCommandNotFoundMessage(raw);
      lines.push(`${c.red("✖")} ${c.bold(headline)}`);
      lines.push(`${c.dim("Reason:")} ${raw}`);
      pushHint(hint);
      lines.push(`${c.dim("Exit code:")}  ${String(EXIT_CODES.MISUSE)}`);
      return lines.join("\n");
    }

    if (misuse) {
      lines.push(`${c.red("✖")} ${c.bold("Invalid usage")}`);
      lines.push(`${c.dim("Reason:")} ${raw}`);
      pushHint("Run the command with `--help`, or fix flags and arguments.");
      lines.push(`${c.dim("Exit code:")}  ${String(EXIT_CODES.MISUSE)}`);
      return lines.join("\n");
    }

    lines.push(`${c.red("✖")} ${c.bold(defaultHeadlineForExit(exit))}`);
    lines.push(`${c.dim("Reason:")} ${raw}`);
    lines.push(`${c.dim("Exit code:")}  ${String(exit)}`);
    return lines.join("\n");
  }

  if (err instanceof Error) {
    lines.push(`${c.red("✖")} ${c.bold("Command failed")}`);
    lines.push(`${c.dim("Reason:")} ${err.message || err.name}`);
    lines.push(`${c.dim("Exit code:")}  ${String(EXIT_CODES.GENERIC)}`);
    const body = lines.join("\n");
    if (!opts.debugStacks) return body;
    if (err.stack !== undefined && err.stack.trim() !== "") {
      return `${body}\n\n${err.stack}`;
    }
    return body;
  }

  lines.push(`${c.red("✖")} ${c.bold("Command failed")}`);
  lines.push(`${c.dim("Reason:")} ${String(err)}`);
  lines.push(`${c.dim("Exit code:")}  ${String(EXIT_CODES.GENERIC)}`);
  return lines.join("\n");
}

export function resolveEffectiveExitCode(err: unknown): number {
  if (err instanceof ExitError) {
    const code = Number.parseInt(String(err.oclif.exit ?? 1), 10);
    return Number.isFinite(code) ? code : 1;
  }

  let exitCode: number = EXIT_CODES.GENERIC;
  if (err instanceof ObjectifiedCliError) exitCode = err.exitCode;
  else if (err instanceof CLIError) {
    const code = err.oclif.exit;
    exitCode = typeof code === "number" && Number.isFinite(code) ? code : EXIT_CODES.GENERIC;
  }

  const misuseFromUnknownCommand =
    err instanceof CLIError && /^command .+ not found$/i.test(err.message.trim());
  return misuseFromUnknownCommand && exitCode !== EXIT_CODES.MISUSE ? EXIT_CODES.MISUSE : exitCode;
}

export function cliFailureJsonEnvelope(
  err: unknown,
  requestIdFallback?: string,
): {
  error: {
    title?: string;
    message: string;
    exitCode: number;
    hint?: string;
    requestId?: string;
    retriesAttempted?: number;
  };
} {
  if (err instanceof ObjectifiedCliError) {
    return {
      error: {
        title: err.title,
        message: err.message,
        exitCode: err.exitCode,
        hint: err.hint,
        requestId: err.requestId ?? requestIdFallback,
        retriesAttempted: err.retriesAttempted,
      },
    };
  }

  if (err instanceof CLIError) {
    const raw = err.message;
    const hint = /^command .+ not found$/i.test(raw.trim())
      ? formatCommandNotFoundMessage(raw).hint
      : undefined;
    return {
      error: {
        message: raw,
        exitCode: resolveEffectiveExitCode(err),
        hint,
        requestId: requestIdFallback,
      },
    };
  }

  if (err instanceof Error) {
    return {
      error: {
        message: err.message || err.name,
        exitCode: EXIT_CODES.GENERIC,
        requestId: requestIdFallback,
      },
    };
  }

  return {
    error: {
      message: String(err),
      exitCode: EXIT_CODES.GENERIC,
      requestId: requestIdFallback,
    },
  };
}

/**
 * Prints the canonical multi-line error template and returns a process exit code.
 * ExitError is passed through without printing.
 */
export function formatAndReportCliFailure(err: unknown, opts: HandleCliErrorOptions): number {
  if (err instanceof ExitError) {
    return resolveEffectiveExitCode(err);
  }

  const effectiveExit = resolveEffectiveExitCode(err);

  const text = formatHandleableError(err, opts);
  if (text !== "") {
    console.error(text);
  }

  return effectiveExit;
}
