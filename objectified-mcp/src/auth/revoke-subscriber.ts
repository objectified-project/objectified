import type { SessionAuthCache } from './session-cache.js';

const CHANNEL = 'mcp.key.revoked';

export async function startMcpKeyRevokeSubscriber(cache: SessionAuthCache): Promise<() => Promise<void>> {
  const url = process.env.OBJECTIFIED_REDIS_URL?.trim();
  if (!url) {
    return async () => {};
  }

  const { createClient } = await import('redis');
  const client = createClient({ url });
  client.on('error', () => {});

  await client.connect();
  await client.subscribe(CHANNEL, (message: string) => {
    try {
      const parsed = JSON.parse(message) as { key_id?: string };
      if (parsed?.key_id) {
        cache.evictByKeyId(parsed.key_id);
      }
    } catch {
      /* ignore malformed payload */
    }
  });

  return async () => {
    try {
      await client.quit();
    } catch {
      /* ignore */
    }
  };
}
