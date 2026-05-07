import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";

import {
  CLI_REVOKE_PATH,
  CLI_TOKEN_PATH,
  codeChallengeS256,
  exchangeCliAuthorizationCode,
  generateCodeVerifier,
  revokeCliRefreshToken,
} from "../src/lib/auth/cli-oauth.js";
import { runCliPkceLogin } from "../src/lib/auth/cli-login-flow.js";
import { DEFAULT_CLI_WEB_LOGIN_URL } from "../src/lib/constants.js";

async function mockApiServer(handler: (req: import("node:http").IncomingMessage) => Promise<{
  status: number;
  body?: string;
  contentType?: string;
}>): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    void (async () => {
      const out = await handler(req);
      res.writeHead(out.status, {
        "Content-Type": out.contentType ?? "application/json",
      });
      res.end(out.body ?? "");
    })();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${String(port)}`;
  const close = (): Promise<void> =>
    new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  return { baseUrl, close };
}

describe("CLI OAuth / PKCE helpers", () => {
  it("generates verifier ≥ 43 chars and S256 challenge", () => {
    const v = generateCodeVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    const ch = codeChallengeS256(v);
    expect(ch.length).toBeGreaterThan(0);
    expect(ch).not.toContain("+");
    expect(ch).not.toContain("/");
    expect(ch).not.toContain("=");
  });

  it("exchanges authorization code via POST /v1/auth/cli/token (mock server)", async () => {
    const { baseUrl, close } = await mockApiServer(async (req) => {
      if (req.url?.startsWith(CLI_TOKEN_PATH) && req.method === "POST") {
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          req.on("data", (c: Buffer) => chunks.push(c));
          req.on("end", () => resolve());
          req.on("error", reject);
        });
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
        expect(body.grant_type).toBe("authorization_code");
        expect(body.code).toBe("mock-code");
        expect(typeof body.code_verifier).toBe("string");
        expect(String(body.code_verifier).length).toBeGreaterThanOrEqual(43);
        expect(body.redirect_uri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
        return {
          status: 200,
          body: JSON.stringify({
            access_token: "access-mock",
            refresh_token: "refresh-mock",
            expires_in: 3600,
          }),
        };
      }
      return { status: 404, body: "not found", contentType: "text/plain" };
    });

    try {
      const tokens = await exchangeCliAuthorizationCode({
        apiBaseUrl: baseUrl,
        code: "mock-code",
        redirectUri: "http://127.0.0.1:54321/",
        codeVerifier: generateCodeVerifier(),
      });
      expect(tokens.access_token).toBe("access-mock");
      expect(tokens.refresh_token).toBe("refresh-mock");
    } finally {
      await close();
    }
  });

  it("revokes refresh token via POST /v1/auth/cli/revoke (mock server)", async () => {
    const { baseUrl, close } = await mockApiServer(async (req) => {
      if (req.url?.startsWith(CLI_REVOKE_PATH) && req.method === "POST") {
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          req.on("data", (c: Buffer) => chunks.push(c));
          req.on("end", () => resolve());
          req.on("error", reject);
        });
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
        expect(body.refresh_token).toBe("to-revoke");
        return { status: 204, body: "" };
      }
      return { status: 404, body: "not found", contentType: "text/plain" };
    });

    try {
      await revokeCliRefreshToken({ apiBaseUrl: baseUrl, refreshToken: "to-revoke" });
    } finally {
      await close();
    }
  });

  it("runCliPkceLogin completes E2E against mock token URL (no browser)", async () => {
    const { baseUrl, close } = await mockApiServer(async (req) => {
      if (req.url?.startsWith(CLI_TOKEN_PATH) && req.method === "POST") {
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          req.on("data", (c: Buffer) => chunks.push(c));
          req.on("end", () => resolve());
          req.on("error", reject);
        });
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
          code_verifier: string;
        };
        expect(parsed.code_verifier.length).toBeGreaterThanOrEqual(43);
        return {
          status: 200,
          body: JSON.stringify({
            access_token:
              "eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.signature",
            refresh_token: "r",
          }),
        };
      }
      return { status: 404, body: "not found", contentType: "text/plain" };
    });

    try {
      const out = await runCliPkceLogin({
        apiBaseUrl: baseUrl,
        webLoginUrl: DEFAULT_CLI_WEB_LOGIN_URL,
        noBrowserFlag: true,
        openBrowser: true,
        testAuthorizationCode: "from-mock-browser",
        stdoutLine: () => {},
        stderrLine: () => {},
      });
      expect(out.accessToken).toContain("eyJ");
      expect(out.refreshToken).toBe("r");
      expect(out.displayEmail).toBe("test@example.com");
    } finally {
      await close();
    }
  });

  it("runCliPkceLogin hits loopback when openUrl triggers redirect (mock browser)", async () => {
    const { baseUrl, close } = await mockApiServer(async (req) => {
      if (req.url?.startsWith(CLI_TOKEN_PATH) && req.method === "POST") {
        return {
          status: 200,
          body: JSON.stringify({ access_token: "a", refresh_token: "b" }),
        };
      }
      return { status: 404, body: "not found", contentType: "text/plain" };
    });

    try {
      const result = await runCliPkceLogin({
        apiBaseUrl: baseUrl,
        webLoginUrl: DEFAULT_CLI_WEB_LOGIN_URL,
        noBrowserFlag: false,
        openBrowser: true,
        stdoutLine: () => {},
        stderrLine: () => {},
        openUrl: async (loginUrl) => {
          const u = new URL(loginUrl);
          const redirect = u.searchParams.get("redirect_uri");
          expect(redirect).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
          const r = await fetch(`${redirect}?code=loopback-code`);
          expect(r.ok).toBe(true);
        },
      });
      expect(result.accessToken).toBe("a");
    } finally {
      await close();
    }
  });
});
