import {
  appendQuickLayoutSnapshot,
  loadQuickLayoutSnapshots,
  quickLayoutSnapshotsStorageKey,
  isQuickLayoutSnapshot,
  DEFAULT_MAX_QUICK_LAYOUT_SNAPSHOTS,
  type QuickLayoutSnapshot,
} from '@/app/ade/studio/editor/lib/quick-layout-snapshots';

const samplePayload = {
  schemaVersion: 1 as const,
  viewport: { x: 0, y: 0, zoom: 1 },
  nodes: [],
  edges: [],
  groups: [],
};

function makeSnapshot(id: string, createdAt: string): QuickLayoutSnapshot {
  return {
    id,
    createdAt,
    thumbnailDataUrl: 'data:image/png;base64,AA==',
    payload: { ...samplePayload },
  };
}

describe('quick-layout-snapshots', () => {
  const versionId = 'ver-quick-snap-1';
  const userId = 'user-42';

  beforeEach(() => {
    localStorage.clear();
  });

  it('builds a stable storage key including version and user', () => {
    expect(quickLayoutSnapshotsStorageKey(versionId, userId)).toBe(
      `objectified.quickCanvasSnapshots.v1:${versionId}:${userId}`
    );
  });

  it('uses anonymous bucket when userId is null', () => {
    expect(quickLayoutSnapshotsStorageKey(versionId, null)).toContain('anonymous');
  });

  it('round-trips snapshots through localStorage', () => {
    const s = makeSnapshot('a', new Date().toISOString());
    appendQuickLayoutSnapshot(versionId, userId, s);
    const loaded = loadQuickLayoutSnapshots(versionId, userId);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('a');
    expect(loaded[0].payload.viewport.zoom).toBe(1);
  });

  it('prepends newest snapshots', () => {
    const first = makeSnapshot('first', '2026-01-01T00:00:00.000Z');
    const second = makeSnapshot('second', '2026-01-02T00:00:00.000Z');
    appendQuickLayoutSnapshot(versionId, userId, first);
    appendQuickLayoutSnapshot(versionId, userId, second);
    const loaded = loadQuickLayoutSnapshots(versionId, userId);
    expect(loaded.map((x) => x.id)).toEqual(['second', 'first']);
  });

  it('caps snapshot count', () => {
    const max = DEFAULT_MAX_QUICK_LAYOUT_SNAPSHOTS;
    for (let i = 0; i < max + 5; i += 1) {
      appendQuickLayoutSnapshot(versionId, userId, makeSnapshot(`id-${i}`, `2026-01-01T00:00:0${i}.000Z`), {
        maxSnapshots: max,
      });
    }
    expect(loadQuickLayoutSnapshots(versionId, userId)).toHaveLength(max);
    expect(loadQuickLayoutSnapshots(versionId, userId)[0].id).toBe(`id-${max + 4}`);
  });

  it('returns empty array for invalid JSON in storage', () => {
    localStorage.setItem(quickLayoutSnapshotsStorageKey(versionId, userId), 'not-json');
    expect(loadQuickLayoutSnapshots(versionId, userId)).toEqual([]);
  });

  it('filters out invalid snapshot entries', () => {
    const ok = makeSnapshot('ok', '2026-01-01T00:00:00.000Z');
    localStorage.setItem(
      quickLayoutSnapshotsStorageKey(versionId, userId),
      JSON.stringify([ok, { id: '', createdAt: 'x', payload: {} }])
    );
    expect(loadQuickLayoutSnapshots(versionId, userId)).toHaveLength(1);
    expect(loadQuickLayoutSnapshots(versionId, userId)[0].id).toBe('ok');
  });

  it('isQuickLayoutSnapshot rejects wrong schema version', () => {
    expect(
      isQuickLayoutSnapshot({
        id: '1',
        createdAt: '2026-01-01T00:00:00.000Z',
        payload: { schemaVersion: 0, viewport: { x: 0, y: 0, zoom: 1 }, nodes: [], edges: [], groups: [] },
      })
    ).toBe(false);
  });

  it('isQuickLayoutSnapshot accepts snapshot without thumbnail', () => {
    expect(
      isQuickLayoutSnapshot({
        id: '1',
        createdAt: '2026-01-01T00:00:00.000Z',
        payload: samplePayload,
      })
    ).toBe(true);
  });
});
