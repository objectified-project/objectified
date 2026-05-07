import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  delete process.env.OBJECTIFIED_CLI_CREDENTIAL_BACKEND;
  vi.resetModules();
  vi.doUnmock("keytar");
});

describe("CLI credential store", () => {
  it("stores only oauth tokens in the memory backend", async () => {
    process.env.OBJECTIFIED_CLI_CREDENTIAL_BACKEND = "memory";
    const { loadCliOAuthCredentials, resetMemoryCredentialBackend, saveCliOAuthCredentials } =
      await import("../src/lib/credentials/store.js");

    resetMemoryCredentialBackend();
    const bundleWithDisplayEmail: Parameters<typeof saveCliOAuthCredentials>[1] & {
      displayEmail: string;
    } = {
      accessToken: "access",
      refreshToken: "refresh",
      displayEmail: "user@example.com",
    };
    await saveCliOAuthCredentials("default", bundleWithDisplayEmail);

    await expect(loadCliOAuthCredentials("default")).resolves.toEqual({
      accessToken: "access",
      refreshToken: "refresh",
    });
  });

  it("stores API keys in the memory backend (#3195)", async () => {
    process.env.OBJECTIFIED_CLI_CREDENTIAL_BACKEND = "memory";
    const { loadCliStoredAuth, resetMemoryCredentialBackend, saveCliApiKeyCredentials } =
      await import("../src/lib/credentials/store.js");

    resetMemoryCredentialBackend();
    await saveCliApiKeyCredentials("default", "sk_live_unit_test_12345");

    await expect(loadCliStoredAuth("default")).resolves.toEqual({
      kind: "api_key",
      apiKey: "sk_live_unit_test_12345",
    });
  });

  it("wraps keytar load failures with an actionable error", async () => {
    vi.doMock("keytar", () => {
      throw new Error("libsecret missing");
    });

    const { saveCliOAuthCredentials } = await import("../src/lib/credentials/store.js");

    await expect(
      saveCliOAuthCredentials("default", {
        accessToken: "access",
        refreshToken: "refresh",
      }),
    ).rejects.toMatchObject({
      name: "ObjectifiedCliError",
      message: expect.stringContaining("OS keychain is unavailable for CLI credentials"),
      hint: expect.stringContaining("OBJECTIFIED_CLI_CREDENTIAL_BACKEND=memory"),
    });
  });
});
