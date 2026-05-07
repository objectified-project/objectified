import { describe, expect, it } from "vitest";

import {
  buildObjectifiedContext,
  DEFAULT_BASE_URL,
  resolveAllowColor,
  resolveApiKey,
  resolveJson,
  resolveVerbose,
} from "../src/lib/cli-context.js";
import { parseTomlConfig } from "../src/lib/config.js";

function docFromToml(): ReturnType<typeof parseTomlConfig> {
  return parseTomlConfig(`
[default]
base_url = "https://cfg-default.example"

[profile.prod]
base_url = "https://cfg-prod.example"
api_key = "cfg-prod-key"

[profile.staging]
base_url = "https://cfg-staging.example"
`);
}

describe("cli-context resolution", () => {
  it("resolves base URL: flag > env > profile config > default config > built-in", () => {
    const doc = docFromToml();
    const tty = true;

    expect(
      buildObjectifiedContext({
        flags: { baseUrl: "https://flag.example" },
        env: { OBJECTIFIED_BASE_URL: "https://env.example" },
        stdoutIsTTY: tty,
        supportsColorStdout: true,
        configDoc: doc,
        configPath: "/tmp/fake/objectified/config.toml",
      }).context.baseUrl,
    ).toBe("https://flag.example");

    expect(
      buildObjectifiedContext({
        flags: {},
        env: { OBJECTIFIED_BASE_URL: "https://env.example" },
        stdoutIsTTY: tty,
        supportsColorStdout: true,
        configDoc: doc,
        configPath: "/tmp/fake/objectified/config.toml",
      }).context.baseUrl,
    ).toBe("https://env.example");

    expect(
      buildObjectifiedContext({
        flags: { profile: "prod" },
        env: {},
        stdoutIsTTY: tty,
        supportsColorStdout: true,
        configDoc: doc,
        configPath: "/tmp/fake/objectified/config.toml",
      }).context.baseUrl,
    ).toBe("https://cfg-prod.example");

    expect(
      buildObjectifiedContext({
        flags: { profile: "unknown" },
        env: {},
        stdoutIsTTY: tty,
        supportsColorStdout: true,
        configDoc: doc,
        configPath: "/tmp/fake/objectified/config.toml",
      }).context.baseUrl,
    ).toBe("https://cfg-default.example");

    expect(
      buildObjectifiedContext({
        flags: {},
        env: {},
        stdoutIsTTY: tty,
        supportsColorStdout: true,
        configDoc: { default: {}, profiles: {} },
        configPath: "/tmp/fake/objectified/config.toml",
      }).context.baseUrl,
    ).toBe(DEFAULT_BASE_URL);
  });

  it("resolves API key: flag > env > profile config > default config", () => {
    const doc = parseTomlConfig(`
[default]
api_key = "cfg-default-key"

[profile.prod]
api_key = "cfg-prod-key"
`);

    expect(
      resolveApiKey("flag-key", { OBJECTIFIED_API_KEY: "env-key" }, { apiKey: "cfg-key" }),
    ).toBe("flag-key");
    expect(
      resolveApiKey(undefined, { OBJECTIFIED_API_KEY: "env-key" }, { apiKey: "cfg-key" }),
    ).toBe("env-key");
    expect(resolveApiKey(undefined, {}, { apiKey: "cfg-key" })).toBe("cfg-key");
    expect(
      buildObjectifiedContext({
        flags: { profile: "prod" },
        env: {},
        stdoutIsTTY: true,
        supportsColorStdout: true,
        configDoc: doc,
        configPath: "/tmp/fake/objectified/config.toml",
      }).context.apiKey,
    ).toBe("cfg-prod-key");

    expect(
      buildObjectifiedContext({
        flags: { profile: "staging" },
        env: {},
        stdoutIsTTY: true,
        supportsColorStdout: true,
        configDoc: doc,
        configPath: "/tmp/fake/objectified/config.toml",
      }).context.apiKey,
    ).toBe("cfg-default-key");
  });

  it("resolves JSON: flag > OBJECTIFIED_JSON > auto when stdout is not a TTY", () => {
    expect(resolveJson(true, {}, true)).toBe(true);
    expect(resolveJson(false, {}, false)).toBe(false);
    expect(resolveJson(undefined, { OBJECTIFIED_JSON: "1" }, true)).toBe(true);
    expect(resolveJson(undefined, {}, false)).toBe(true);
    expect(resolveJson(undefined, {}, true)).toBe(false);
  });

  it("resolves verbose: flag > OBJECTIFIED_VERBOSE", () => {
    expect(resolveVerbose(true, {})).toBe(true);
    expect(resolveVerbose(false, { OBJECTIFIED_VERBOSE: "1" })).toBe(false);
    expect(resolveVerbose(undefined, { OBJECTIFIED_VERBOSE: "1" })).toBe(true);
    expect(resolveVerbose(undefined, {})).toBe(false);
  });

  it("disables color for --no-color, NO_COLOR, or non-TTY; enables with --color", () => {
    // --no-color explicitly disables (color flag = false)
    expect(resolveAllowColor(false, {}, true, true)).toBe(false);
    // --color explicitly enables even without TTY
    expect(resolveAllowColor(true, {}, false, false)).toBe(true);
    // NO_COLOR env var disables
    expect(resolveAllowColor(undefined, { NO_COLOR: "1" }, true, true)).toBe(false);
    // non-TTY disables when not explicitly set
    expect(resolveAllowColor(undefined, {}, false, true)).toBe(false);
    // no color support disables
    expect(resolveAllowColor(undefined, {}, true, false)).toBe(false);
    // TTY + color support with no flag → enabled
    expect(resolveAllowColor(undefined, {}, true, true)).toBe(true);
  });

  it("surfaces verboseEffective from env when flag omitted", () => {
    const r = buildObjectifiedContext({
      flags: {},
      env: { OBJECTIFIED_VERBOSE: "1" },
      stdoutIsTTY: true,
      supportsColorStdout: true,
      configDoc: { default: {}, profiles: {} },
      configPath: "/tmp/fake/objectified/config.toml",
    });
    expect(r.verboseEffective).toBe(true);
  });
});
