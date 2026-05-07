import { EXIT_CODES } from "./exit-codes.js";

export type ObjectifiedCliErrorOptions = {
  message: string;
  exitCode: number;
  hint?: string;
  requestId?: string;
  title?: string;
  retriesAttempted?: number;
};

/** Root CLI failure type; richer subclasses align with documented exit codes (#3191). */
export class ObjectifiedCliError extends Error {
  readonly exitCode: number;
  readonly hint?: string;
  readonly requestId?: string;
  readonly title?: string;
  readonly retriesAttempted?: number;

  constructor(opts: ObjectifiedCliErrorOptions) {
    super(opts.message);
    this.name = "ObjectifiedCliError";
    this.exitCode = opts.exitCode;
    this.hint = opts.hint;
    this.requestId = opts.requestId;
    this.title = opts.title;
    this.retriesAttempted = opts.retriesAttempted;
  }
}

/** Prefer {@link ObjectifiedCliError} for new code; kept for existing call sites/tests. */
export class CliError extends ObjectifiedCliError {
  constructor(message: string, exitCode?: number) {
    super({ message, exitCode: exitCode ?? EXIT_CODES.GENERIC });
    this.name = "CliError";
  }
}

export type HttpErrorContext = {
  requestId?: string;
  retriesAttempted?: number;
};

function retryHint(ctx: HttpErrorContext): string | undefined {
  if (ctx.retriesAttempted === undefined || ctx.retriesAttempted <= 0) return undefined;
  return `Retried ${String(ctx.retriesAttempted)} time(s); include request-id in support tickets when available.`;
}

function mergeHints(...parts: Array<string | undefined>): string | undefined {
  const xs = parts.filter((p): p is string => p !== undefined && p !== "");
  if (xs.length === 0) return undefined;
  return xs.join(" ");
}

/** Maps HTTP status to a CLI error with hints; covers all 4xx/5xx (#3191). */
export function httpStatusToCliError(
  status: number,
  apiMessage: string,
  ctx: HttpErrorContext = {},
): ObjectifiedCliError {
  const base = apiMessage.trim() || `HTTP ${String(status)}`;
  const rHint = retryHint(ctx);

  if (status === 401) {
    return new ObjectifiedCliError({
      message: base,
      exitCode: EXIT_CODES.NOT_AUTHENTICATED,
      title: "Not authenticated",
      hint: mergeHints("Run `objectified auth login` or set OBJECTIFIED_API_KEY.", rHint),
      requestId: ctx.requestId,
      retriesAttempted: ctx.retriesAttempted,
    });
  }
  if (status === 403 || status === 402 || status === 451) {
    return new ObjectifiedCliError({
      message: base,
      exitCode: EXIT_CODES.FORBIDDEN,
      title: "Forbidden",
      hint: mergeHints("Switch tenant or API key; verify you have access to this resource.", rHint),
      requestId: ctx.requestId,
      retriesAttempted: ctx.retriesAttempted,
    });
  }
  if (status === 404 || status === 410) {
    return new ObjectifiedCliError({
      message: base,
      exitCode: EXIT_CODES.NOT_FOUND,
      title: "Not found",
      hint: mergeHints("Check slugs, IDs, and tenant scope.", rHint),
      requestId: ctx.requestId,
      retriesAttempted: ctx.retriesAttempted,
    });
  }
  if (status === 409 || status === 423) {
    return new ObjectifiedCliError({
      message: base,
      exitCode: EXIT_CODES.CONFLICT,
      title: "Conflict",
      hint: mergeHints("Pull remote changes or fork before retrying.", rHint),
      requestId: ctx.requestId,
      retriesAttempted: ctx.retriesAttempted,
    });
  }
  if (status === 408) {
    return new ObjectifiedCliError({
      message: base,
      exitCode: EXIT_CODES.NETWORK,
      title: "Request timeout",
      hint: mergeHints(
        "The server closed an idle request; check `--base-url` or OBJECTIFIED_BASE_URL.",
        rHint,
      ),
      requestId: ctx.requestId,
      retriesAttempted: ctx.retriesAttempted,
    });
  }
  if (status === 429) {
    return new ObjectifiedCliError({
      message: base,
      exitCode: EXIT_CODES.RATE_LIMITED,
      title: "Rate limited",
      hint: mergeHints("Wait for Retry-After (shown in verbose logs), then retry.", rHint),
      requestId: ctx.requestId,
      retriesAttempted: ctx.retriesAttempted,
    });
  }
  if (status === 405 || status === 431) {
    return new ObjectifiedCliError({
      message: base,
      exitCode: EXIT_CODES.MISUSE,
      title: "Misuse",
      hint: mergeHints("Wrong HTTP method or oversized headers for this client build."),
      requestId: ctx.requestId,
      retriesAttempted: ctx.retriesAttempted,
    });
  }
  if (status === 426) {
    return new ObjectifiedCliError({
      message: base,
      exitCode: EXIT_CODES.NETWORK,
      title: "Upgrade required",
      hint: mergeHints("TLS / protocol upgrade required; check `--base-url`."),
      requestId: ctx.requestId,
      retriesAttempted: ctx.retriesAttempted,
    });
  }
  if (status === 407) {
    return new ObjectifiedCliError({
      message: base,
      exitCode: EXIT_CODES.NOT_AUTHENTICATED,
      title: "Proxy authentication required",
      hint: mergeHints("Configure proxy credentials for your environment."),
      requestId: ctx.requestId,
      retriesAttempted: ctx.retriesAttempted,
    });
  }

  if (status >= 500 && status <= 599) {
    const exit =
      status === 504 ? EXIT_CODES.NETWORK : EXIT_CODES.SERVER_ERROR;
    const title = status === 504 ? "Gateway timeout" : "Server error";
    return new ObjectifiedCliError({
      message: base,
      exitCode: exit,
      title,
      hint: mergeHints(
        exit === EXIT_CODES.NETWORK
          ? "Upstream timed out; check network path and `--base-url`."
          : "API returned an error; retry later.",
        rHint,
      ),
      requestId: ctx.requestId,
      retriesAttempted: ctx.retriesAttempted,
    });
  }

  if (status === 418) {
    return new ObjectifiedCliError({
      message: base,
      exitCode: EXIT_CODES.GENERIC,
      title: "Unsupported response",
      hint: mergeHints("This HTTP status is unexpected from the Objectified API."),
      requestId: ctx.requestId,
      retriesAttempted: ctx.retriesAttempted,
    });
  }

  if (status >= 400 && status <= 499) {
    return new ObjectifiedCliError({
      message: base,
      exitCode: EXIT_CODES.VALIDATION,
      title: "Validation error",
      hint: mergeHints("Fix the request; use --dry-run where supported."),
      requestId: ctx.requestId,
      retriesAttempted: ctx.retriesAttempted,
    });
  }

  return new ObjectifiedCliError({
    message: base,
    exitCode: EXIT_CODES.GENERIC,
    title: "API error",
    hint: undefined,
    requestId: ctx.requestId,
    retriesAttempted: ctx.retriesAttempted,
  });
}

export function networkErrnoToCliError(err: NodeJS.ErrnoException): ObjectifiedCliError {
  const code = err.code ?? "";
  const msg = err.message || code || "Network error";
  const baseHint =
    "Check VPN / firewall / DNS; verify `--base-url` or OBJECTIFIED_BASE_URL reaches the API.";
  const specifics: Record<string, string> = {
    ECONNREFUSED: "Connection refused — nothing is listening at this host/port or a firewall blocked it.",
    ENOTFOUND: "DNS lookup failed — check the hostname in `--base-url`.",
    EAI_AGAIN: "Temporary DNS failure — retry or check resolver / VPN.",
    ETIMEDOUT: "Connection timed out — host may be down or blocked.",
    EPIPE: "Connection closed unexpectedly — retry or verify `--base-url`.",
    CERT_HAS_EXPIRED: "TLS certificate expired — update server or trust store.",
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: "TLS verification failed — check corporate proxy or `--base-url`.",
  };
  const detail = specifics[code];
  return new ObjectifiedCliError({
    message: detail ?? msg,
    exitCode: EXIT_CODES.NETWORK,
    title: "Network error",
    hint: mergeHints(baseHint, code ? `(errno ${code})` : undefined),
  });
}
