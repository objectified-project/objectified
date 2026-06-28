/**
 * Unit tests for the private MCP browse presentation helpers (V2-MCP-23.1 / MCAT-9.1, #3691).
 *
 * Exercises the pure adapter/format functions the browse list and endpoint detail views rely on:
 * payload parsing (defensive), host-group filtering, capability grouping, and score/last-discovered
 * formatting.
 */

import {
  formatLastDiscovered,
  mcpBrowseEndpointFromPayload,
  mcpBrowseGroupsFromPayload,
  mcpEndpointDetailFromPayload,
  mcpEndpointMatchesQuery,
  mcpFilterGroups,
  mcpGroupItemsByType,
  mcpScoreLabel,
  mcpScoreVariant,
  mcpVersionDetailFromPayload,
  type McpBrowseHostGroup,
} from '../src/app/components/ade/dashboard/mcp/mcpBrowseUi';

describe('mcpBrowseGroupsFromPayload', () => {
  it('parses groups and rolls up endpoint capability counts', () => {
    const groups = mcpBrowseGroupsFromPayload({
      success: true,
      host_count: 1,
      endpoint_count: 1,
      groups: [
        {
          host: 'mcp.acme.example',
          endpoint_count: 1,
          capability_count: 10,
          endpoints: [
            {
              id: 'ep-1',
              name: 'Acme Weather',
              slug: 'acme-weather',
              host: 'mcp.acme.example',
              endpoint_url: 'https://mcp.acme.example/sse',
              transport: 'streamable_http',
              visibility: 'private',
              published: false,
              enabled: true,
              score: 87,
              grade: 'B',
              tool_count: 3,
              resource_count: 2,
              resource_template_count: 1,
              prompt_count: 4,
              capability_count: 10,
            },
          ],
        },
      ],
    });
    expect(groups).toHaveLength(1);
    expect(groups[0].host).toBe('mcp.acme.example');
    expect(groups[0].endpoints[0].capability_count).toBe(10);
    expect(groups[0].endpoints[0].score).toBe(87);
  });

  it('returns an empty array for a missing/garbage payload', () => {
    expect(mcpBrowseGroupsFromPayload(null)).toEqual([]);
    expect(mcpBrowseGroupsFromPayload({})).toEqual([]);
    expect(mcpBrowseGroupsFromPayload({ groups: 'nope' })).toEqual([]);
  });

  it('derives counts when the group omits them', () => {
    const groups = mcpBrowseGroupsFromPayload({
      groups: [
        {
          host: 'h',
          endpoints: [
            { id: 'a', capability_count: 2 },
            { id: 'b', capability_count: 3 },
          ],
        },
      ],
    });
    expect(groups[0].endpoint_count).toBe(2);
    expect(groups[0].capability_count).toBe(5);
  });
});

describe('mcpBrowseEndpointFromPayload', () => {
  it('applies safe defaults for missing fields', () => {
    const ep = mcpBrowseEndpointFromPayload({ id: 'x' });
    expect(ep.host).toBe('(local)');
    expect(ep.enabled).toBe(true);
    expect(ep.published).toBe(false);
    expect(ep.score).toBeNull();
    expect(ep.capability_count).toBe(0);
  });
});

describe('mcpScoreVariant / mcpScoreLabel', () => {
  it('maps score bands to badge variants', () => {
    expect(mcpScoreVariant(null)).toBe('secondary');
    expect(mcpScoreVariant(95)).toBe('success');
    expect(mcpScoreVariant(80)).toBe('default');
    expect(mcpScoreVariant(60)).toBe('warning');
    expect(mcpScoreVariant(20)).toBe('error');
  });

  it('formats a score+grade label', () => {
    expect(mcpScoreLabel(null, null)).toBe('Unscored');
    expect(mcpScoreLabel(87, 'B')).toBe('87 · B');
    expect(mcpScoreLabel(87, null)).toBe('87');
  });
});

describe('formatLastDiscovered', () => {
  it('returns Never for null/invalid', () => {
    expect(formatLastDiscovered(null)).toBe('Never');
    expect(formatLastDiscovered('not-a-date')).toBe('Never');
  });

  it('formats a valid ISO timestamp', () => {
    expect(formatLastDiscovered('2026-06-26T12:00:00Z')).not.toBe('Never');
  });
});

describe('mcpEndpointMatchesQuery / mcpFilterGroups', () => {
  const groups: McpBrowseHostGroup[] = [
    {
      host: 'mcp.acme.example',
      endpoint_count: 2,
      capability_count: 7,
      endpoints: [
        mcpBrowseEndpointFromPayload({
          id: 'a',
          name: 'Weather',
          host: 'mcp.acme.example',
          category: 'weather',
          capability_count: 4,
        }),
        mcpBrowseEndpointFromPayload({
          id: 'b',
          name: 'Calendar',
          host: 'mcp.acme.example',
          category: 'time',
          capability_count: 3,
        }),
      ],
    },
    {
      host: 'beta.example',
      endpoint_count: 1,
      capability_count: 1,
      endpoints: [
        mcpBrowseEndpointFromPayload({
          id: 'c',
          name: 'Beta',
          host: 'beta.example',
          capability_count: 1,
        }),
      ],
    },
  ];

  it('matches by name, host, and category', () => {
    const ep = groups[0].endpoints[0];
    expect(mcpEndpointMatchesQuery(ep, 'weather')).toBe(true);
    expect(mcpEndpointMatchesQuery(ep, 'acme')).toBe(true);
    expect(mcpEndpointMatchesQuery(ep, 'nomatch')).toBe(false);
    expect(mcpEndpointMatchesQuery(ep, '')).toBe(true);
  });

  it('drops non-matching endpoints and empty groups, recomputing counts', () => {
    const filtered = mcpFilterGroups(groups, 'weather');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].host).toBe('mcp.acme.example');
    expect(filtered[0].endpoint_count).toBe(1);
    expect(filtered[0].capability_count).toBe(4);
  });

  it('returns groups unchanged for a blank query', () => {
    expect(mcpFilterGroups(groups, '   ')).toBe(groups);
  });
});

describe('mcpVersionDetailFromPayload / mcpGroupItemsByType', () => {
  it('parses a version surface and groups items by kind in canonical order', () => {
    const version = mcpVersionDetailFromPayload({
      version: {
        id: 'v1',
        version_seq: 3,
        version_tag: '2026.06.26',
        score: 91,
        grade: 'A',
        is_current: true,
        items: [
          { item_type: 'prompt', name: 'p1' },
          { item_type: 'tool', name: 't1', title: 'Tool One' },
          { item_type: 'resource', name: 'r1', uri: 'res://x' },
          { item_type: 'tool', name: 't2' },
        ],
      },
    });
    expect(version).not.toBeNull();
    expect(version!.score).toBe(91);
    const grouped = mcpGroupItemsByType(version!.items);
    // tools first, then resources, then prompts (resource_template omitted — none present)
    expect(grouped.map((g) => g.key)).toEqual(['tool', 'resource', 'prompt']);
    expect(grouped[0].items).toHaveLength(2);
  });

  it('returns null when the payload has no version', () => {
    expect(mcpVersionDetailFromPayload({})).toBeNull();
    expect(mcpVersionDetailFromPayload(null)).toBeNull();
  });
});

describe('mcpEndpointDetailFromPayload', () => {
  it('parses an endpoint record', () => {
    const ep = mcpEndpointDetailFromPayload({
      endpoint: {
        id: 'ep-1',
        name: 'Acme',
        slug: 'acme',
        endpoint_url: 'https://mcp.acme.example/sse',
        transport: 'streamable_http',
        visibility: 'private',
        current_version_id: 'v1',
      },
    });
    expect(ep?.id).toBe('ep-1');
    expect(ep?.current_version_id).toBe('v1');
  });

  it('returns null when the payload has no endpoint', () => {
    expect(mcpEndpointDetailFromPayload({})).toBeNull();
  });
});
