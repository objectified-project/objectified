/**
 * oclif parses argv as `[command] [args...] [flags...]`. Promote known global flags
 * that appear before the command to the tail so `objectified --json hello` works like `hello --json`.
 */

const BOOL_GLOBALS = new Set([
  "--json",
  "--no-json",
  "--no-color",
  "--color",
  "--quiet",
  "-q",
  "--verbose",
]);

const VALUE_GLOBALS = new Set(["--api-key", "--base-url", "--config", "--profile"]);

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
