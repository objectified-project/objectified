/**
 * Browser-local history of OpenAPI quality scores per project (#246).
 * Snapshots are appended when an import completes successfully (Import dialog).
 */

export type QualityLetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface ProjectQualitySnapshot {
  recordedAt: string;
  overall: number;
  grade: QualityLetterGrade;
  /** Dedupes Strict Mode / duplicate effect runs for the same import job */
  importJobId?: string;
}

interface StoreShape {
  byProject: Record<string, ProjectQualitySnapshot[]>;
}

const STORAGE_KEY = 'objectified:project-quality-history:v1';
const MAX_ENTRIES_PER_PROJECT = 120;

const MAX_APPENDED_IMPORT_JOB_IDS = 500;

/**
 * Prevents duplicate snapshots when import completion runs twice
 * (e.g. React Strict Mode), while avoiding unbounded growth for long-lived tabs.
 */
const appendedImportJobIds = (() => {
  const ids = new Set<string>();
  const order: string[] = [];

  return {
    has(id: string): boolean {
      return ids.has(id);
    },
    add(id: string): void {
      if (ids.has(id)) return;

      ids.add(id);
      order.push(id);

      if (order.length > MAX_APPENDED_IMPORT_JOB_IDS) {
        const oldestId = order.shift();
        if (oldestId) {
          ids.delete(oldestId);
        }
      }
    },
  };
})();

function loadStore(): StoreShape {
  if (typeof window === 'undefined') return { byProject: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { byProject: {} };
    const parsed = JSON.parse(raw) as StoreShape;
    if (!parsed || typeof parsed !== 'object' || !parsed.byProject || typeof parsed.byProject !== 'object') {
      return { byProject: {} };
    }
    return parsed;
  } catch {
    return { byProject: {} };
  }
}

function saveStore(store: StoreShape): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // quota or private mode
  }
}

function clampOverall(n: number): number {
  const safeValue = Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(100, Math.round(safeValue)));
}

/**
 * Append a snapshot for a project. Keeps entries ordered by `recordedAt` ascending.
 * Skips if the last entry for this project has the same `importJobId`.
 */
export function appendProjectQualitySnapshot(
  projectId: string,
  payload: {
    overall: number;
    grade: QualityLetterGrade;
    importJobId?: string;
    recordedAt?: string;
  }
): void {
  if (!projectId) return;

  if (payload.importJobId && appendedImportJobIds.has(payload.importJobId)) return;

  const store = loadStore();
  const prev = [...(store.byProject[projectId] ?? [])].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );

  if (payload.importJobId) {
    const last = prev[prev.length - 1];
    if (last?.importJobId === payload.importJobId) return;
  }

  if (payload.importJobId) appendedImportJobIds.add(payload.importJobId);

  const snap: ProjectQualitySnapshot = {
    recordedAt: payload.recordedAt ?? new Date().toISOString(),
    overall: clampOverall(payload.overall),
    grade: payload.grade,
    ...(payload.importJobId ? { importJobId: payload.importJobId } : {}),
  };

  const next = [...prev, snap];
  if (next.length > MAX_ENTRIES_PER_PROJECT) {
    next.splice(0, next.length - MAX_ENTRIES_PER_PROJECT);
  }

  store.byProject[projectId] = next;
  saveStore(store);
}

export function getProjectQualityHistory(projectId: string): ProjectQualitySnapshot[] {
  if (!projectId) return [];
  const store = loadStore();
  const list = store.byProject[projectId] ?? [];
  return [...list].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
}

/** Latest overall score if any history exists */
export function getLatestProjectQualityOverall(projectId: string): number | null {
  const h = getProjectQualityHistory(projectId);
  if (h.length === 0) return null;
  return h[h.length - 1].overall;
}

export interface SparklinePoint {
  x: number;
  y: number;
  overall: number;
}

/**
 * Normalized SVG coordinates (0–100 viewBox) for a polyline / area under the curve.
 */
export function buildQualityTrendPoints(overallValues: number[]): SparklinePoint[] {
  const vals = overallValues.map((v) => clampOverall(v));
  if (vals.length === 0) return [];
  if (vals.length === 1) {
    const y = 100 - vals[0];
    return [
      { x: 0, y, overall: vals[0] },
      { x: 100, y, overall: vals[0] },
    ];
  }
  const n = vals.length;
  return vals.map((overall, i) => ({
    x: (i / (n - 1)) * 100,
    y: 100 - overall,
    overall,
  }));
}

/** One point per import snapshot event across the portfolio (running average of latest score per project). */
export interface PortfolioQualityPoint {
  recordedAt: string;
  avgOverall: number;
}

/**
 * Merges per-project snapshot timelines chronologically. After each event, `avgOverall` is the
 * mean of each project's latest known score among projects that have at least one snapshot so far.
 */
export function buildPortfolioQualitySeries(
  historiesByProjectId: Record<string, ProjectQualitySnapshot[]>
): PortfolioQualityPoint[] {
  type Ev = { at: number; projectId: string; overall: number };
  const events: Ev[] = [];
  for (const [projectId, snaps] of Object.entries(historiesByProjectId)) {
    for (const s of snaps) {
      const at = new Date(s.recordedAt).getTime();
      if (!Number.isFinite(at)) continue;
      events.push({ at, projectId, overall: clampOverall(s.overall) });
    }
  }
  events.sort((a, b) => a.at - b.at);
  const latest = new Map<string, number>();
  const out: PortfolioQualityPoint[] = [];
  for (const e of events) {
    latest.set(e.projectId, e.overall);
    let sum = 0;
    for (const v of latest.values()) sum += v;
    const avgOverall = Math.round(sum / latest.size);
    out.push({ recordedAt: new Date(e.at).toISOString(), avgOverall });
  }
  return out;
}
