import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ToolSchema } from '@modelcontextprotocol/sdk/types.js';

import { ActionRegistry } from '../src/registry/index.js';
import { createObjectifiedMcpServer } from '../src/server.js';
import { listenHttpTransport } from '../src/transports/http.js';
import { RestClient } from '../src/upstream/client.js';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('objectified-mcp server bootstrap', () => {
  it('handshakes over in-memory transport and reports serverInfo + capabilities', async (t) => {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const registry = ActionRegistry.instance();
    const upstream = RestClient.withBaseUrl('http://127.0.0.1:8000');
    const server = createObjectifiedMcpServer(registry, upstream);

    const client = new Client({ name: 'test-harness', version: '0.0.0' }, { capabilities: {} });

    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);

    t.after(async () => {
      await client.close();
      await server.close();
    });

    const version = client.getServerVersion();
    assert.ok(version);
    assert.equal(version?.name, 'objectified-mcp');
    assert.ok(version?.version && version.version.length > 0);

    const caps = client.getServerCapabilities();
    assert.ok(caps?.tools);
    assert.ok(caps?.resources);
    assert.ok(caps?.prompts);
    assert.ok(caps?.logging);
  });

  it('exposes the three primitive tools with Tool-shaped JSON schemas', async (t) => {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const registry = ActionRegistry.instance();
    const upstream = RestClient.withBaseUrl('http://127.0.0.1:8000');
    const server = createObjectifiedMcpServer(registry, upstream);
    const client = new Client({ name: 'test-harness', version: '0.0.0' }, { capabilities: {} });

    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);

    t.after(async () => {
      await client.close();
      await server.close();
    });

    const { tools } = await client.listTools();
    assert.equal(tools.length, 3);

    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, ['mcp.describe', 'mcp.execute', 'mcp.search']);

    for (const tool of tools) {
      const parsed = ToolSchema.safeParse(tool);
      assert.ok(parsed.success, JSON.stringify(parsed.error?.format(), null, 2));
    }
  });

  it('closes cleanly after lifecycle', async () => {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const registry = ActionRegistry.instance();
    const upstream = RestClient.withBaseUrl('http://127.0.0.1:8000');
    const server = createObjectifiedMcpServer(registry, upstream);
    const client = new Client({ name: 'test-harness', version: '0.0.0' }, { capabilities: {} });

    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
    await client.close();
    await server.close();

    assert.equal(server.isConnected(), false);
  });
});

describe('objectified-mcp transports (integration)', () => {
  it('lists tools over Streamable HTTP', async (t) => {
    const registry = ActionRegistry.instance();
    const upstream = RestClient.withBaseUrl('http://127.0.0.1:8000');
    const http = await listenHttpTransport({ registry, upstream, port: 0, host: '127.0.0.1' });

    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${http.port}/mcp`),
    );
    const client = new Client({ name: 'test-harness', version: '0.0.0' }, { capabilities: {} });
    await client.connect(transport);

    t.after(async () => {
      await client.close();
      await http.close();
    });

    const { tools } = await client.listTools();
    assert.equal(tools.length, 3);
    const names = tools.map((x) => x.name).sort();
    assert.deepEqual(names, ['mcp.describe', 'mcp.execute', 'mcp.search']);
  });

  it('sets Cache-Control: no-store on HTTP responses', async (t) => {
    const registry = ActionRegistry.instance();
    const upstream = RestClient.withBaseUrl('http://127.0.0.1:8000');
    const http = await listenHttpTransport({ registry, upstream, port: 0, host: '127.0.0.1' });
    t.after(async () => {
      await http.close();
    });

    const res = await fetch(`http://127.0.0.1:${http.port}/mcp`, { method: 'GET' });
    assert.equal(res.headers.get('cache-control'), 'no-store');
  });

  it('lists tools over stdio via subprocess transport', async (t) => {
    const bin = join(pkgRoot, 'bin', 'objectified-mcp.js');
    const transport = new StdioClientTransport({
      command: 'node',
      args: [bin, '--transport', 'stdio'],
      cwd: pkgRoot,
      stderr: 'pipe',
    });
    const client = new Client({ name: 'test-harness', version: '0.0.0' }, { capabilities: {} });
    await client.connect(transport);

    t.after(async () => {
      await client.close();
    });

    const { tools } = await client.listTools();
    assert.equal(tools.length, 3);
    const names = tools.map((x) => x.name).sort();
    assert.deepEqual(names, ['mcp.describe', 'mcp.execute', 'mcp.search']);
  });

  it('exits stdio mode after idle when OBJECTIFIED_MCP_STDIO_IDLE_MS is set', async () => {
    const bin = join(pkgRoot, 'bin', 'objectified-mcp.js');
    const child = spawn('node', [bin, '--transport', 'stdio'], {
      cwd: pkgRoot,
      env: { ...process.env, OBJECTIFIED_MCP_STDIO_IDLE_MS: '150' },
      stdio: ['ignore', 'ignore', 'ignore'],
    });

    const code = await Promise.race([
      new Promise<number>((resolve, reject) => {
        child.on('error', reject);
        child.on('exit', (c) => resolve(c ?? 1));
      }),
      new Promise<number>((_, reject) =>
        setTimeout(() => reject(new Error('stdio idle timeout')), 5000),
      ),
    ]);

    assert.equal(code, 0);
  });
});
