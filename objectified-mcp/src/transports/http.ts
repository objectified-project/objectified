import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Socket } from 'node:net';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

import { attachCacheControlNoStore } from './cache-control.js';
import type { ActionRegistry } from '../registry/index.js';
import { createObjectifiedMcpServer } from '../server.js';
import type { RestClient } from '../upstream/client.js';

export const DEFAULT_HTTP_PORT = 4040;

/** Maximum allowed request body size (1 MiB). Requests larger than this are rejected with 400. */
const MAX_BODY_BYTES = 1 * 1024 * 1024;

/** Represents a known HTTP error that should be reported to the client (not logged as internal). */
class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

type SessionEntry = {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
};

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    req.on('data', (c) => {
      const chunk = Buffer.isBuffer(c) ? c : Buffer.from(c);
      totalBytes += chunk.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve(undefined);
        return;
      }
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw) as unknown);
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function getSessionHeader(req: IncomingMessage): string | undefined {
  const raw = req.headers['mcp-session-id'];
  if (raw === undefined) return undefined;
  return Array.isArray(raw) ? raw[0] : raw;
}

export async function listenHttpTransport(options: {
  registry: ActionRegistry;
  upstream: RestClient;
  port: number;
  host?: string;
}): Promise<{ port: number; close: () => Promise<void> }> {
  const sessions = new Map<string, SessionEntry>();
  const host = options.host ?? '0.0.0.0';
  const openSockets = new Set<Socket>();

  const httpServer: Server = createServer(async (req, res) => {
    attachCacheControlNoStore(res);

    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/mcp') {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Not Found' }));
      return;
    }

    try {
      await dispatchMcpRequest(req, res, {
        registry: options.registry,
        upstream: options.upstream,
        sessions,
      });
    } catch (err) {
      if (!res.headersSent) {
        if (err instanceof HttpError) {
          sendJson(res, err.status, { error: err.message });
        } else {
          console.error('[objectified-mcp] unhandled request error:', err);
          sendJson(res, 500, { error: 'Internal Server Error' });
        }
      }
    }
  });

  httpServer.on('connection', (socket: Socket) => {
    openSockets.add(socket);
    socket.once('close', () => openSockets.delete(socket));
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(options.port, host, () => {
      httpServer.off('error', reject);
      resolve();
    });
  });

  const address = httpServer.address();
  const boundPort =
    address && typeof address === 'object' && 'port' in address ? address.port : options.port;

  return {
    port: boundPort,
    close: async () => {
      // Tear down all active MCP sessions before closing the server.
      // Setting transport.onclose to a no-op first breaks the recursive close loop:
      // server.close() → transport.close() → onclose → server.close() → ...
      const entries = Array.from(sessions.values());
      sessions.clear();
      await Promise.allSettled(
        entries.map(async ({ transport, server }) => {
          transport.onclose = () => {};
          try {
            await server.close();
          } catch (err) {
            console.error('[objectified-mcp] error closing MCP session:', err);
          }
        }),
      );
      // Destroy open sockets so httpServer.close() doesn't hang on keep-alive/SSE connections.
      for (const socket of openSockets) {
        socket.destroy();
      }
      await new Promise<void>((resolve, reject) => {
        httpServer.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}

async function dispatchMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: { registry: ActionRegistry; upstream: RestClient; sessions: Map<string, SessionEntry> },
): Promise<void> {
  const sessionId = getSessionHeader(req);

  if (sessionId !== undefined) {
    const entry = ctx.sessions.get(sessionId);
    if (!entry) {
      sendJson(res, 404, { error: 'Session not found' });
      return;
    }
    let parsedBody: unknown;
    try {
      parsedBody = req.method === 'POST' ? await readJsonBody(req) : undefined;
    } catch {
      throw new HttpError(400, 'Bad Request');
    }
    await entry.transport.handleRequest(req, res, parsedBody);
    return;
  }

  if (req.method === 'POST') {
    let parsedBody: unknown;
    try {
      parsedBody = await readJsonBody(req);
    } catch {
      throw new HttpError(400, 'Bad Request');
    }
    if (!isInitializeRequest(parsedBody)) {
      sendJson(res, 400, { error: 'Bad Request' });
      return;
    }

    const mcpServer = createObjectifiedMcpServer(ctx.registry, ctx.upstream);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        ctx.sessions.set(sid, { transport, server: mcpServer });
      },
    });

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) ctx.sessions.delete(sid);
      void mcpServer.close();
    };

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, parsedBody);
    return;
  }

  throw new HttpError(400, 'Bad Request');
}
