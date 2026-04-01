/**
 * Browser-local quick canvas layout snapshots per version (#168).
 * Stored in localStorage for fast capture without naming or server round-trips.
 */

export const QUICK_LAYOUT_SNAPSHOTS_SCHEMA_VERSION = 1 as const;

export const DEFAULT_MAX_QUICK_LAYOUT_SNAPSHOTS = 20;

export interface QuickLayoutSnapshotPayload {
  schemaVersion: typeof QUICK_LAYOUT_SNAPSHOTS_SCHEMA_VERSION;
  viewport: { x: number; y: number; zoom: number };
  nodes: unknown[];
  edges: unknown[];
  groups: unknown[];
}

export interface QuickLayoutSnapshot {
  id: string;
  createdAt: string;
  /** PNG data URL for preview; omitted if capture failed or was too large. */
  thumbnailDataUrl?: string;
  payload: QuickLayoutSnapshotPayload;
}

export function quickLayoutSnapshotsStorageKey(versionId: string, userId: string | null): string {
  const uid = userId && userId.trim() ? userId.trim() : 'anonymous';
  return `objectified.quickCanvasSnapshots.v${QUICK_LAYOUT_SNAPSHOTS_SCHEMA_VERSION}:${versionId}:${uid}`;
}

function isViewport(v: unknown): v is { x: number; y: number; zoom: number } {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.x === 'number' &&
    Number.isFinite(o.x) &&
    typeof o.y === 'number' &&
    Number.isFinite(o.y) &&
    typeof o.zoom === 'number' &&
    Number.isFinite(o.zoom)
  );
}

export function isQuickLayoutSnapshot(raw: unknown): raw is QuickLayoutSnapshot {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id.trim()) return false;
  if (typeof o.createdAt !== 'string' || !o.createdAt.trim()) return false;
  const payload = o.payload;
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  if (p.schemaVersion !== QUICK_LAYOUT_SNAPSHOTS_SCHEMA_VERSION) return false;
  if (!isViewport(p.viewport)) return false;
  if (!Array.isArray(p.nodes) || !Array.isArray(p.edges) || !Array.isArray(p.groups)) return false;
  if (o.thumbnailDataUrl !== undefined) {
    if (typeof o.thumbnailDataUrl !== 'string') return false;
    if (!o.thumbnailDataUrl.startsWith('data:image/png;base64,')) return false;
  }
  return true;
}

export function loadQuickLayoutSnapshots(versionId: string, userId: string | null): QuickLayoutSnapshot[] {
  if (typeof window === 'undefined') return [];
  if (!versionId || !versionId.trim()) return [];
  try {
    const raw = window.localStorage.getItem(quickLayoutSnapshotsStorageKey(versionId, userId));
    if (!raw || !raw.trim()) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isQuickLayoutSnapshot);
  } catch {
    return [];
  }
}

function persistQuickLayoutSnapshots(
  versionId: string,
  userId: string | null,
  list: QuickLayoutSnapshot[]
): boolean {
  if (typeof window === 'undefined') return false;
  if (!versionId || !versionId.trim()) return false;
  const key = quickLayoutSnapshotsStorageKey(versionId, userId);
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
    return true;
  } catch {
    // Quota likely exceeded; retry with thumbnails stripped to reduce payload size.
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const stripped = list.map(({ thumbnailDataUrl: _t, ...rest }) => rest);
      window.localStorage.setItem(key, JSON.stringify(stripped));
      return true;
    } catch (e) {
      console.warn('quick layout snapshots: failed to persist', e);
      return false;
    }
  }
}

/**
 * Prepend a snapshot and cap list length.
 * Returns the in-memory list together with a `persisted` flag indicating
 * whether the write to localStorage succeeded.
 */
export function appendQuickLayoutSnapshot(
  versionId: string,
  userId: string | null,
  snapshot: QuickLayoutSnapshot,
  options?: { maxSnapshots?: number }
): { snapshots: QuickLayoutSnapshot[]; persisted: boolean } {
  const max = options?.maxSnapshots ?? DEFAULT_MAX_QUICK_LAYOUT_SNAPSHOTS;
  const existing = loadQuickLayoutSnapshots(versionId, userId);
  const next = [snapshot, ...existing].slice(0, max);
  const persisted = persistQuickLayoutSnapshots(versionId, userId, next);
  return { snapshots: next, persisted };
}

export function makeQuickLayoutSnapshotId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `qs-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
