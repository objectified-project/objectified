import { describe, expect, it } from "vitest";

import { EXIT_CODES } from "../src/lib/exit-codes.js";
import { httpStatusToCliError } from "../src/lib/errors.js";

const handled4xx = new Set([
  401, 402, 403, 404, 405, 407, 408, 409, 410, 418, 423, 426, 429, 431, 451,
]);

describe("httpStatusToCliError", () => {
  const ctx = { requestId: "7f2c9d01-a041", retriesAttempted: 3 };

  it("maps representative statuses", () => {
    expect(httpStatusToCliError(401, "nope", ctx).exitCode).toBe(EXIT_CODES.NOT_AUTHENTICATED);
    expect(httpStatusToCliError(401, "nope", { ...ctx, credentialsWereSent: true }).exitCode).toBe(
      EXIT_CODES.FORBIDDEN,
    );
    expect(httpStatusToCliError(403, "nope", ctx).exitCode).toBe(EXIT_CODES.FORBIDDEN);
    expect(httpStatusToCliError(404, "nope", ctx).exitCode).toBe(EXIT_CODES.NOT_FOUND);
    expect(httpStatusToCliError(409, "nope", ctx).exitCode).toBe(EXIT_CODES.CONFLICT);
    expect(httpStatusToCliError(408, "nope", ctx).exitCode).toBe(EXIT_CODES.NETWORK);
    expect(httpStatusToCliError(429, "nope", ctx).exitCode).toBe(EXIT_CODES.RATE_LIMITED);
    expect(httpStatusToCliError(405, "nope", ctx).exitCode).toBe(EXIT_CODES.MISUSE);
    expect(httpStatusToCliError(500, "nope", ctx).exitCode).toBe(EXIT_CODES.SERVER_ERROR);
    expect(httpStatusToCliError(504, "nope", ctx).exitCode).toBe(EXIT_CODES.NETWORK);
    expect(httpStatusToCliError(418, "teapot", ctx).exitCode).toBe(EXIT_CODES.GENERIC);
  });

  it("maps every unhandled 4xx to validation", () => {
    for (let s = 400; s <= 499; s++) {
      if (handled4xx.has(s)) continue;
      expect(httpStatusToCliError(s, "", {}).exitCode).toBe(EXIT_CODES.VALIDATION);
    }
  });

  it("maps every 5xx", () => {
    for (let s = 500; s <= 599; s++) {
      const want = s === 504 ? EXIT_CODES.NETWORK : EXIT_CODES.SERVER_ERROR;
      expect(httpStatusToCliError(s, "", {}).exitCode).toBe(want);
    }
  });
});
