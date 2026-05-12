import {
  createObjVfs,
  DEFAULT_OBJ_VFS_DEBOUNCE_MS,
  parseVersionDirectoryUri,
  parseVersionNotesUri,
} from '@/lib/obj-vfs';

function mockJsonResponse(
  body: unknown,
  status: number,
  etag: string | null = null,
): {
  ok: boolean;
  status: number;
  headers: { get: (n: string) => string | null };
  json: () => Promise<unknown>;
  text: () => Promise<string>;
} {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name: string) {
        if (name.toLowerCase() === 'etag') return etag;
        return null;
      },
    },
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

describe('obj-vfs URI helpers', () => {
  it('parses version-notes path', () => {
    expect(parseVersionNotesUri('obj://project/p1/version/v1/version-notes.json')).toEqual({
      projectId: 'p1',
      versionId: 'v1',
    });
    expect(parseVersionNotesUri('not-obj://x')).toBeNull();
    expect(parseVersionNotesUri('obj://project/p1/other')).toBeNull();
  });

  it('parses version directory for list()', () => {
    expect(parseVersionDirectoryUri('obj://project/p1/version/v1')).toEqual({
      projectId: 'p1',
      versionId: 'v1',
    });
    expect(parseVersionDirectoryUri('obj://project/p1/version/v1/')).toEqual({
      projectId: 'p1',
      versionId: 'v1',
    });
    expect(parseVersionDirectoryUri('http://x')).toBeNull();
  });
});

describe('createObjVfs', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounces and coalesces writes per URI', async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const fetchImpl = jest.fn(async (url: string | URL, init?: RequestInit) => {
      const u = typeof url === 'string' ? url : url.toString();
      calls.push({ url: u, method: init?.method ?? 'GET' });
      if (u.includes('?projectId=') && (init?.method ?? 'GET') === 'GET') {
        return mockJsonResponse(
          {
            success: true,
            version: {
              id: 'rev-a',
              shortMessage: 's0',
              changelog: 'c0',
            },
          },
          200,
          '"rev-a"',
        );
      }
      if (u.startsWith('/api/versions/rev-a') && init?.method === 'PUT') {
        return mockJsonResponse(
          {
            success: true,
            version: {
              id: 'rev-a',
              shortMessage: 'final',
              changelog: 'c0',
            },
          },
          200,
          '"rev-a"',
        );
      }
      return mockJsonResponse({ error: 'nf' }, 404);
    });

    const vfs = createObjVfs({ debounceMs: DEFAULT_OBJ_VFS_DEBOUNCE_MS, fetchImpl });
    const uri = 'obj://project/p1/version/rev-a/version-notes.json';

    await vfs.readFile(uri);

    const p1 = vfs.writeFile(uri, JSON.stringify({ short_message: 'a', changelog: '' }));
    const p2 = vfs.writeFile(uri, JSON.stringify({ short_message: 'final', changelog: '' }));

    expect(fetchImpl).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(DEFAULT_OBJ_VFS_DEBOUNCE_MS);
    await Promise.resolve();
    await Promise.resolve();

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.ok && r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      expect(r1.etag).toBe('"rev-a"');
      expect(r2.etag).toBe('"rev-a"');
    }

    const putCalls = calls.filter((c) => c.method === 'PUT');
    expect(putCalls).toHaveLength(1);
    const putInit = fetchImpl.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'PUT')?.[1] as
      | RequestInit
      | undefined;
    expect(putInit?.body).toBeDefined();
    const putBody = JSON.parse(putInit!.body as string);
    expect(putBody.short_message).toBe('final');
  });

  it('returns conflict when PUT is 412', async () => {
    const fetchImpl = jest.fn(async (url: string | URL, init?: RequestInit) => {
      const u = typeof url === 'string' ? url : url.toString();
      if (u.includes('?projectId=') && (init?.method ?? 'GET') === 'GET') {
        return mockJsonResponse(
          {
            success: true,
            version: { id: 'rev-a', shortMessage: 'server', changelog: '' },
          },
          200,
          '"rev-a"',
        );
      }
      if (u.startsWith('/api/versions/rev-a') && init?.method === 'PUT') {
        return mockJsonResponse({ success: false, error: 'conflict' }, 412, '"rev-a"');
      }
      return mockJsonResponse({ error: 'nf' }, 404);
    });

    const vfs = createObjVfs({ fetchImpl });
    const uri = 'obj://project/p1/version/rev-a/version-notes.json';
    await vfs.readFile(uri);

    const result = await vfs.writeFile(uri, JSON.stringify({ short_message: 'mine', changelog: '' }), {
      skipDebounce: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('conflict');
      expect(result.serverNotesJson).toContain('server');
    }
  });
});
