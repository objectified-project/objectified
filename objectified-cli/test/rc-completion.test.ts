import { describe, expect, it } from "vitest";

import { COMPLETION_BEGIN, COMPLETION_END } from "../src/lib/completion/constants.js";
import {
  stripMarkedCompletionBlock,
  upsertMarkedCompletionBlock,
} from "../src/lib/completion/rc-file.js";

describe("completion rc markers", () => {
  it("upserts a new marked block", () => {
    const next = upsertMarkedCompletionBlock("echo hello\n", "body line");
    expect(next).toContain(COMPLETION_BEGIN);
    expect(next).toContain(COMPLETION_END);
    expect(next).toContain("body line");
    expect(next).toContain("echo hello");
  });

  it("replaces an existing marked block", () => {
    const first = upsertMarkedCompletionBlock("", "v1");
    const second = upsertMarkedCompletionBlock(first, "v2");
    expect(second.match(new RegExp(COMPLETION_BEGIN, "g"))?.length).toBe(1);
    expect(second).toContain("v2");
    expect(second).not.toContain("v1");
  });

  it("stripMarkedCompletionBlock removes only the marked region", () => {
    const wrapped = upsertMarkedCompletionBlock("before\n", "mid");
    const stripped = stripMarkedCompletionBlock(wrapped);
    expect(stripped).toContain("before");
    expect(stripped).not.toContain(COMPLETION_BEGIN);
    expect(stripped).not.toContain("mid");
  });

  it("stripMarkedCompletionBlock removes all marked regions", () => {
    const withBlocks = [
      "before",
      COMPLETION_BEGIN,
      "one",
      COMPLETION_END,
      "between",
      COMPLETION_BEGIN,
      "two",
      COMPLETION_END,
      "after",
      "",
    ].join("\n");
    const stripped = stripMarkedCompletionBlock(withBlocks);
    expect(stripped).toBe("before\nbetween\nafter");
    expect(stripped).not.toContain(COMPLETION_BEGIN);
    expect(stripped).not.toContain("one");
    expect(stripped).not.toContain("two");
  });

  it("upsertMarkedCompletionBlock replaces all marked regions with a single block", () => {
    const withBlocks = [
      "before",
      COMPLETION_BEGIN,
      "one",
      COMPLETION_END,
      "between",
      COMPLETION_BEGIN,
      "two",
      COMPLETION_END,
      "",
    ].join("\n");
    const next = upsertMarkedCompletionBlock(withBlocks, "new");
    expect(next.match(new RegExp(COMPLETION_BEGIN, "g"))?.length).toBe(1);
    expect(next).toContain("before");
    expect(next).toContain("between");
    expect(next).toContain("new");
    expect(next).not.toContain("one");
    expect(next).not.toContain("two");
  });
});
