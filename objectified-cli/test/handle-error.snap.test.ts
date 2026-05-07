import { CLIError } from "@oclif/core/errors";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EXIT_CODES } from "../src/lib/exit-codes.js";
import { httpStatusToCliError, networkErrnoToCliError, ObjectifiedCliError } from "../src/lib/errors.js";
import {
  formatAndReportCliFailure,
  handleError,
  resetRegisteredCommandIdsCache,
  setRegisteredCommandIdsOverride,
} from "../src/lib/handle-error.js";

const noColor = { debugStacks: false, color: false };

beforeEach(() => {
  resetRegisteredCommandIdsCache();
});

afterEach(() => {
  vi.restoreAllMocks();
  resetRegisteredCommandIdsCache();
});

describe("handleError snapshots by category", () => {
  it("generic ObjectifiedCliError", () => {
    expect(
      handleError(
        new ObjectifiedCliError({
          message: "Something unexpected happened.",
          exitCode: EXIT_CODES.GENERIC,
          title: "Unexpected failure",
          hint: "Retry later or contact support with the request-id.",
          requestId: "7f2c9d01a041cafe",
        }),
        noColor,
      ),
    ).toMatchSnapshot();
  });

  it("misuse (oclif unknown flag)", () => {
    expect(
      handleError(new CLIError("Unexpected flag --frobnitz\nSee more help with --help"), noColor),
    ).toMatchSnapshot();
  });

  it("not authenticated", () => {
    expect(
      handleError(httpStatusToCliError(401, "Missing bearer token", { requestId: "rid-401" }), noColor),
    ).toMatchSnapshot();
  });

  it("forbidden", () => {
    expect(
      handleError(httpStatusToCliError(403, "Tenant mismatch", { requestId: "rid-403" }), noColor),
    ).toMatchSnapshot();
  });

  it("not found", () => {
    expect(
      handleError(httpStatusToCliError(404, "Project unknown", { requestId: "rid-404" }), noColor),
    ).toMatchSnapshot();
  });

  it("conflict", () => {
    expect(
      handleError(httpStatusToCliError(409, "Version already exists", { requestId: "rid-409" }), noColor),
    ).toMatchSnapshot();
  });

  it("validation", () => {
    expect(
      handleError(httpStatusToCliError(422, "Invalid payload", { requestId: "rid-422" }), noColor),
    ).toMatchSnapshot();
  });

  it("server error", () => {
    expect(
      handleError(
        httpStatusToCliError(503, "Upstream unavailable", {
          requestId: "rid-503",
          retriesAttempted: 3,
        }),
        noColor,
      ),
    ).toMatchSnapshot();
  });

  it("network / errno", () => {
    const err = networkErrnoToCliError(
      Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:9"), { code: "ECONNREFUSED" }),
    );
    expect(handleError(err, noColor)).toMatchSnapshot();
  });

  it("rate limited", () => {
    expect(
      handleError(httpStatusToCliError(429, "Slow down", { requestId: "rid-429" }), noColor),
    ).toMatchSnapshot();
  });

  it("config error", () => {
    expect(
      handleError(
        new ObjectifiedCliError({
          message: "Invalid TOML in config.",
          exitCode: EXIT_CODES.CONFIG,
          title: "Configuration error",
          hint: "Run `objectified config path` and repair the file.",
        }),
        noColor,
      ),
    ).toMatchSnapshot();
  });

  it("unknown command with did-you-mean", () => {
    setRegisteredCommandIdsOverride(["hello"]);
    expect(handleError(new CLIError("command helol not found"), noColor)).toMatchSnapshot();
  });

  it("prints generic error stack once when debug stacks are enabled", () => {
    const err = new Error("boom");
    err.stack = "Error: boom\n  at test";
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const exit = formatAndReportCliFailure(err, { debugStacks: true, color: false });

    expect(exit).toBe(EXIT_CODES.GENERIC);
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const rendered = String(stderrSpy.mock.calls[0]?.[0] ?? "");
    expect(rendered.match(/Error: boom/g)?.length ?? 0).toBe(1);
  });
});
