import { describe, expect, it } from "vitest";

import { promoteLeadingGlobalFlags } from "../src/lib/normalize-argv.js";

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
  });

  it("stops at unknown leading flags", () => {
    expect(promoteLeadingGlobalFlags(["--unknown", "hello"])).toEqual(["--unknown", "hello"]);
  });
});
