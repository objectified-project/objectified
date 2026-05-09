import { describe, expect, it } from "vitest";

import { resolveSpecImportKind, sniffSourceKindFromBytes } from "../src/lib/import/spec-format.js";

describe("resolveSpecImportKind", () => {
  it("sniffs openapi YAML", () => {
    const bytes = Buffer.from("# prelude\nopenapi: 3.0.3\ninfo:\n  title: x\n");
    const r = resolveSpecImportKind({
      resolvedPath: "/tmp/spec.yaml",
      bytes,
    });
    expect(r.sourceKind).toBe("openapi-3");
  });

  it("sniffs asyncapi JSON", () => {
    const bytes = Buffer.from(
      JSON.stringify({ asyncapi: "2.6.0", info: { title: "e", version: "1" } }),
    );
    const r = resolveSpecImportKind({
      resolvedPath: "/tmp/spec.json",
      bytes,
    });
    expect(r.sourceKind).toBe("asyncapi-2");
  });

  it("honors explicit --format over sniff", () => {
    const bytes = Buffer.from("opaque");
    const r = resolveSpecImportKind({
      explicitFormat: "protobuf",
      resolvedPath: "/tmp/weird.yaml",
      bytes,
    });
    expect(r.sourceKind).toBe("protobuf");
  });

  it("detects protobuf by extension", () => {
    const bytes = Buffer.from('syntax = "proto3";\n');
    const r = resolveSpecImportKind({
      resolvedPath: "/tmp/model.proto",
      bytes,
    });
    expect(r.sourceKind).toBe("protobuf");
  });
});

describe("sniffSourceKindFromBytes", () => {
  it("returns undefined for empty buffer", () => {
    expect(sniffSourceKindFromBytes(Buffer.alloc(0))).toBeUndefined();
  });
});
