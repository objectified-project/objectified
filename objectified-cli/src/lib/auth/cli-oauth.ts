import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import readline from "node:readline";
import type { Readable, Writable } from "node:stream";
import { URL } from "node:url";

import { CliError, ObjectifiedCliError } from "../errors.js";
import { EXIT_CODES } from "../exit-codes.js";

export const CLI_TOKEN_PATH = "/v1/auth/cli/token";
export const CLI_REVOKE_PATH = "/v1/auth/cli/revoke";
/** `GET` — returns tenant, user, plan, and token metadata for the active session (#3196). */
export const CLI_WHOAMI_PATH = "/v1/auth/cli/whoami";

/** Default wait for user to complete browser login (ms). */
export const CLI_LOGIN_BROWSER_TIMEOUT_MS = 120_000;

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** RFC 7636 code verifier (≥ 43 chars); uses 64 random octets → ~86 URL-safe chars. */
export function generateCodeVerifier(): string {
  return base64UrlEncode(randomBytes(64));
}

export function codeChallengeS256(verifier: string): string {
  const hash = createHash("sha256").update(verifier, "utf8").digest();
  return base64UrlEncode(hash);
}

export function buildWebLoginUrl(opts: {
  webLoginUrl: string;
  codeChallenge: string;
  redirectUri: string;
}): string {
  const u = new URL(opts.webLoginUrl);
  u.searchParams.set("code_challenge", opts.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("redirect_uri", opts.redirectUri);
  return u.toString();
}

export function shouldOpenBrowser(noBrowserFlag: boolean): boolean {
  if (noBrowserFlag) return false;
  if (process.platform === "linux" || process.platform === "freebsd") {
    return Boolean(process.env.DISPLAY?.trim());
  }
  return true;
}

export async function readAuthorizationCodeFromStdin(
  opts: {
    input?: Readable;
    output?: Writable;
    prompt?: string;
  } = {},
): Promise<string> {
  const rl = readline.createInterface({
    input: opts.input ?? process.stdin,
    output: opts.output ?? process.stderr,
  });
  try {
    const line: string = await new Promise((resolve, reject) => {
      rl.question(opts.prompt ?? "Paste authorization code: ", (answer) => {
        resolve(answer);
      });
      rl.on("SIGINT", () => {
        reject(new CliError("Cancelled."));
      });
    });
    const code = line.trim();
    if (!code) throw new CliError("Authorization code is empty.");
    return code;
  } finally {
    rl.close();
  }
}

function bodyHtml(message: string): string {
  const esc = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><meta charset="utf-8"><title>Objectified CLI</title><p>${esc}</p>`;
}

export type LoopbackServer = {
  redirectUri: string;
  waitForCode: Promise<string>;
  close: () => Promise<void>;
};

/** Reserves an ephemeral loopback redirect URI without keeping a listener open. */
export async function reserveLoopbackRedirectUri(): Promise<string> {
  const server = createServer();
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });

  try {
    const addr = server.address() as AddressInfo;
    return `http://127.0.0.1:${String(addr.port)}/`;
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((e) => {
        if (e) reject(e);
        else resolve();
      });
    });
  }
}

/** Loopback listener on 127.0.0.1 only; OS-assigned port. */
export async function startLoopbackOAuthServer(): Promise<LoopbackServer> {
  let settled = false;
  let resolveCode!: (code: string) => void;
  let rejectWait!: (err: Error) => void;
  const waitForCode = new Promise<string>((res, rej) => {
    resolveCode = res;
    rejectWait = rej;
  });

  const server = createServer((req, res) => {
    try {
      const remote = req.socket.remoteAddress ?? "";
      const loopback = remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1";
      if (!loopback) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Forbidden");
        return;
      }

      const url = new URL(req.url ?? "/", "http://127.0.0.1");

      if (url.pathname !== "/" && url.pathname !== "") {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }

      const oauthErr = url.searchParams.get("error");
      const oauthDesc = url.searchParams.get("error_description");
      const code = url.searchParams.get("code");

      if (oauthErr) {
        const msg = oauthDesc ?? oauthErr;
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(bodyHtml(`Login failed: ${msg}`));
        if (!settled) {
          settled = true;
          rejectWait(
            new ObjectifiedCliError({
              message: `OAuth error: ${msg}`,
              exitCode: EXIT_CODES.NOT_AUTHENTICATED,
              hint: "Try `objectified auth login` again.",
            }),
          );
        }
        return;
      }

      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(bodyHtml("Missing authorization code."));
        if (!settled) {
          settled = true;
          rejectWait(new CliError("Authorization callback missing code parameter."));
        }
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(bodyHtml("You may close this window and return to the CLI."));
      if (!settled) {
        settled = true;
        resolveCode(code);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Internal error");
      if (!settled) {
        settled = true;
        rejectWait(new CliError(msg));
      }
    }
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });

  const addr = server.address() as AddressInfo;
  const port = addr.port;
  const redirectUri = `http://127.0.0.1:${String(port)}/`;

  const close = (): Promise<void> =>
    new Promise((resolve, reject) => {
      server.close((e) => {
        if (e) reject(e);
        else resolve();
      });
    });

  return { redirectUri, waitForCode, close };
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const to = setTimeout(() => {
      reject(new CliError(`${label} (timed out after ${String(ms)} ms).`));
    }, ms);

    const onAbort = (): void => {
      clearTimeout(to);
      reject(new CliError("Cancelled."));
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    promise.then(
      (v) => {
        clearTimeout(to);
        signal?.removeEventListener("abort", onAbort);
        resolve(v);
      },
      (err: unknown) => {
        clearTimeout(to);
        signal?.removeEventListener("abort", onAbort);
        reject(err instanceof Error ? err : new CliError(String(err)));
      },
    );
  });
}

export type TokenExchangeResponse = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
};

export async function exchangeCliAuthorizationCode(opts: {
  apiBaseUrl: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
  fetchImpl?: typeof fetch;
}): Promise<TokenExchangeResponse> {
  const tokenUrl = new URL(CLI_TOKEN_PATH, opts.apiBaseUrl).toString();
  const fetchFn = opts.fetchImpl ?? globalThis.fetch;
  const res = await fetchFn(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code: opts.code,
      redirect_uri: opts.redirectUri,
      code_verifier: opts.codeVerifier,
    }),
  });

  const rawText = await res.text();
  if (!res.ok) {
    throw new ObjectifiedCliError({
      message: `Token exchange failed (${String(res.status)}): ${rawText.slice(0, 800)}`,
      exitCode: EXIT_CODES.NOT_AUTHENTICATED,
      hint: "Verify base URL and try `objectified auth login` again.",
    });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawText) as unknown;
  } catch {
    throw new CliError("Token exchange returned invalid JSON.");
  }

  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as TokenExchangeResponse).access_token !== "string" ||
    typeof (body as TokenExchangeResponse).refresh_token !== "string"
  ) {
    throw new CliError("Token exchange response missing access_token or refresh_token.");
  }

  return body as TokenExchangeResponse;
}

/** Rotate access token using a stored refresh token (`grant_type: refresh_token`). */
export async function exchangeCliRefreshToken(opts: {
  apiBaseUrl: string;
  refreshToken: string;
  fetchImpl?: typeof fetch;
}): Promise<TokenExchangeResponse> {
  const tokenUrl = new URL(CLI_TOKEN_PATH, opts.apiBaseUrl).toString();
  const fetchFn = opts.fetchImpl ?? globalThis.fetch;
  const res = await fetchFn(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: opts.refreshToken,
    }),
  });

  const rawText = await res.text();
  if (!res.ok) {
    throw new ObjectifiedCliError({
      message: `Token refresh failed (${String(res.status)}): ${rawText.slice(0, 800)}`,
      exitCode: EXIT_CODES.NOT_AUTHENTICATED,
      hint: "Run `objectified auth login` again.",
    });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawText) as unknown;
  } catch {
    throw new CliError("Token refresh returned invalid JSON.");
  }

  if (!body || typeof body !== "object") {
    throw new CliError("Token refresh response was empty.");
  }
  const rec = body as Record<string, unknown>;
  if (typeof rec.access_token !== "string") {
    throw new CliError("Token refresh response missing access_token.");
  }
  const refresh_token =
    typeof rec.refresh_token === "string" ? rec.refresh_token : opts.refreshToken;
  const expires_in =
    typeof rec.expires_in === "number" && Number.isFinite(rec.expires_in)
      ? rec.expires_in
      : undefined;
  return {
    access_token: rec.access_token,
    refresh_token,
    expires_in,
  };
}

export async function revokeCliRefreshToken(opts: {
  apiBaseUrl: string;
  refreshToken: string;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const revokeUrl = new URL(CLI_REVOKE_PATH, opts.apiBaseUrl).toString();
  const fetchFn = opts.fetchImpl ?? globalThis.fetch;
  const res = await fetchFn(revokeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ refresh_token: opts.refreshToken }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new ObjectifiedCliError({
      message: `Token revoke failed (${String(res.status)}): ${t.slice(0, 500)}`,
      exitCode: EXIT_CODES.NOT_AUTHENTICATED,
    });
  }
}

/** Best-effort JWT payload decode for display (no signature verification). */
export function displayIdentityFromAccessToken(accessToken: string): string | undefined {
  const parts = accessToken.split(".");
  if (parts.length !== 3) return undefined;
  try {
    const payload = parts[1];
    if (payload === undefined) return undefined;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    const json = Buffer.from(normalized + pad, "base64").toString("utf8");
    const o = JSON.parse(json) as Record<string, unknown>;
    const email = o.email;
    const preferred = o.preferred_username;
    const sub = o.sub;
    if (typeof email === "string" && email.includes("@")) return email;
    if (typeof preferred === "string") return preferred;
    if (typeof sub === "string") return sub;
  } catch {
    /* ignore */
  }
  return undefined;
}
