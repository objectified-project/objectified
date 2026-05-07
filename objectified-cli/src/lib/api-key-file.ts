import fs from "node:fs";
import path from "node:path";

import { ObjectifiedCliError } from "./errors.js";
import { EXIT_CODES } from "./exit-codes.js";

export function readApiKeyFromFile(filePath: string): string {
  const resolved = path.resolve(process.cwd(), filePath);
  let raw: string;
  try {
    raw = fs.readFileSync(resolved, "utf8");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new ObjectifiedCliError({
      message: `Could not read API key file (${msg}).`,
      exitCode: EXIT_CODES.MISUSE,
      title: "Invalid usage",
      hint: "Check --api-key-file path permissions and that the file exists.",
    });
  }
  const key = raw.replace(/^\uFEFF/, "").trim();
  if (key === "") {
    throw new ObjectifiedCliError({
      message: "API key file is empty.",
      exitCode: EXIT_CODES.MISUSE,
      title: "Invalid usage",
      hint: "Put the API key on a single line in the file, or use --api-key / OBJECTIFIED_API_KEY.",
    });
  }
  return key;
}
