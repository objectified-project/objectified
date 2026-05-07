/**
 * oclif parses argv as `[command] [args...] [flags...]`. Promote known global flags
 * that appear before the command to the tail so `objectified --json hello` works like `hello --json`.
 */

import { API_KEY_PROMPT_SENTINEL } from "./constants.js";

function indexOfSubcommand(argv: string[], parts: string[]): number {
  outer: for (let i = 0; i <= argv.length - parts.length; i++) {
    for (let j = 0; j < parts.length; j++) {
      if (argv[i + j] !== parts[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/** True when normalized argv has `auth login … --api-key …` (explicit store / prompt flow). */
export function authLoginIntendsApiKeyStore(argv: string[]): boolean {
  const loginAt = indexOfSubcommand(argv, ["auth", "login"]);
  if (loginAt === -1) return false;
  const afterLogin = loginAt + 2;
  for (let i = afterLogin; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--api-key") return true;
    if (t?.startsWith("--api-key=")) return true;
  }
  return false;
}

/** Ensures `auth login --api-key` without a value parses by inserting a sentinel token. */
export function normalizeAuthLoginApiKeyPrompt(argv: string[]): string[] {
  const loginAt = indexOfSubcommand(argv, ["auth", "login"]);
  if (loginAt === -1) return argv;
  const afterLogin = loginAt + 2;
  for (let i = afterLogin; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--api-key") {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("-")) {
        const out = [...argv];
        out.splice(i + 1, 0, API_KEY_PROMPT_SENTINEL);
        return out;
      }
      return argv;
    }
    if (t?.startsWith("--api-key=")) {
      const rest = t.slice("--api-key=".length);
      if (rest === "") {
        const out = [...argv];
        out[i] = `--api-key=${API_KEY_PROMPT_SENTINEL}`;
        return out;
      }
      return argv;
    }
  }
  return argv;
}

export function normalizeCliArgv(argv: string[]): string[] {
  return normalizeAuthLoginApiKeyPrompt(promoteLeadingGlobalFlags(argv));
}

const BOOL_GLOBALS = new Set([
  "--json",
  "--no-json",
  "--no-color",
  "--color",
  "--quiet",
  "-q",
  "--verbose",
  "--help",
  "-h",
  "--version",
]);

const VALUE_GLOBALS = new Set([
  "--api-key",
  "--api-key-file",
  "--base-url",
  "--config",
  "--profile",
]);

function valueFlagName(token: string): string | undefined {
  const eq = token.indexOf("=");
  return eq === -1 ? token : token.slice(0, eq);
}

export function promoteLeadingGlobalFlags(argv: string[]): string[] {
  const promoted: string[] = [];
  let i = 0;
  while (i < argv.length) {
    const tok = argv[i];
    if (tok === undefined) break;
    if (tok === "--") break;
    if (!tok.startsWith("-")) break;

    if (BOOL_GLOBALS.has(tok)) {
      promoted.push(tok);
      i++;
      continue;
    }

    const name = valueFlagName(tok);
    if (name !== undefined && tok.includes("=")) {
      if (VALUE_GLOBALS.has(name) || BOOL_GLOBALS.has(name)) {
        promoted.push(tok);
        i++;
        continue;
      }
      break;
    }

    if (name !== undefined && VALUE_GLOBALS.has(name)) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("-")) {
        promoted.push(tok, next);
        i += 2;
        continue;
      }
      promoted.push(tok);
      i++;
      continue;
    }

    break;
  }

  return [...argv.slice(i), ...promoted];
}
