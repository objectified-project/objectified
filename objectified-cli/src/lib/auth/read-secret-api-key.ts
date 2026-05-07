import fs from "node:fs";

import { stdin as input, stdout as stderr } from "node:process";

import { ObjectifiedCliError } from "../errors.js";
import { EXIT_CODES } from "../exit-codes.js";

/**
 * Reads an API key without echoing input on TTYs (#3195).
 * Falls back to stdin pipe when not a TTY (CI / scripting).
 */
export async function readApiKeyInteractively(): Promise<string> {
  if (!input.isTTY) {
    return fs.readFileSync(0, "utf8").trim();
  }

  stderr.write("Paste your API key (input hidden): ");

  return await new Promise((resolve, reject) => {
    const chars: string[] = [];
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");

    const cleanup = (): void => {
      input.setRawMode(false);
      input.removeListener("data", onData);
      input.pause();
    };

    const onData = (buf: Buffer | string): void => {
      const s = typeof buf === "string" ? buf : buf.toString("utf8");
      for (const ch of s) {
        if (ch === "\n" || ch === "\r") {
          cleanup();
          stderr.write("\n");
          resolve(chars.join("").trim());
          return;
        }
        if (ch === "\u0003") {
          cleanup();
          stderr.write("\n");
          reject(
            new ObjectifiedCliError({
              message: "Interrupted.",
              exitCode: EXIT_CODES.GENERIC,
            }),
          );
          return;
        }
        if (ch === "\u007f" || ch === "\b") {
          chars.pop();
          continue;
        }
        chars.push(ch);
      }
    };

    input.on("data", onData);
  });
}
