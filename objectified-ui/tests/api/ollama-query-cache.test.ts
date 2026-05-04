/**
 * Tests for Ollama chat exact-match query cache (#524).
 */

import {
  getCachedOllamaChatResponse,
  isOllamaQueryCacheDisabled,
  ollamaChatCacheKey,
  setCachedOllamaChatResponse,
  stableStringify,
} from '../../src/app/api/ollama/chat/query-cache';

describe('stableStringify', () => {
  it('orders object keys deterministically', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });

  it('handles nested objects and arrays', () => {
    expect(stableStringify({ z: [{ m: 1, n: 2 }], a: 0 })).toBe(
      stableStringify({ a: 0, z: [{ n: 2, m: 1 }] }),
    );
  });
});

describe('ollamaChatCacheKey', () => {
  it('ignores model string outer whitespace', () => {
    const inner = { messages: [{ role: 'user', content: 'Hi' }] };
    expect(ollamaChatCacheKey({ model: '  qwen  ', ...inner })).toBe(
      ollamaChatCacheKey({ model: 'qwen', ...inner }),
    );
  });

  it('changes when messages change', () => {
    const a = ollamaChatCacheKey({
      model: 'm',
      messages: [{ role: 'user', content: 'a' }],
    });
    const b = ollamaChatCacheKey({
      model: 'm',
      messages: [{ role: 'user', content: 'b' }],
    });
    expect(a).not.toBe(b);
  });
});

describe('LRU get/set', () => {
  const prevDisabled = process.env.OLLAMA_CHAT_CACHE_DISABLED;

  afterEach(() => {
    if (prevDisabled === undefined) delete process.env.OLLAMA_CHAT_CACHE_DISABLED;
    else process.env.OLLAMA_CHAT_CACHE_DISABLED = prevDisabled;
  });

  it('stores and returns a response for the same key', () => {
    const key = `524-store-${Math.random().toString(36).slice(2)}`;
    setCachedOllamaChatResponse(key, { text: 'hello', usage: { promptTokens: 1, completionTokens: 2 } });
    expect(getCachedOllamaChatResponse(key)).toEqual({
      text: 'hello',
      usage: { promptTokens: 1, completionTokens: 2 },
    });
  });

  it('does not store empty text', () => {
    const key = `524-empty-${Math.random().toString(36).slice(2)}`;
    setCachedOllamaChatResponse(key, { text: '   ' });
    expect(getCachedOllamaChatResponse(key)).toBeUndefined();
  });

  it('respects OLLAMA_CHAT_CACHE_DISABLED for reads and writes', () => {
    process.env.OLLAMA_CHAT_CACHE_DISABLED = '1';
    expect(isOllamaQueryCacheDisabled()).toBe(true);
    const key = `524-off-${Math.random().toString(36).slice(2)}`;
    setCachedOllamaChatResponse(key, { text: 'y' });
    expect(getCachedOllamaChatResponse(key)).toBeUndefined();
  });
});
