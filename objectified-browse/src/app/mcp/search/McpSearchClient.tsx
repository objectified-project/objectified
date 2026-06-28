'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { sanitizeSearchInput } from '../../utils/searchValidation';
import { MCP_SORT_LABELS, type McpSortMode } from '../../../../lib/mcpSort';
import type { McpPublicSearchHit } from '../../../../lib/types';
import { GradeBadge } from '../McpShared';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function HighlightMatches({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q || !text) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="rounded-sm bg-indigo-500/20 px-0.5 text-inherit dark:bg-indigo-400/35">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

/**
 * Public MCP capability search (MCAT-9.7). Ordering is computed server-side in SQL, so the query box
 * and the Sort control both drive navigation: submitting a query lands relevance-first (the default
 * while searching), and the Sort control lets the user pin "Top graded" (grade-led) instead. The
 * control reflects the active mode; both are carried in the URL so SSR and the control agree.
 */
export function McpSearchClient({
  initialQuery,
  initialSort,
  initialResults,
}: {
  initialQuery: string;
  initialSort: McpSortMode;
  initialResults: McpPublicSearchHit[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const navigate = (q: string, sort: McpSortMode | null) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const params = new URLSearchParams({ q: trimmed });
    if (sort) params.set('sort', sort);
    router.push(`/mcp/search?${params.toString()}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // A fresh query resets to the query-default mode (relevance): omit the sort param.
    navigate(query, null);
  };

  const handleSortChange = (mode: McpSortMode) => {
    navigate(initialQuery, mode);
  };

  return (
    <AppShell containerSize="wide">
      <header className="border-b border-zinc-200 bg-white py-6 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-3 text-[13px] text-zinc-500 dark:text-zinc-400">
          Search published public MCP servers only — private servers never appear here.
        </p>
        <form onSubmit={handleSearch} className="relative">
          <svg
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            name="q"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(sanitizeSearchInput(e.target.value))}
            placeholder="Search tools, resources, and prompts…"
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-3.5 pl-12 pr-28 text-[15px] text-zinc-900 placeholder-zinc-400 shadow-xs transition-colors focus-visible:border-[var(--brand)] focus-visible:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500"
            autoFocus
          />
          <button
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--brand-hover)]"
          >
            Search
          </button>
        </form>
      </header>

      <div className="py-6">
        {!initialQuery ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white/50 p-10 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Search the MCP catalog</h2>
            <p className="mx-auto mt-2 max-w-lg text-[14px] text-zinc-600 dark:text-zinc-400">
              Match tool, resource, and prompt names and descriptions across every published public
              server. Or{' '}
              <Link href="/mcp" className="font-medium text-indigo-600 dark:text-indigo-400">
                browse by site
              </Link>
              .
            </p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {initialResults.length} result{initialResults.length === 1 ? '' : 's'}
                </span>
                <span className="text-zinc-400"> for </span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400">
                  &ldquo;{initialQuery}&rdquo;
                </span>
              </p>
              <div className="flex items-center gap-2">
                <label htmlFor="mcp-sort" className="text-[11px] text-zinc-500">
                  Sort
                </label>
                <select
                  id="mcp-sort"
                  value={initialSort}
                  onChange={(e) => handleSortChange(e.target.value as McpSortMode)}
                  className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800 shadow-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  <option value="relevance">{MCP_SORT_LABELS.relevance}</option>
                  <option value="top_graded">{MCP_SORT_LABELS.top_graded}</option>
                </select>
              </div>
            </div>

            {initialResults.length === 0 ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-zinc-600 dark:text-zinc-400">
                  No public capabilities match{' '}
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    &ldquo;{initialQuery}&rdquo;
                  </span>
                  .
                </p>
                <Link href="/mcp" className="mt-4 inline-block text-sm font-medium text-indigo-600 dark:text-indigo-400">
                  Browse the catalog
                </Link>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {initialResults.map((hit) => (
                  <li key={`${hit.item_id}`}>
                    <Link
                      href={`/mcp/${hit.tenant_slug}/${hit.endpoint_slug}`}
                      className="block rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700"
                    >
                      <div className="flex items-start gap-3">
                        <GradeBadge grade={hit.grade} score={hit.score} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                            <span className="truncate">
                              {hit.endpoint_name} · {hit.host ?? 'Unknown host'}
                            </span>
                            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                              {hit.item_type.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <h3 className="mt-1 font-mono text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
                            <HighlightMatches text={hit.item_title || hit.item_name} query={initialQuery} />
                          </h3>
                          {hit.description ? (
                            <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-300">
                              <HighlightMatches text={hit.description} query={initialQuery} />
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
