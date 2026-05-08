import { describe, expect, it } from "vitest";

import type { CliWhoamiApiModel } from "../src/lib/auth/cli-whoami.js";
import {
  buildAuthStatusStableJson,
  formatAuthStatusHumanLines,
} from "../src/lib/auth/cli-whoami.js";
import { stableDeepSort } from "../src/lib/output.js";

const sampleModel: CliWhoamiApiModel = {
  tenant: { slug: "acme-corp", name: "Acme Corporation" },
  user: { id: "u_abc", email: "kenji@objectified.dev" },
  plan: "enterprise",
  auth: {
    type: "oauth",
    expires_at: "2026-05-07T18:12:00.000Z",
    refresh_valid: true,
  },
};

describe("auth status snapshots (#3196)", () => {
  it("human output lines", () => {
    const lines = formatAuthStatusHumanLines({
      profile: "default",
      baseUrl: "https://api.objectified.dev",
      profileTenantSlug: undefined,
      model: sampleModel,
      activeCredentialKind: "oauth_keychain",
      bearer: "unused",
      now: new Date("2026-05-07T12:00:00.000Z"),
    });
    expect(lines.join("\n")).toMatchSnapshot();
  });

  it("stable JSON payload", () => {
    const doc = buildAuthStatusStableJson({
      profile: "default",
      baseUrl: "https://api.objectified.dev",
      profileTenantSlug: undefined,
      model: sampleModel,
      activeCredentialKind: "oauth_keychain",
      bearer: "unused",
    });
    expect(JSON.stringify(stableDeepSort(doc), null, 2)).toMatchSnapshot();
  });

  it("API key auth JSON omits expires_at", () => {
    const doc = buildAuthStatusStableJson({
      profile: "default",
      baseUrl: "https://api.objectified.dev",
      profileTenantSlug: "acme-corp",
      model: {
        tenant: null,
        user: { id: null, email: "svc@example.com" },
        plan: "pro",
        auth: { type: null, expires_at: null, refresh_valid: null },
      },
      activeCredentialKind: "api_key_env",
      bearer: undefined,
    });
    expect(doc.auth).toEqual({ type: "api_key" });
  });
});
