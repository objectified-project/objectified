import { parseArgs } from 'node:util';

import { DEFAULT_HTTP_PORT, listenHttpTransport } from './transports/http.js';
import { runStdioTransport } from './transports/stdio.js';
import { ActionRegistry } from './registry/index.js';
import { RestClient } from './upstream/client.js';

function parsePort(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0 || n > 65535) return fallback;
  return n;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      transport: {
        type: 'string',
      },
    },
    strict: true,
    allowPositionals: false,
  });

  const transport = values.transport ?? process.env.OBJECTIFIED_MCP_TRANSPORT ?? 'stdio';

  if (transport !== 'stdio' && transport !== 'http') {
    console.error(
      `Transport "${transport}" is invalid. Use --transport stdio|http or OBJECTIFIED_MCP_TRANSPORT.`,
    );
    process.exitCode = 2;
    return;
  }

  const registry = ActionRegistry.instance();
  const upstream = RestClient.fromEnv();

  if (transport === 'stdio') {
    await runStdioTransport({ registry, upstream });
    return;
  }

  const port = parsePort(process.env.OBJECTIFIED_MCP_PORT, DEFAULT_HTTP_PORT);
  const host = process.env.OBJECTIFIED_MCP_HOST ?? '0.0.0.0';
  const http = await listenHttpTransport({ registry, upstream, port, host });

  await new Promise<void>((resolve) => {
    const stop = (): void => {
      void http.close().finally(() => resolve());
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
}

await main();
