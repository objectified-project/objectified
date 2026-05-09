import { readFile } from "node:fs/promises";
import path from "node:path";

import { ObjectifiedCliError } from "../errors.js";
import { EXIT_CODES } from "../exit-codes.js";

/** Read a local spec path or `-` for stdin (binary-safe). */
export async function readSpecInput(
  pathArg: string,
): Promise<{ bytes: Buffer; resolvedPath: string }> {
  const raw = pathArg.trim();
  if (raw === "") {
    throw new ObjectifiedCliError({
      message: "Spec path is required.",
      exitCode: EXIT_CODES.MISUSE,
      title: "Invalid usage",
      hint: "Pass a file path or `-` to read from stdin.",
    });
  }
  if (raw === "-") {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(
        typeof chunk === "string" ? Buffer.from(chunk, "utf8") : Buffer.from(chunk as Uint8Array),
      );
    }
    const bytes = Buffer.concat(chunks);
    if (bytes.length === 0) {
      throw new ObjectifiedCliError({
        message: "stdin was empty; nothing to import.",
        exitCode: EXIT_CODES.MISUSE,
        title: "Invalid usage",
        hint: "Pipe spec bytes into `objectified import spec -` or pass a file path.",
      });
    }
    return { bytes, resolvedPath: "-" };
  }
  const abs = path.resolve(process.cwd(), raw);
  try {
    const bytes = await readFile(abs);
    return { bytes, resolvedPath: abs };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new ObjectifiedCliError({
      message: `Could not read spec file: ${msg}`,
      exitCode: EXIT_CODES.MISUSE,
      title: "Invalid usage",
      hint: `Check that ${abs} exists and is readable.`,
    });
  }
}
