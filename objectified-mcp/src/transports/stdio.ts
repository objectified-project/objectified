import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import type { ActionRegistry } from '../registry/index.js';
import { createObjectifiedMcpServer } from '../server.js';
import { resolveApiKeyFromEnv } from '../upstream/auth.js';
import type { RestClient } from '../upstream/client.js';

const DEFAULT_IDLE_MS = 5 * 60 * 1000;

function parsePositiveMs(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

export async function runStdioTransport(deps: {
  registry: ActionRegistry;
  upstream: RestClient;
  /** Skip MCP API-key gate (tests / local wiring only). */
  anonymous?: boolean;
}): Promise<void> {
  const idleMs = parsePositiveMs(process.env.OBJECTIFIED_MCP_STDIO_IDLE_MS, DEFAULT_IDLE_MS);
  const server = createObjectifiedMcpServer(
    deps.registry,
    deps.upstream,
    deps.anonymous ? { kind: 'none' } : { kind: 'api_key', getToken: () => resolveApiKeyFromEnv() },
  );
  const transport = new StdioServerTransport();

  let idleTimer: NodeJS.Timeout | undefined;

  const cleanupWatchers = (): void => {
    process.stdin.off('data', onStdinData);
    if (idleTimer !== undefined) clearTimeout(idleTimer);
  };

  const armIdleTimer = (): void => {
    if (idleTimer !== undefined) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      cleanupWatchers();
      void server.close().finally(() => {
        process.exitCode = 0;
        process.exit(0);
      });
    }, idleMs);
  };

  function onStdinData(): void {
    armIdleTimer();
  }

  transport.onclose = () => {
    cleanupWatchers();
  };

  process.stdin.on('data', onStdinData);
  armIdleTimer();

  await server.connect(transport);
}
