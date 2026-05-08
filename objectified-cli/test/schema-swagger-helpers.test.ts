import { describe, expect, it } from "vitest";

import { resolveSchemaSwaggerModes } from "../src/lib/schema/schema-swagger-helpers.js";
import { buildPublishedSpecUrls } from "../src/lib/versions/show-format.js";

describe("schema swagger helpers (#3248)", () => {
  it("defaults to browser when TTY and no output/format", () => {
    expect(
      resolveSchemaSwaggerModes({
        stdoutIsTTY: true,
        machineOutput: false,
        openFlag: false,
        outputPath: "",
        formatProvided: false,
      }),
    ).toEqual({ openBrowser: true, writeBundle: false });
  });

  it("defaults to bundle on stdout when not a TTY and no output/format", () => {
    expect(
      resolveSchemaSwaggerModes({
        stdoutIsTTY: false,
        machineOutput: false,
        openFlag: false,
        outputPath: "",
        formatProvided: false,
      }),
    ).toEqual({ openBrowser: false, writeBundle: true });
  });

  it("defaults to bundle when machine JSON output is enabled on a TTY", () => {
    expect(
      resolveSchemaSwaggerModes({
        stdoutIsTTY: true,
        machineOutput: true,
        openFlag: false,
        outputPath: "",
        formatProvided: false,
      }),
    ).toEqual({ openBrowser: false, writeBundle: true });
  });

  it("forces bundle when --format is passed", () => {
    expect(
      resolveSchemaSwaggerModes({
        stdoutIsTTY: true,
        machineOutput: false,
        openFlag: false,
        outputPath: "",
        formatProvided: true,
      }),
    ).toEqual({ openBrowser: false, writeBundle: true });
  });

  it("forces bundle when --output is passed", () => {
    expect(
      resolveSchemaSwaggerModes({
        stdoutIsTTY: true,
        machineOutput: false,
        openFlag: false,
        outputPath: "./x.json",
        formatProvided: false,
      }),
    ).toEqual({ openBrowser: false, writeBundle: true });
  });

  it("opens browser AND writes bundle when --open is passed on non-TTY (additive)", () => {
    expect(
      resolveSchemaSwaggerModes({
        stdoutIsTTY: false,
        machineOutput: false,
        openFlag: true,
        outputPath: "",
        formatProvided: false,
      }),
    ).toEqual({ openBrowser: true, writeBundle: true });
  });

  it("opens browser only (no bundle) when --open is passed on an interactive TTY", () => {
    expect(
      resolveSchemaSwaggerModes({
        stdoutIsTTY: true,
        machineOutput: false,
        openFlag: true,
        outputPath: "",
        formatProvided: false,
      }),
    ).toEqual({ openBrowser: true, writeBundle: false });
  });

  it("opens browser AND writes bundle when --open is passed with machineOutput on TTY (additive)", () => {
    expect(
      resolveSchemaSwaggerModes({
        stdoutIsTTY: true,
        machineOutput: true,
        openFlag: true,
        outputPath: "",
        formatProvided: false,
      }),
    ).toEqual({ openBrowser: true, writeBundle: true });
  });

  it("allows browser plus bundle when --open and --format are both set", () => {
    expect(
      resolveSchemaSwaggerModes({
        stdoutIsTTY: false,
        machineOutput: false,
        openFlag: true,
        outputPath: "",
        formatProvided: true,
      }),
    ).toEqual({ openBrowser: true, writeBundle: true });
  });

  it("builds Swagger UI URL from active API base URL", () => {
    expect(
      buildPublishedSpecUrls({
        baseUrl: "https://api.example.test",
        tenantSlug: "acme-corp",
        projectSlug: "payments-api",
        versionSlug: "2.1.0",
      }).swagger_ui,
    ).toBe("https://api.example.test/v1/swagger/acme-corp/payments-api/2.1.0");
  });

  it("encodes slugs in Swagger UI URL path segments", () => {
    expect(
      buildPublishedSpecUrls({
        baseUrl: "https://api.example.test/",
        tenantSlug: "a/b",
        projectSlug: "c d",
        versionSlug: "1.0.0",
      }).swagger_ui,
    ).toBe(
      `https://api.example.test/v1/swagger/${encodeURIComponent("a/b")}/${encodeURIComponent("c d")}/1.0.0`,
    );
  });
});
