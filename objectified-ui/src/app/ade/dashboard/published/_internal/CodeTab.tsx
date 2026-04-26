'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';
import type { PublishedVersionRow } from './types';

const SNIPPET_EDITOR_CLASS =
  'bg-slate-950 text-slate-100 dark:bg-black/40 dark:text-slate-100 border-t border-gray-200 dark:border-gray-700/60';

export type SnippetLanguage = 'curl' | 'fetch' | 'axios' | 'python' | 'go';

const LANG_LABEL: Record<SnippetLanguage, string> = {
  curl: 'cURL',
  fetch: 'fetch',
  axios: 'axios',
  python: 'python',
  go: 'go',
};

const LANG_ORDER: SnippetLanguage[] = ['curl', 'fetch', 'axios', 'python', 'go'];

export interface CodeTabProps {
  row: PublishedVersionRow;
  /** Open-spec URL (e.g. `https://api.objectified.dev/v1/schema/{tenant}/{project}/{version}`). */
  specUrl: string;
  /**
   * Env var name that consumers should set for the API key. Defaults
   * to `OBJECTIFIED_API_KEY`. Surfaced in the snippets so private
   * consumers know exactly what to wire up.
   */
  apiKeyEnvVar?: string;
  /** Click → toast feedback in the host page. */
  onCopySnippet?: (lang: SnippetLanguage, text: string) => void;
}

/**
 * Code tab body. Five language strips (cURL / fetch / axios / python /
 * go) with ready-to-paste snippets. Snippets adapt to visibility:
 *
 *   - public    → minimal Accept-only request
 *   - private   → adds `X-API-Key` header sourced from an env var
 *
 * The snippet text is plain — no syntax highlighting at runtime — but
 * the editor block is monospaced and zebra-padded so it reads as code.
 * Lightweight token classes (`tok-com`, `tok-str`) are applied via a
 * one-pass tokenizer that recognises `#`/`//` comments and double-quoted
 * strings (good enough for our snippets).
 */
export function CodeTab({ row, specUrl, apiKeyEnvVar = 'OBJECTIFIED_API_KEY', onCopySnippet }: CodeTabProps) {
  const [active, setActive] = useState<SnippetLanguage>('curl');
  const [copiedLang, setCopiedLang] = useState<SnippetLanguage | null>(null);

  const snippets = useMemo(() => buildSnippets(row, specUrl, apiKeyEnvVar), [row, specUrl, apiKeyEnvVar]);
  const activeSnippet = snippets[active];

  // Auto-clear the copied affordance after a short delay so it doesn't
  // stick. (Switching language naturally hides it because we compare
  // copiedLang to the active language.)
  useEffect(() => {
    if (copiedLang === null) return;
    const t = window.setTimeout(() => setCopiedLang(null), 1600);
    return () => window.clearTimeout(t);
  }, [copiedLang]);

  const isCopied = copiedLang === active;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeSnippet);
      setCopiedLang(active);
      onCopySnippet?.(active, activeSnippet);
    } catch {
      // Clipboard write may be blocked in some browser contexts; the
      // host page can still surface a toast via onCopySnippet.
      onCopySnippet?.(active, activeSnippet);
    }
  };

  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <header className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <Terminal className="w-4 h-4 text-amber-500" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Code</h2>
        <span className="font-mono text-[11px] text-gray-400">
          ready-to-paste snippets · {row.visibility === 'public' ? 'public spec' : 'private spec'}
        </span>
      </header>
      <div className="px-4 pt-3 flex items-center gap-1 flex-wrap border-b border-gray-200 dark:border-gray-700/60">
        {LANG_ORDER.map((lang) => {
          const isActive = active === lang;
          return (
            <button
              key={lang}
              type="button"
              onClick={() => setActive(lang)}
              className={`px-3 py-1.5 text-xs font-mono rounded-t-md -mb-px transition-colors ${
                isActive
                  ? 'border border-b-0 border-gray-200 dark:border-gray-700 bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-indigo-500'
              }`}
              aria-pressed={isActive}
            >
              {LANG_LABEL[lang]}
            </button>
          );
        })}
        <span className="flex-1" />
        <button
          type="button"
          onClick={handleCopy}
          className={`h-7 px-2 rounded-md border text-[11px] inline-flex items-center gap-1 mb-2 transition-colors ${
            isCopied
              ? 'border-emerald-300 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
              : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          {isCopied ? (
            <>
              <Check className="w-3 h-3" /> Copied
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" /> Copy
            </>
          )}
        </button>
      </div>
      <div className={`${SNIPPET_EDITOR_CLASS} font-mono text-[12px] leading-6 p-4 overflow-x-auto`}>
        <SnippetBlock text={activeSnippet} />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */
/* Snippet generators                                               */
/* ---------------------------------------------------------------- */

function buildSnippets(
  row: PublishedVersionRow,
  specUrl: string,
  envVar: string,
): Record<SnippetLanguage, string> {
  const isPublic = row.visibility === 'public';
  const verLabel = `${row.tenant_slug}/${row.project_slug} v${row.version_id}`;

  return {
    curl: isPublic
      ? `# Fetch the OpenAPI spec for ${verLabel} (public — no key needed)
curl "${specUrl}" \\
  -H "Accept: application/yaml"`
      : `# Fetch the OpenAPI spec for ${verLabel} (requires a tenant API key)
curl "${specUrl}" \\
  -H "Accept: application/yaml" \\
  -H "X-API-Key: $${envVar}"`,

    fetch: isPublic
      ? `// Fetch the OpenAPI spec for ${verLabel}
const res = await fetch("${specUrl}", {
  headers: { Accept: "application/yaml" },
});
const spec = await res.text();`
      : `// Fetch the OpenAPI spec for ${verLabel} (requires a tenant API key)
const res = await fetch("${specUrl}", {
  headers: {
    Accept: "application/yaml",
    "X-API-Key": process.env.${envVar} ?? "",
  },
});
const spec = await res.text();`,

    axios: isPublic
      ? `// Fetch the OpenAPI spec for ${verLabel}
import axios from "axios";

const { data: spec } = await axios.get("${specUrl}", {
  headers: { Accept: "application/yaml" },
  responseType: "text",
});`
      : `// Fetch the OpenAPI spec for ${verLabel} (requires a tenant API key)
import axios from "axios";

const { data: spec } = await axios.get("${specUrl}", {
  headers: {
    Accept: "application/yaml",
    "X-API-Key": process.env.${envVar} ?? "",
  },
  responseType: "text",
});`,

    python: isPublic
      ? `# Fetch the OpenAPI spec for ${verLabel}
import httpx

resp = httpx.get(
    "${specUrl}",
    headers={"Accept": "application/yaml"},
)
resp.raise_for_status()
spec = resp.text`
      : `# Fetch the OpenAPI spec for ${verLabel} (requires a tenant API key)
import os
import httpx

resp = httpx.get(
    "${specUrl}",
    headers={
        "Accept": "application/yaml",
        "X-API-Key": os.environ["${envVar}"],
    },
)
resp.raise_for_status()
spec = resp.text`,

    go: isPublic
      ? `// Fetch the OpenAPI spec for ${verLabel}
package main

import (
    "io"
    "net/http"
)

func fetchSpec() (string, error) {
    req, err := http.NewRequest("GET", "${specUrl}", nil)
    if err != nil {
        return "", err
    }
    req.Header.Set("Accept", "application/yaml")
    res, err := http.DefaultClient.Do(req)
    if err != nil {
        return "", err
    }
    defer res.Body.Close()
    body, err := io.ReadAll(res.Body)
    if err != nil {
        return "", err
    }
    return string(body), nil
}`
      : `// Fetch the OpenAPI spec for ${verLabel} (requires a tenant API key)
package main

import (
    "io"
    "net/http"
    "os"
)

func fetchSpec() (string, error) {
    req, err := http.NewRequest("GET", "${specUrl}", nil)
    if err != nil {
        return "", err
    }
    req.Header.Set("Accept", "application/yaml")
    req.Header.Set("X-API-Key", os.Getenv("${envVar}"))
    res, err := http.DefaultClient.Do(req)
    if err != nil {
        return "", err
    }
    defer res.Body.Close()
    body, err := io.ReadAll(res.Body)
    if err != nil {
        return "", err
    }
    return string(body), nil
}`,
  };
}

/* ---------------------------------------------------------------- */
/* Tokenised snippet renderer                                       */
/* ---------------------------------------------------------------- */

interface Token {
  kind: 'text' | 'comment' | 'string';
  text: string;
}

/**
 * One-pass tokenizer. Recognises:
 *   - line comments starting with `#` or `//`
 *   - double-quoted strings (with simple `\\"` escape support)
 * Anything else is plain text. Returns one array of tokens per line so
 * the renderer can newline-separate without splitting any single token.
 */
function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];

    if (ch === '#' || (ch === '/' && line[i + 1] === '/')) {
      tokens.push({ kind: 'comment', text: line.slice(i) });
      i = line.length;
      continue;
    }

    if (ch === '"') {
      let end = i + 1;
      while (end < line.length) {
        if (line[end] === '\\' && end + 1 < line.length) {
          end += 2;
          continue;
        }
        if (line[end] === '"') {
          end += 1;
          break;
        }
        end += 1;
      }
      tokens.push({ kind: 'string', text: line.slice(i, end) });
      i = end;
      continue;
    }

    let end = i;
    while (end < line.length) {
      const c = line[end];
      if (c === '#' || c === '"' || (c === '/' && line[end + 1] === '/')) break;
      end += 1;
    }
    tokens.push({ kind: 'text', text: line.slice(i, end) });
    i = end;
  }
  return tokens;
}

const TOKEN_CLASS: Record<Token['kind'], string> = {
  text: '',
  comment: 'text-emerald-300/90 italic',
  string: 'text-amber-300',
};

function SnippetBlock({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <pre className="m-0 whitespace-pre">
      {lines.map((line, idx) => {
        const tokens = tokenizeLine(line);
        return (
          <span key={idx} className="block">
            {tokens.length === 0 ? (
              <span>&nbsp;</span>
            ) : (
              tokens.map((tok, j) => (
                <span key={j} className={TOKEN_CLASS[tok.kind]}>
                  {tok.text}
                </span>
              ))
            )}
          </span>
        );
      })}
    </pre>
  );
}
