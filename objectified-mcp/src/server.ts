import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

import { installApiKeyAuthOnInitialize } from './auth/install.js';
import type { CreateMcpServerAuth } from './auth/server-options.js';
import { getSharedSessionAuthCache } from './auth/global-cache.js';
import { resolveMcpKeyViaRest } from './auth/resolve.js';
import { packageVersion } from './package-info.js';
import type { ActionRegistry } from './registry/index.js';
import { registerPrimitiveTools } from './tools/index.js';
import type { RestClient } from './upstream/client.js';

export function createObjectifiedMcpServer(
  registry: ActionRegistry,
  upstream: RestClient,
  auth: CreateMcpServerAuth = { kind: 'none' },
): McpServer {
  const server = new McpServer(
    { name: 'objectified-mcp', version: packageVersion() },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
        logging: {},
      },
    },
  );

  registerPrimitiveTools(server, { registry, upstream });

  if (auth.kind === 'api_key') {
    const resolveInitialize =
      auth.resolveInitialize ??
      (() =>
        resolveMcpKeyViaRest(auth.getToken(), getSharedSessionAuthCache(), {
          restBaseUrl: upstream.baseUrl,
          internalSecret: process.env.OBJECTIFIED_INTERNAL_API_SECRET?.trim() ?? '',
        }));

    installApiKeyAuthOnInitialize(server, {
      resolveInitialize: async () => {
        try {
          return await resolveInitialize();
        } catch {
          throw new McpError(ErrorCode.InternalError, 'Unable to resolve MCP API key');
        }
      },
    });
  }

  return server;
}

export type { CreateMcpServerAuth } from './auth/server-options.js';
