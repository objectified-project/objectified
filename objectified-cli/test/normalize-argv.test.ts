import { describe, expect, it } from "vitest";

import {
  authLoginIntendsApiKeyStore,
  normalizeAuthLoginApiKeyPrompt,
  normalizeCliArgv,
  promoteLeadingGlobalFlags,
  readExplicitConfigFromArgv,
} from "../src/lib/normalize-argv.js";
import { API_KEY_PROMPT_SENTINEL } from "../src/lib/constants.js";

describe("promoteLeadingGlobalFlags", () => {
  it("moves leading globals after the command", () => {
    expect(promoteLeadingGlobalFlags(["--json", "hello"])).toEqual(["hello", "--json"]);
    expect(promoteLeadingGlobalFlags(["--json", "projects", "list"])).toEqual([
      "projects",
      "list",
      "--json",
    ]);
    expect(promoteLeadingGlobalFlags(["--quiet", "--verbose", "hello", "Ada"])).toEqual([
      "hello",
      "Ada",
      "--quiet",
      "--verbose",
    ]);
  });

  it("preserves argv when globals already trail the command", () => {
    expect(promoteLeadingGlobalFlags(["hello", "--json"])).toEqual(["hello", "--json"]);
  });

  it("handles value flags with a separate token", () => {
    expect(promoteLeadingGlobalFlags(["--profile", "prod", "hello"])).toEqual([
      "hello",
      "--profile",
      "prod",
    ]);
    expect(
      promoteLeadingGlobalFlags(["--base-url", "https://x.example", "projects", "list"]),
    ).toEqual(["projects", "list", "--base-url", "https://x.example"]);
  });

  it("handles equals form", () => {
    expect(promoteLeadingGlobalFlags(["--base-url=https://x.example", "hello"])).toEqual([
      "hello",
      "--base-url=https://x.example",
    ]);
    expect(promoteLeadingGlobalFlags(["--config=/tmp/obj.toml", "config", "path"])).toEqual([
      "config",
      "path",
      "--config=/tmp/obj.toml",
    ]);
  });

  it("stops at unknown leading flags", () => {
    expect(promoteLeadingGlobalFlags(["--unknown", "hello"])).toEqual(["--unknown", "hello"]);
  });
});

describe("normalizeAuthLoginApiKeyPrompt", () => {
  it("inserts a sentinel when auth login --api-key has no value", () => {
    expect(normalizeAuthLoginApiKeyPrompt(["auth", "login", "--api-key"])).toEqual([
      "auth",
      "login",
      "--api-key",
      API_KEY_PROMPT_SENTINEL,
    ]);
  });

  it("does not insert when a value follows --api-key", () => {
    const argv = ["auth", "login", "--api-key", "sk_test_123"];
    expect(normalizeAuthLoginApiKeyPrompt(argv)).toEqual(argv);
  });
});

describe("authLoginIntendsApiKeyStore", () => {
  it("is true when --api-key follows auth login", () => {
    expect(authLoginIntendsApiKeyStore(["auth", "login", "--api-key"])).toBe(true);
  });

  it("is false when --api-key appears only before auth login", () => {
    expect(authLoginIntendsApiKeyStore(["--api-key", "x", "auth", "login"])).toBe(false);
  });
});

describe("readExplicitConfigFromArgv", () => {
  it("reads equals and spaced forms after normalization", () => {
    expect(readExplicitConfigFromArgv(["config", "path", "--config=/tmp/a.toml"])).toBe("/tmp/a.toml");
    expect(readExplicitConfigFromArgv(["hello", "--config", "/tmp/b.toml"])).toBe("/tmp/b.toml");
    expect(readExplicitConfigFromArgv(["hello"])).toBe(undefined);
  });
});

describe("normalizeCliArgv", () => {
  it("composes promotion and auth login prompt fix", () => {
    expect(normalizeCliArgv(["--json", "auth", "login", "--api-key"])).toEqual([
      "auth",
      "login",
      "--api-key",
      API_KEY_PROMPT_SENTINEL,
      "--json",
    ]);
  });
});
