import { createClient, type Client } from "../generated/client.js";
import type { ProjectSchema } from "../generated/models.js";
import { listProjectsV1ProjectsTenantSlugGet } from "../generated/operations.js";

import { CliError } from "./errors.js";

/** Mutable auth fields read on every request (supports 401 refresh hook). */
export type ApiAuthSnapshot = {
  apiKey?: string;
  bearer?: string;
};

export type CreateApiClientOptions = {
  baseUrl: string;
  auth: ApiAuthSnapshot;
  /** Log `x-request-id` from responses when true. */
  verbose?: boolean;
  stderrWrite?: (line: string) => void;
  /** Invoked once after a 401 before retrying the same request. */
  onUnauthorized?: () => Promise<void>;
};

export type ObjectifiedApi = {
  readonly lastRequestId: string | undefined;
  listProjects(tenantSlug: string): Promise<ProjectSchema[]>;
};

const MAX_RETRY_AFTER_MS = 120_000;
const MAX_TRANSIENT_ATTEMPTS = 4;

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function mergeAuthHeaders(request: Request, auth: ApiAuthSnapshot): Request {
  const headers = new Headers(request.headers);
  if (auth.apiKey) headers.set("X-API-Key", auth.apiKey);
  else headers.delete("X-API-Key");
  if (auth.bearer) headers.set("Authorization", `Bearer ${auth.bearer}`);
  else headers.delete("Authorization");
  return new Request(request, { headers });
}

/** Parse `Retry-After` as delta-seconds or HTTP-date. */
export function parseRetryAfterMs(headerValue: string | null): number | undefined {
  if (headerValue === null || headerValue === "") return undefined;
  const trimmed = headerValue.trim();
  const asSeconds = Number(trimmed);
  if (!Number.isNaN(asSeconds) && asSeconds >= 0) {
    return Math.min(asSeconds * 1000, MAX_RETRY_AFTER_MS);
  }
  const when = Date.parse(trimmed);
  if (!Number.isNaN(when)) {
    const delta = when - Date.now();
    if (delta <= 0) return 0;
    return Math.min(delta, MAX_RETRY_AFTER_MS);
  }
  return undefined;
}

export function exponentialBackoffMs(attemptIndex: number): number {
  const base = 250;
  const cap = 8000;
  const raw = Math.min(base * 2 ** attemptIndex, cap);
  const jitter = Math.floor(Math.random() * 120);
  return raw + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatApiError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const o = error as Record<string, unknown>;
    if (typeof o.message === "string") return o.message;
    if (Array.isArray(o.detail)) {
      const parts = o.detail.map((d) =>
        typeof d === "object" && d && "msg" in d
          ? String((d as { msg: unknown }).msg)
          : JSON.stringify(d),
      );
      return parts.join("; ");
    }
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isTransientHttpStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

/** Validates the list endpoint payload enough for CLI rendering (required OpenAPI fields). */
function parseProjectsPayload(data: unknown): ProjectSchema[] {
  if (!Array.isArray(data)) {
    throw new CliError("API error: unexpected response shape for projects list.", 1);
  }
  const projects: ProjectSchema[] = [];
  for (const raw of data) {
    if (!raw || typeof raw !== "object") {
      throw new CliError("API error: invalid project entry in response.", 1);
    }
    const p = raw as Record<string, unknown>;
    if (
      typeof p.id !== "string" ||
      typeof p.tenant_id !== "string" ||
      typeof p.name !== "string" ||
      typeof p.slug !== "string"
    ) {
      throw new CliError("API error: invalid project fields in response.", 1);
    }
    if (
      p.enabled !== undefined &&
      p.enabled !== null &&
      typeof p.enabled !== "boolean"
    ) {
      throw new CliError("API error: invalid project fields in response.", 1);
    }
    projects.push({
      ...(raw as ProjectSchema),
      enabled: typeof p.enabled === "boolean" ? p.enabled : true,
    });
  }
  return projects;
}

function createInstrumentedFetch(opts: {
  inner: typeof fetch;
  auth: ApiAuthSnapshot;
  verbose?: boolean;
  stderrWrite?: (line: string) => void;
  onUnauthorized?: () => Promise<void>;
}): typeof fetch {
  const log = opts.stderrWrite ?? ((line: string) => process.stderr.write(`${line}\n`));

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const baseReq = input instanceof Request ? input : new Request(input, init);
    let req = mergeAuthHeaders(baseReq, opts.auth);
    let transientAttempt = 0;
    let didReauth = false;

    for (;;) {
      const response = await opts.inner(req);
      const rid = response.headers.get("x-request-id") ?? response.headers.get("X-Request-Id");
      if (opts.verbose && rid !== null && rid !== "") log(`objectified: request-id=${rid}`);

      if (response.status === 401 && opts.onUnauthorized !== undefined && !didReauth) {
        didReauth = true;
        await opts.onUnauthorized();
        req = mergeAuthHeaders(baseReq, opts.auth);
        continue;
      }

      if (response.status === 429 && transientAttempt < MAX_TRANSIENT_ATTEMPTS - 1) {
        const wait = parseRetryAfterMs(response.headers.get("retry-after"));
        if (wait !== undefined) {
          transientAttempt++;
          await sleep(wait);
          req = mergeAuthHeaders(baseReq, opts.auth);
          continue;
        }
      }

      if (isTransientHttpStatus(response.status) && transientAttempt < MAX_TRANSIENT_ATTEMPTS - 1) {
        transientAttempt++;
        await sleep(exponentialBackoffMs(transientAttempt - 1));
        req = mergeAuthHeaders(baseReq, opts.auth);
        continue;
      }

      return response;
    }
  };
}

export function createApiClient(options: CreateApiClientOptions): ObjectifiedApi {
  const innerFetch = globalThis.fetch.bind(globalThis);
  let lastRequestId: string | undefined;

  const instrumented = createInstrumentedFetch({
    inner: async (input, init) => {
      const res = await innerFetch(input, init);
      const rid = res.headers.get("x-request-id") ?? res.headers.get("X-Request-Id") ?? undefined;
      if (rid !== undefined) lastRequestId = rid;
      return res;
    },
    auth: options.auth,
    verbose: options.verbose,
    stderrWrite: options.stderrWrite,
    onUnauthorized: options.onUnauthorized,
  });

  const hey: Client = createClient({
    baseUrl: trimTrailingSlash(options.baseUrl),
    fetch: instrumented,
  });

  return {
    get lastRequestId() {
      return lastRequestId;
    },

    async listProjects(tenantSlug: string): Promise<ProjectSchema[]> {
      const rawUnknown: unknown = await listProjectsV1ProjectsTenantSlugGet({
        client: hey,
        path: { tenant_slug: tenantSlug },
        throwOnError: false,
      });

      const rawBundle =
        rawUnknown && typeof rawUnknown === "object"
          ? (rawUnknown as {
              data?: unknown;
              error?: unknown;
              response?: Response;
            })
          : undefined;

      if (rawBundle === undefined) {
        throw new CliError("API error: empty SDK response.", 1);
      }

      if (rawBundle.error !== undefined && rawBundle.error !== null && rawBundle.error !== "") {
        const status = rawBundle.response?.status ?? "?";
        throw new CliError(`API error (${String(status)}): ${formatApiError(rawBundle.error)}`, 1);
      }

      return parseProjectsPayload(rawBundle.data);
    },
  };
}
