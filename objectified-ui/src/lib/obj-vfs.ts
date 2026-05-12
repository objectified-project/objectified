/**
 * Developer Mode virtual filesystem (`obj://`).
 *
 * First binding: `obj://project/{projectId}/version/{versionId}/version-notes.json`
 * maps revision short message + changelog to `GET`/`PUT /api/versions/{versionId}` with
 * `If-Match` / `ETag` for conflict detection (#3345).
 */

export const DEFAULT_OBJ_VFS_DEBOUNCE_MS = 500;

const VERSION_NOTES_RE =
  /^obj:\/\/project\/([^/]+)\/version\/([^/]+)\/version-notes\.json$/i;

const VERSION_DIR_RE = /^obj:\/\/project\/([^/]+)\/version\/([^/]+)\/?$/i;

export type ObjVfsStat = {
  kind: 'file' | 'directory';
  size: number;
  mtimeMs: number;
  etag: string | null;
};

export type ObjListEntry = { name: string; kind: 'file' | 'directory' };

export type ObjVfsWriteOk = { ok: true; etag: string | null };

export type ObjVfsWriteConflict = {
  ok: false;
  kind: 'conflict';
  status: number;
  etag: string | null;
  serverNotesJson: string | null;
  localContent: string;
};

export type ObjVfsWriteResult = ObjVfsWriteOk | ObjVfsWriteConflict;

export type CreateObjVfsOptions = {
  debounceMs?: number;
  fetchImpl?: typeof fetch;
};

type CacheEntry = { content: string; etag: string | null; mtimeMs: number };

function normalizeObjUri(uri: string): string {
  const t = uri.trim();
  if (!t.toLowerCase().startsWith('obj://')) {
    throw new ObjVfsError(`Not an obj:// URI: ${uri}`);
  }
  return t;
}

export class ObjVfsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ObjVfsError';
  }
}

export function parseVersionNotesUri(uri: string): { projectId: string; versionId: string } | null {
  const t = uri.trim();
  if (!t.toLowerCase().startsWith('obj://')) return null;
  const m = t.match(VERSION_NOTES_RE);
  if (!m) return null;
  return { projectId: m[1], versionId: m[2] };
}

export function parseVersionDirectoryUri(uri: string): { projectId: string; versionId: string } | null {
  const raw = uri.trim();
  if (!raw.toLowerCase().startsWith('obj://')) return null;
  const withSlash = raw.endsWith('/') ? raw : `${raw}/`;
  const m = withSlash.match(VERSION_DIR_RE);
  if (!m) return null;
  return { projectId: m[1], versionId: m[2] };
}

function versionNotesJsonFromVersionBody(v: Record<string, unknown>): string {
  const short =
    (typeof v.shortMessage === 'string' ? v.shortMessage : null) ??
    (typeof v.description === 'string' ? v.description : null) ??
    '';
  const changelog =
    (typeof v.changelog === 'string' ? v.changelog : null) ??
    (typeof v.change_log === 'string' ? v.change_log : null) ??
    '';
  return `${JSON.stringify({ short_message: short, changelog }, null, 2)}\n`;
}

async function fetchVersionForNotes(
  fetchFn: typeof fetch,
  projectId: string,
  versionId: string,
): Promise<{ text: string; etag: string | null }> {
  const res = await fetchFn(
    `/api/versions/${encodeURIComponent(versionId)}?projectId=${encodeURIComponent(projectId)}`,
    { method: 'GET', cache: 'no-store' },
  );
  const etag = res.headers.get('ETag') ?? res.headers.get('etag');
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new ObjVfsError(err || `GET version failed (${res.status})`);
  }
  const json = (await res.json()) as { success?: boolean; version?: Record<string, unknown>; error?: string };
  if (!json.success || !json.version) {
    throw new ObjVfsError(json.error || 'Invalid version response');
  }
  return { text: versionNotesJsonFromVersionBody(json.version), etag };
}

export function createObjVfs(options?: CreateObjVfsOptions) {
  const debounceMs = options?.debounceMs ?? DEFAULT_OBJ_VFS_DEBOUNCE_MS;
  const fetchFn = options?.fetchImpl ?? fetch;

  const cache = new Map<string, CacheEntry>();
  const watchers = new Map<string, Set<() => void>>();
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  type Deferred = { resolve: (r: ObjVfsWriteResult) => void; reject: (e: unknown) => void };
  const pending = new Map<string, { content: string; deferreds: Deferred[] }>();

  function notify(uri: string) {
    const set = watchers.get(uri);
    if (!set) return;
    for (const fn of set) {
      try {
        fn();
      } catch {
        /* ignore subscriber errors */
      }
    }
  }

  function setCache(uri: string, content: string, etag: string | null) {
    cache.set(uri, { content, etag, mtimeMs: Date.now() });
    notify(uri);
  }

  function watch(uri: string, listener: () => void): () => void {
    const u = normalizeObjUri(uri);
    let set = watchers.get(u);
    if (!set) {
      set = new Set();
      watchers.set(u, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
      if (set!.size === 0) watchers.delete(u);
    };
  }

  function invalidate(uri: string) {
    cache.delete(normalizeObjUri(uri));
    notify(normalizeObjUri(uri));
  }

  async function readFile(uri: string): Promise<string> {
    const u = normalizeObjUri(uri);
    const parsed = parseVersionNotesUri(u);
    if (!parsed) {
      throw new ObjVfsError(`Unsupported obj:// path: ${u}`);
    }
    const { text, etag } = await fetchVersionForNotes(fetchFn, parsed.projectId, parsed.versionId);
    setCache(u, text, etag);
    return text;
  }

  async function stat(uri: string): Promise<ObjVfsStat> {
    const u = normalizeObjUri(uri);
    if (parseVersionDirectoryUri(u)) {
      return { kind: 'directory', size: 0, mtimeMs: Date.now(), etag: null };
    }
    const hit = cache.get(u);
    if (hit && parseVersionNotesUri(u)) {
      return { kind: 'file', size: hit.content.length, mtimeMs: hit.mtimeMs, etag: hit.etag };
    }
    const text = await readFile(u);
    const again = cache.get(u);
    return {
      kind: 'file',
      size: text.length,
      mtimeMs: again?.mtimeMs ?? Date.now(),
      etag: again?.etag ?? null,
    };
  }

  async function list(uri: string): Promise<ObjListEntry[]> {
    const u = normalizeObjUri(uri);
    const dir = parseVersionDirectoryUri(u);
    if (dir) {
      return [{ name: 'version-notes.json', kind: 'file' }];
    }
    throw new ObjVfsError(`Not a directory: ${u}`);
  }

  async function flushVersionNotes(
    projectId: string,
    versionId: string,
    content: string,
    ifMatch: string | null,
  ): Promise<ObjVfsWriteResult> {
    let body: { short_message?: string | null; changelog?: string | null };
    try {
      body = JSON.parse(content) as { short_message?: string | null; changelog?: string | null };
    } catch {
      throw new ObjVfsError('version-notes.json must be valid JSON');
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (ifMatch) headers['If-Match'] = ifMatch;

    const res = await fetchFn(`/api/versions/${encodeURIComponent(versionId)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        projectId,
        short_message: body.short_message ?? null,
        changelog: body.changelog ?? null,
      }),
    });

    const etagOut = res.headers.get('ETag') ?? res.headers.get('etag');

    if (res.status === 412) {
      let serverNotesJson: string | null = null;
      const conflictUri = `obj://project/${projectId}/version/${versionId}/version-notes.json`;
      try {
        const fresh = await fetchVersionForNotes(fetchFn, projectId, versionId);
        serverNotesJson = fresh.text;
        setCache(conflictUri, fresh.text, fresh.etag);
      } catch {
        serverNotesJson = null;
        if (etagOut) {
          const existing = cache.get(conflictUri);
          if (existing) {
            cache.set(conflictUri, { ...existing, etag: etagOut });
          }
        }
      }
      const localContent = content;
      return {
        ok: false,
        kind: 'conflict',
        status: 412,
        etag: etagOut,
        serverNotesJson,
        localContent,
      };
    }

    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new ObjVfsError(j?.error || `PUT version failed (${res.status})`);
    }

    const json = (await res.json()) as {
      success?: boolean;
      version?: Record<string, unknown>;
      error?: string;
    };
    if (!json.success || !json.version) {
      throw new ObjVfsError(json.error || 'PUT returned unexpected response');
    }
    const v = json.version;
    const nextText = v ? versionNotesJsonFromVersionBody(v) : content;
    const uri = `obj://project/${projectId}/version/${versionId}/version-notes.json`;
    setCache(uri, nextText, etagOut);
    return { ok: true, etag: etagOut };
  }

  function flushDebouncedKey(key: string) {
    debounceTimers.delete(key);
    const slot = pending.get(key);
    if (!slot) return;
    pending.delete(key);
    const parsed = parseVersionNotesUri(key);
    if (!parsed) {
      for (const d of slot.deferreds) {
        d.reject(new ObjVfsError('Invalid pending virtual URI'));
      }
      return;
    }
    const cached = cache.get(key);
    const ifMatch = cached?.etag ?? null;
    void flushVersionNotes(parsed.projectId, parsed.versionId, slot.content, ifMatch).then(
      (result) => {
        for (const d of slot.deferreds) d.resolve(result);
      },
      (err: unknown) => {
        for (const d of slot.deferreds) d.reject(err);
      },
    );
  }

  function writeFile(
    uri: string,
    content: string,
    opts?: { skipDebounce?: boolean },
  ): Promise<ObjVfsWriteResult> {
    const u = normalizeObjUri(uri);
    if (!parseVersionNotesUri(u)) {
      return Promise.reject(new ObjVfsError(`Unsupported obj:// path: ${u}`));
    }

    if (opts?.skipDebounce) {
      const parsed = parseVersionNotesUri(u)!;
      const cached = cache.get(u);
      return flushVersionNotes(parsed.projectId, parsed.versionId, content, cached?.etag ?? null);
    }

    return new Promise((resolve, reject) => {
      const prev = pending.get(u);
      if (prev) {
        prev.content = content;
        prev.deferreds.push({ resolve, reject });
      } else {
        pending.set(u, { content, deferreds: [{ resolve, reject }] });
      }
      const t = debounceTimers.get(u);
      if (t) clearTimeout(t);
      debounceTimers.set(
        u,
        setTimeout(() => flushDebouncedKey(u), debounceMs),
      );
    });
  }

  return {
    readFile,
    writeFile,
    stat,
    watch,
    list,
    invalidate,
  };
}

export type ObjVfs = ReturnType<typeof createObjVfs>;
