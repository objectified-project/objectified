# Published Versions — API Catalog & Detail

Status: redesigned April 2026. The original implementation lived as a
single table page; the surface is now a two-screen API catalog
experience (listing + per-version detail).

## Overview

The Published surface lets a tenant treat its locked versions as a
discoverable API catalog. It answers four questions in one place:

1. **What's shippable?** Every version with `published = true` for the
   current tenant, with visibility, schema size, and headline traffic.
2. **What's healthy?** Per-version request volume, p50/p95 latency,
   error rate, and lifecycle alerts (errors trending, keys expiring,
   stale catalog).
3. **Who's using it?** Per-API-key consumer breakdowns and a 7-day
   activity sparkline on every row.
4. **How do I integrate?** Copy-paste snippets in cURL, fetch, axios,
   python, and go that adapt to public vs. private specs.

## Routes

| Route | Surface |
|---|---|
| `/ade/dashboard/published` | Listing — KPI band, catalog banner, dense table (default), card grid (alternate). |
| `/ade/dashboard/published/[versionId]` | Detail — sub-page header, 6-cell hero KPI strip, tabs (Overview / Code / Consumers / Activity), right rail (QR / Visibility / Lineage / Alerts / Recent activity). |

## Database helpers (`lib/db/helper.ts`)

### `getPublishedVersionsForTenant(tenantId)`

The original listing helper. Joins `odb.versions`, `odb.projects`,
`odb.tenants`, and `odb.users`. Filters for `published = true`,
non-deleted rows. Orders by `published_at DESC`. Returns a JSON-encoded
array of rows.

### `getPublishedVersionDetail(tenantId, versionRecordId)` *(new)*

Detail-page helper. Two phases:

1. **Base row.** Same join chain as the listing helper, scoped to a
   single `versions.id` and bounded by `tenant_id` for isolation.
2. **Lineage neighbours.** Two parallel queries against
   `odb.versions` for the row's project:
   - `parent` — the most recent *published* version with
     `published_at < self.published_at`. Always labelled `deprecated`
     since self has superseded it.
   - `child` — the next version (published or draft) with
     `created_at > self.created_at`. State derived from its
     `published` flag and version_id suffix
     (`-rc` / `-alpha` / `-beta` / `-pre` → `rc`, otherwise `published`
     if `published = true` else `draft`).

Returns:

```ts
{
  success: true,
  row: { /* PublishedVersionRow */ },
  lineage: {
    parent: { id, versionId, state, ageDays } | null,
    child:  { id, versionId, state, ageDays } | null,
  }
}
| { success: false, error: string }
```

Tenant scoping is enforced in the SQL — a version that exists but
belongs to a different tenant returns `not_found`.

### `updateVersionVisibility(versionRecordId, visibility)`

Unchanged. Toggles `versions.visibility` between `public` and
`private`. Used from both the listing's per-row pill and the detail
header / right rail.

## Component map

```
src/app/ade/dashboard/published/
├── page.tsx                          listing orchestrator
├── PublishedKpiBand.tsx              4-card KPI strip (versions, visibility split, requests, consumers)
├── PublishedCatalogBanner.tsx        public catalog URL strip
├── PublishedTable.tsx                default dense table view
├── PublishedCardsAlternate.tsx       card-grid alternate (also exports PublishedCardsGrid)
├── [versionId]/
│   └── page.tsx                      detail orchestrator
└── _internal/
    ├── types.ts                      shared TS shapes
    ├── fixtures.ts                   deterministic mock data (metrics/consumers/activity/alerts)
    ├── Sparkline.tsx                 reusable inline SVG sparkline
    ├── PublishedDetailHeader.tsx     sub-page header (back link, title pills, action row)
    ├── PublishedDetailHero.tsx       6-cell hero KPI strip
    ├── OverviewTab.tsx               access endpoints + release notes + schema/usage + swagger preview
    ├── CodeTab.tsx                   cURL / fetch / axios / python / go snippets
    ├── ConsumersTab.tsx              per-API-key consumer table
    ├── ActivityTab.tsx               vertical audit timeline
    └── DetailRightRail.tsx           QR / Visibility / Lineage / Alerts / Recent activity rail
```

All visual tokens live in `src/app/components/ade/dashboard/dashboardScreenClasses.ts`
under the `published*` family (header shell, panel, banner, URL block,
visibility pills, row-state inset bars, error tiers, sortable headers,
method chips, lineage nodes, faux QR, etc.).

## Data sources & fixtures

The DB only knows about rows, projects, tenants, and lineage
relationships derivable from `odb.versions`. Everything else on the
detail page — request volume, latency percentiles, error rate, consumer
identities, audit events, alert triggers — is **fixture-generated
client-side** today, keyed deterministically by `versions.id` so the
same row renders the same numbers across reloads.

Fixtures live in `_internal/fixtures.ts`. They implement the same TS
contracts (`types.ts`) that real helpers will need to satisfy when
their data sources land:

| Fixture | Replacement target |
|---|---|
| `fakeMetricsForVersion` | analytics rollup table (24h request volume, p50/p95, error rate, hourly buckets) |
| `fakeTopOperations` | per-operation request counters |
| `fakeConsumers` | per-API-key request counters scoped to a version |
| `fakeActivity` | `odb.version_protection_audit` + visibility-change audit log scoped to one version |
| `fakeAlerts` | derived from real metrics + key expiry table |
| `fakeReleaseNotes` | persisted release-notes column on `odb.versions` |
| `fakeLineage` | replaced by `getPublishedVersionDetail` lineage block |

Lineage has already cut over from fixture to real data — the page
overlays the helper's `parent` / `child` onto the fixture bundle's
`self` (which still synthesises traffic meta).

## URL format

Spec URLs are built client-side from `NEXT_PUBLIC_REST_API_BASE_URL`:

```
{base}/schema/{tenant-slug}/{project-slug}/{version-id}     OpenAPI YAML/JSON
{base}/swagger/{tenant-slug}/{project-slug}/{version-id}    Swagger UI
{base}/arazzo/{tenant-slug}/{project-slug}/{version-id}     Arazzo workflows
{base}/json/{tenant-slug}/{project-slug}/{version-id}       JSON Schema bundle
```

Private versions surface an API key dialog before opening — the entered
key is appended as `?api_key=…` for the redirect (the URL is never
persisted server-side).

## States

- **Loading.** Listing and detail render `LoadingState`. Detail keeps
  the URL stable so a hard refresh remounts cleanly.
- **No tenant.** A blocking amber callout pointing at the Tenants page.
- **No published versions.** Listing renders an empty state with a
  link to the Versions screen.
- **Detail not found.** Empty state with a `Back to Published`
  button — fires when the version is unpublished, soft-deleted, or
  belongs to a different tenant.

## Visibility lifecycle

Toggling visibility from any of the three entry points (listing
per-row pill, detail header button, detail rail card button) shares
one server action (`updateVersionVisibility`) and one confirmation
dialog. After success the optimistic update flips the local state so
the visibility pill, KPI band, and rail card all reflect the new
value without a refetch.

## Accessibility

- Sortable table headers carry `aria-sort` and respond to
  Enter / Space.
- Tab navigation on the detail page uses `role="tablist"` /
  `role="tab"` / `aria-selected`.
- Action menus on row hover are keyboard-reachable (button focus +
  click-outside dismissal).
- All icon-only buttons carry visible text or `title` attributes.

## Security

- Tenant isolation is SQL-enforced in both helpers (the join chain
  filters by `p.tenant_id`).
- Soft-delete flags are respected at every level (versions, projects,
  tenants).
- Visibility changes go through the existing audit-aware helper —
  the listing and detail pages do not write to `odb.versions` directly.
- API keys entered into the dialog stay client-side; the URL is opened
  via `window.open` rather than persisted.

## Performance

- Listing fetches one query (with sort + joins) and caches the result
  in component state.
- Detail fetches one query (base row) plus two parallel lineage
  queries via `Promise.all`.
- Heavy fixtures are computed once per row via `useMemo` keyed by row
  id, so re-renders of the listing don't recompute traffic data.

## Deferred work

1. Real metrics helper (24h request volume, p50/p95, error rate,
   hourly buckets, consumer counts).
2. Per-API-key per-version request rollup for the Consumers tab.
3. Audit-event helper feeding the Activity tab and rail recap.
4. Alert engine (errors trending, key expiring, stale catalog) — once
   metrics and audit data exist, the alert derivation in `fakeAlerts`
   becomes a real query.
5. Persisted release notes editor (the rail's "Edit notes" button is
   currently a toast placeholder).
6. QR generation for the rail card and detail-header `QR` button.
