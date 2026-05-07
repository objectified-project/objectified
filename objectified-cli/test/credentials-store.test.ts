import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  delete process.env.OBJECTIFIED_CLI_CREDENTIAL_BACKEND;
  vi.resetModules();
  vi.doUnmock("keytar");
});

describe("CLI credential store", () => {
  it("stores only oauth tokens in the memory backend", async () => {
    process.env.OBJECTIFIED_CLI_CREDENTIAL_BACKEND = "memory";
    const {
      loadCliOAuthCredentials,
      resetMemoryCredentialBackend,
      saveCliOAuthCredentials,
    } = await import("../src/lib/credentials/store.js");

    resetMemoryCredentialBackend();
    await saveCliOAuthCredentials(
      "default",
      {
        accessToken: "access",
        refreshToken: "refresh",
        displayEmail: "user@example.com",
      } as unknown as Parameters<typeof saveCliOAuthCredentials>[1],
    );

    await expect(loadCliOAuthCredentials("default")).resolves.toEqual({
      accessToken: "access",
      refreshToken: "refresh",
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
