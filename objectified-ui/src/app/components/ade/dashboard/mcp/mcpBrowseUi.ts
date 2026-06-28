/**
 * Private MCP browse view — shared types & pure presentation helpers (V2-MCP-23.1 / MCAT-9.1).
 *
 * The browse list page and the endpoint detail page both consume the objectified-rest MCP
 * catalog API through the Next.js proxy routes under `/api/mcp/*`. This module holds the wire
 * types and the *pure* adapter/format helpers that turn those payloads into what the views
 * render — kept free of React so they can be unit-tested directly.
 */

/** Badge variants available from the shared UI Badge component. */
export type McpBadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'error' | 'outline';

/** One endpoint as returned by `GET /v1/mcp/{slug}/browse`. */
export interface McpBrowseEndpoint {
  id: string;
  name: string;
  slug: string;
  host: string;
  endpoint_url: string;
  transport: string;
  description: string | null;
  category: string | null;
  visibility: string;
  published: boolean;
  enabled: boolean;
  quarantined: boolean;
  last_discovered_at: string | null;
  last_discovery_status: string | null;
  current_version_id: string | null;
  score: number | null;
  grade: string | null;
  tool_count: number;
  resource_count: number;
  resource_template_count: number;
  prompt_count: number;
  capability_count: number;
}

/** A host bucket: every cataloged endpoint that shares one host. */
export interface McpBrowseHostGroup {
  host: string;
  endpoint_count: number;
  capability_count: number;
  endpoints: McpBrowseEndpoint[];
}

/** One normalized capability item (tool / resource / resource_template / prompt). */
export interface McpCapabilityItem {
  item_type: string;
  name: string;
  title: string | null;
  description: string | null;
  uri: string | null;
  uri_template: string | null;
}

/** A version snapshot's full surface as returned by the version-detail read. */
export interface McpVersionDetail {
  id: string;
  version_seq: number;
  version_tag: string | null;
  server_name: string | null;
  server_version: string | null;
  protocol_version: string | null;
  instructions: string | null;
  score: number | null;
  grade: string | null;
  is_current: boolean;
  discovered_at: string | null;
  items: McpCapabilityItem[];
}

/** An endpoint's catalog record as returned by the endpoint-detail read. */
export interface McpEndpointDetail {
  id: string;
  name: string;
  slug: string;
  endpoint_url: string;
  transport: string;
  description: string | null;
  category: string | null;
  visibility: string;
  published: boolean;
  enabled: boolean;
  current_version_id: string | null;
  last_discovered_at: string | null;
}

/** The display label and grouping order for each capability kind. */
export const MCP_CAPABILITY_KINDS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'tool', label: 'Tools' },
  { key: 'resource', label: 'Resources' },
  { key: 'resource_template', label: 'Resource templates' },
  { key: 'prompt', label: 'Prompts' },
];

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asInt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0;
}

function asScore(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : null;
}

/** Parse one browse-endpoint object defensively (missing/invalid fields fall back to safe defaults). */
export function mcpBrowseEndpointFromPayload(raw: unknown): McpBrowseEndpoint {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    slug: String(r.slug ?? ''),
    host: String(r.host ?? '(local)'),
    endpoint_url: String(r.endpoint_url ?? ''),
    transport: String(r.transport ?? ''),
    description: asString(r.description),
    category: asString(r.category),
    visibility: String(r.visibility ?? 'private'),
    published: r.published === true,
    enabled: r.enabled !== false,
    quarantined: r.quarantined === true,
    last_discovered_at: asString(r.last_discovered_at),
    last_discovery_status: asString(r.last_discovery_status),
    current_version_id: asString(r.current_version_id),
    score: asScore(r.score),
    grade: asString(r.grade),
    tool_count: asInt(r.tool_count),
    resource_count: asInt(r.resource_count),
    resource_template_count: asInt(r.resource_template_count),
    prompt_count: asInt(r.prompt_count),
    capability_count: asInt(r.capability_count),
  };
}

/** Parse the `groups` array from a `GET /v1/mcp/{slug}/browse` payload into host groups. */
export function mcpBrowseGroupsFromPayload(data: unknown): McpBrowseHostGroup[] {
  const payload = (data ?? {}) as Record<string, unknown>;
  const groups = Array.isArray(payload.groups) ? payload.groups : [];
  return groups.map((g) => {
    const group = (g ?? {}) as Record<string, unknown>;
    const endpoints = (Array.isArray(group.endpoints) ? group.endpoints : []).map(
      mcpBrowseEndpointFromPayload,
    );
    return {
      host: String(group.host ?? '(local)'),
      endpoint_count:
        typeof group.endpoint_count === 'number' ? asInt(group.endpoint_count) : endpoints.length,
      capability_count:
        typeof group.capability_count === 'number'
          ? asInt(group.capability_count)
          : endpoints.reduce((sum, e) => sum + e.capability_count, 0),
      endpoints,
    };
  });
}

/** Parse one capability item defensively. */
export function mcpCapabilityItemFromPayload(raw: unknown): McpCapabilityItem {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    item_type: String(r.item_type ?? ''),
    name: String(r.name ?? ''),
    title: asString(r.title),
    description: asString(r.description),
    uri: asString(r.uri),
    uri_template: asString(r.uri_template),
  };
}

/** Parse a `{ version: {...} }` version-detail payload into a {@link McpVersionDetail}. */
export function mcpVersionDetailFromPayload(data: unknown): McpVersionDetail | null {
  const payload = (data ?? {}) as Record<string, unknown>;
  const v = payload.version as Record<string, unknown> | undefined;
  if (!v || typeof v !== 'object') return null;
  const items = (Array.isArray(v.items) ? v.items : []).map(mcpCapabilityItemFromPayload);
  return {
    id: String(v.id ?? ''),
    version_seq: asInt(v.version_seq),
    version_tag: asString(v.version_tag),
    server_name: asString(v.server_name),
    server_version: asString(v.server_version),
    protocol_version: asString(v.protocol_version),
    instructions: asString(v.instructions),
    score: asScore(v.score),
    grade: asString(v.grade),
    is_current: v.is_current === true,
    discovered_at: asString(v.discovered_at),
    items,
  };
}

/** Parse an `{ endpoint: {...} }` endpoint-detail payload into a {@link McpEndpointDetail}. */
export function mcpEndpointDetailFromPayload(data: unknown): McpEndpointDetail | null {
  const payload = (data ?? {}) as Record<string, unknown>;
  const e = payload.endpoint as Record<string, unknown> | undefined;
  if (!e || typeof e !== 'object') return null;
  return {
    id: String(e.id ?? ''),
    name: String(e.name ?? ''),
    slug: String(e.slug ?? ''),
    endpoint_url: String(e.endpoint_url ?? ''),
    transport: String(e.transport ?? ''),
    description: asString(e.description),
    category: asString(e.category),
    visibility: String(e.visibility ?? 'private'),
    published: e.published === true,
    enabled: e.enabled !== false,
    current_version_id: asString(e.current_version_id),
    last_discovered_at: asString(e.last_discovered_at),
  };
}

/** Group capability items by kind, in the canonical {@link MCP_CAPABILITY_KINDS} order. */
export function mcpGroupItemsByType(
  items: McpCapabilityItem[],
): Array<{ key: string; label: string; items: McpCapabilityItem[] }> {
  return MCP_CAPABILITY_KINDS.map(({ key, label }) => ({
    key,
    label,
    items: items.filter((it) => it.item_type === key),
  })).filter((group) => group.items.length > 0);
}

/** Map a 0-100 quality score to a Badge variant (NULL → neutral "secondary"). */
export function mcpScoreVariant(score: number | null): McpBadgeVariant {
  if (score === null) return 'secondary';
  if (score >= 90) return 'success';
  if (score >= 70) return 'default';
  if (score >= 50) return 'warning';
  return 'error';
}

/** Human-readable score+grade label, e.g. "87 · B"; "Unscored" when there is no score. */
export function mcpScoreLabel(score: number | null, grade: string | null): string {
  if (score === null) return 'Unscored';
  return grade ? `${score} · ${grade}` : String(score);
}

/** Format an ISO timestamp for the "last discovered" column; "Never" when absent/invalid. */
export function formatLastDiscovered(iso: string | null): string {
  if (!iso) return 'Never';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return 'Never';
  return new Date(ms).toLocaleString();
}

/** True when an endpoint matches a free-text query (name / slug / host / URL / category). */
export function mcpEndpointMatchesQuery(endpoint: McpBrowseEndpoint, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    endpoint.name.toLowerCase().includes(q) ||
    endpoint.slug.toLowerCase().includes(q) ||
    endpoint.host.toLowerCase().includes(q) ||
    endpoint.endpoint_url.toLowerCase().includes(q) ||
    (endpoint.category ?? '').toLowerCase().includes(q)
  );
}

/**
 * Filter host groups by a free-text query, keeping only matching endpoints and dropping any
 * group left empty. Each surviving group's counts are recomputed from its filtered endpoints.
 */
export function mcpFilterGroups(groups: McpBrowseHostGroup[], query: string): McpBrowseHostGroup[] {
  if (!query.trim()) return groups;
  const result: McpBrowseHostGroup[] = [];
  for (const group of groups) {
    const endpoints = group.endpoints.filter((e) => mcpEndpointMatchesQuery(e, query));
    if (endpoints.length === 0) continue;
    result.push({
      host: group.host,
      endpoint_count: endpoints.length,
      capability_count: endpoints.reduce((sum, e) => sum + e.capability_count, 0),
      endpoints,
    });
  }
  return result;
}
