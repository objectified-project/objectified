import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Implementation, InitializeRequest, InitializeResult } from '@modelcontextprotocol/sdk/types.js';
import {
  InitializeRequestSchema,
  LATEST_PROTOCOL_VERSION,
  McpError,
  SUPPORTED_PROTOCOL_VERSIONS,
} from '@modelcontextprotocol/sdk/types.js';

import type { McpResolveOutcome } from './types.js';

/** Narrow surface we touch on the SDK Server (initialize hook). */
type SdkServerInitializeHook = {
  setRequestHandler: (
    schema: typeof InitializeRequestSchema,
    handler: (request: InitializeRequest) => Promise<InitializeResult>,
  ) => void;
  getCapabilities: () => Record<string, unknown>;
  _serverInfo: Implementation;
  _instructions?: string;
  _clientCapabilities?: unknown;
  _clientVersion?: unknown;
};

/**
 * Replace the default initialize handler so MCP sessions must pass API-key auth first (#2824).
 * Uses JSON-RPC code -32001 with `{ reason }` per MCP-1.3 acceptance criteria.
 */
export function installApiKeyAuthOnInitialize(
  server: McpServer,
  deps: {
    resolveInitialize: () => Promise<McpResolveOutcome>;
  },
): void {
  const inner = server.server as unknown as SdkServerInitializeHook;

  inner.setRequestHandler(InitializeRequestSchema, async (request: InitializeRequest) => {
    const outcome = await deps.resolveInitialize();
    if (!outcome.ok) {
      throw new McpError(-32001, 'Unauthorized', { reason: outcome.reason });
    }

    const requestedVersion = request.params.protocolVersion;
    inner._clientCapabilities = request.params.capabilities;
    inner._clientVersion = request.params.clientInfo;
    const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion)
      ? requestedVersion
      : LATEST_PROTOCOL_VERSION;

    const payload: InitializeResult = {
      protocolVersion,
      capabilities: inner.getCapabilities(),
      serverInfo: inner._serverInfo,
    };
    if (inner._instructions) {
      payload.instructions = inner._instructions;
    }
    return payload;
  });
}
