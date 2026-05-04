/**
 * In-memory LRU for identical Ollama chat requests (#524).
 * Exact-match only; semantic matching is #525, invalidation is #526.
 */

import { createHash } from 'crypto';

export type OllamaChatCacheEntry = {
  text: string;
  usage?: { promptTokens?: number; completionTokens?: number };
};

const DEFAULT_MAX_ENTRIES = 200;
const DEFAULT_MAX_TEXT_CHARS = 100_000;

function maxEntries(): number {
  const raw = process.env.OLLAMA_CHAT_CACHE_MAX_ENTRIES;
  if (!raw) return DEFAULT_MAX_ENTRIES;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 1_000) : DEFAULT_MAX_ENTRIES;
}

function maxTextChars(): number {
  const raw = process.env.OLLAMA_CHAT_CACHE_MAX_RESPONSE_CHARS;
  if (!raw) return DEFAULT_MAX_TEXT_CHARS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 500_000) : DEFAULT_MAX_TEXT_CHARS;
}

export function isOllamaQueryCacheDisabled(): boolean {
  const v = process.env.OLLAMA_CHAT_CACHE_DISABLED?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** Deterministic JSON for stable cache keys. */
export function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'string') return JSON.stringify(value);
  if (t === 'number' || t === 'boolean') return String(value);
  if (t !== 'object') return JSON.stringify(String(value));
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export type OllamaChatCacheKeyInput = {
  model: string;
  task?: string;
  existingClassNames?: unknown;
  existingProperties?: unknown;
  tableNames?: unknown;
  currentTableName?: unknown;
  messages: unknown;
};

export function ollamaChatCacheKey(input: OllamaChatCacheKeyInput): string {
  const payload = stableStringify({
    model: input.model.trim(),
    task: input.task ?? null,
    existingClassNames: input.existingClassNames ?? null,
    existingProperties: input.existingProperties ?? null,
    tableNames: input.tableNames ?? null,
    currentTableName: input.currentTableName ?? null,
    messages: input.messages,
  });
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

class LruMap {
  private readonly map = new Map<string, OllamaChatCacheEntry>();

  constructor(private readonly limit: number) {}

  get(key: string): OllamaChatCacheEntry | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    // Refresh insertion order so this key sorts as most-recently-used.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry;
  }

  set(key: string, value: OllamaChatCacheEntry): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.limit) {
      // The first key in a Map is the oldest (least-recently-used).
      this.map.delete(this.map.keys().next().value as string);
    }
    this.map.set(key, value);
  }
}

const globalStore = globalThis as typeof globalThis & {
  __ollamaChatQueryCache?: LruMap;
};

function getStore(): LruMap {
  if (!globalStore.__ollamaChatQueryCache) {
    globalStore.__ollamaChatQueryCache = new LruMap(maxEntries());
  }
  return globalStore.__ollamaChatQueryCache;
}

export function getCachedOllamaChatResponse(key: string): OllamaChatCacheEntry | undefined {
  if (isOllamaQueryCacheDisabled()) return undefined;
  return getStore().get(key);
}

export function setCachedOllamaChatResponse(key: string, entry: OllamaChatCacheEntry): void {
  if (isOllamaQueryCacheDisabled()) return;
  const text = entry.text.trim();
  if (text.length === 0) return;
  if (text.length > maxTextChars()) return;
  getStore().set(key, { ...entry, text });
}
