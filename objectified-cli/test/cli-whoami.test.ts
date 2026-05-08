import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";

import { CLI_TOKEN_PATH, CLI_WHOAMI_PATH } from "../src/lib/auth/cli-oauth.js";
import { fetchCliWhoami } from "../src/lib/auth/cli-whoami.js";

async function mockApiServer(
  handler: (req: import("node:http").IncomingMessage) => Promise<{
    status: number;
    body?: string;
    contentType?: string;
  }>,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
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

describe("fetchCliWhoami", () => {
  it("retries whoami once after silent OAuth refresh on 401", async () => {
    let whoamiCalls = 0;
    const { baseUrl, close } = await mockApiServer(async (req) => {
      const url = req.url ?? "";
      if (url.startsWith(CLI_WHOAMI_PATH) && req.method === "GET") {
        whoamiCalls++;
        if (whoamiCalls === 1) {
          return { status: 401, body: JSON.stringify({ detail: "expired" }) };
        }
        return {
          status: 200,
          body: JSON.stringify({
            tenant: { slug: "acme", name: "Acme" },
            user: { id: "u1", email: "a@b.c" },
            plan: "enterprise",
            auth: { type: "oauth", expires_at: "2026-05-07T20:00:00.000Z" },
          }),
        };
      }
      if (url.startsWith(CLI_TOKEN_PATH) && req.method === "POST") {
        return {
          status: 200,
          body: JSON.stringify({
            access_token: "fresh-access",
            refresh_token: "fresh-refresh",
          }),
        };
      }
      return { status: 404, body: "not found", contentType: "text/plain" };
    });

    try {
      const auth: { apiKey?: string; bearer?: string } = { bearer: "stale" };
      let rotated: string[] = [];
      const model = await fetchCliWhoami({
        baseUrl,
        auth,
        activeCredentialKind: "oauth_keychain",
        oauthRefresh: {
          refreshToken: "old-refresh",
          onRotated: async (access, refresh) => {
            rotated = [access, refresh];
          },
        },
      });
      expect(whoamiCalls).toBe(2);
      expect(auth.bearer).toBe("fresh-access");
      expect(rotated).toEqual(["fresh-access", "fresh-refresh"]);
      expect(model.tenant?.slug).toBe("acme");
    } finally {
      await close();
    }
  });
});
