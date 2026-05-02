import { SessionAuthCache } from './session-cache.js';

let cache = new SessionAuthCache();

export function getSharedSessionAuthCache(): SessionAuthCache {
  return cache;
}

/** Test helper: swap the process-wide cache instance. */
export function resetSharedSessionAuthCacheForTests(): SessionAuthCache {
  cache = new SessionAuthCache();
  return cache;
}
