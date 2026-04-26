# Published mockups

A polished redesign of the **Published** dashboard surface — currently
[`src/app/ade/dashboard/published/page.tsx`](../../../src/app/ade/dashboard/published/page.tsx),
which today is a single utilitarian table with a search box and a `…`
action menu per row.

The redesign reframes "Published" as the tenant's **API portal / catalog**
rather than a generic admin list. Published versions are *live API
endpoints serving consumers* — so the page should surface visibility,
share affordances, traffic, errors, and consumer counts, not just
metadata.

These mockups inherit chrome (top bar, 280 px sidebar, gradient header
band) from `mockups/versions/` and `mockups/projects/` so they slot
into the same dashboard shell.

## Implementation status

> **Both screens are shipped.** This mockup is now design-of-record
> for a live React surface, not a proposal:
>
> - Listing → [`src/app/ade/dashboard/published/page.tsx`](../../../src/app/ade/dashboard/published/page.tsx)
>   plus `PublishedKpiBand`, `PublishedCatalogBanner`, `PublishedTable`,
>   `PublishedCardsAlternate`.
> - Detail → [`src/app/ade/dashboard/published/[versionId]/page.tsx`](../../../src/app/ade/dashboard/published/[versionId]/page.tsx)
>   plus `PublishedDetailHeader`, `PublishedDetailHero`, `OverviewTab`,
>   `CodeTab`, `ConsumersTab`, `ActivityTab`, and `DetailRightRail`.
> - Tokens → `src/app/components/ade/dashboard/dashboardScreenClasses.ts`
>   under the `published*` family.
> - DB → `getPublishedVersionDetail(tenantId, versionId)` joins the
>   row + tenant + project + creator, then derives `parent` / `child`
>   lineage from `odb.versions` ordering. The existing
>   `getPublishedVersionsForTenant` and `updateVersionVisibility`
>   helpers are unchanged.
>
> Metrics, top operations, consumer rollups, scoped activity, and
> lifecycle alerts are still fixture-driven (see
> `published/_internal/fixtures.ts`) until their backing analytics /
> audit data lands. The fixture module is the single point of cut-over.
>
> See `objectified-ui/docs/PUBLISHED_VERSIONS_FEATURE.md` for the full
> feature spec.

## Files

| File             | Status | Phase | What it covers |
| ---------------- | ------ | ----- | -------------- |
| `dashboard.html` | done | 1 | **Published listing.** Page header (title + description + ⌘K search + Export · Subscribe). KPI band: Published versions (count + delta) · Visibility (public/private split bar + missing-key warn) · Requests · 7d (volume + sparkline + w/w delta) · Active consumers (count + new this week). Public catalog banner with sharable tenant URL (copy · QR · open) and "Catalog settings" CTA. Filter chip toolbar: All · Public · Private · Top used · Stale · Errors > 1%, plus Group (Flat / By project) · Sort (Most used) · View (Cards / **Table** — Table is default). **Default view: dense table** with 9 columns — checkbox · Version (project avatar + name + semver pill with lock + state chip + publisher line) · Visibility (click-to-toggle pill) · Access URL (mono path + inline copy/QR/open icons + amber `key` chip for private) · Req · 24h (right-aligned + w/w delta arrow) · p50 (right-aligned ms) · Errors (right-aligned, color-toned: emerald ≤ 0.2%, amber ≤ 1%, rose > 1%) · Consumers (right-aligned) · Activity (sparkline + last-hit) · `⋯` action menu. Row-state inset bar on the left edge: indigo for hot, rose for errors > 1%, amber for stale. Sticky sortable headers (active sort indicated with arrow). Pager footer with rows-per-page selector. **Cards view** retained as a collapsible "alternate" panel below the table — same six cards as before with top accent strip, URL preview row, 4-cell stat block, sparkline + last-hit, drill-in CTA. **Visual references** panel with: bulk-action toolbar (Make public · Make private · Copy URLs · Export CSV · Unpublish · Clear) appearing when ≥ 1 row is selected, and the per-row action menu (View OpenAPI / Arazzo / JSON Schema / Swagger UI · Copy URL · Show QR · Copy as cURL · Make private · Unpublish). Drill-in target is `detail.html` (phase 2). |
| `detail.html`    | done | 2 | **Single published version.** Reached from a table row's project name link or a card. Sub-page header: back-link to listing, project avatar + name + semver pill (with lock) + visibility pill + state chip (hot · errors · stale), one-line description with breaking-change call-outs inline-styled, mono publisher line, action row (QR · Share · Edit notes · Make private · Open spec · `⋯`). 6-cell hero KPI strip: Req · 24h (with sparkline + w/w delta) · p50 · p95 · Errors (color-toned) · Consumers (with `+N new`) · Schema (paths · ops · schemas). Two-column body (`1fr / 360px`). **Left** has the active tab content — Overview is the rendered tab — with tab strip (Overview · Code · Swagger · Consumers · Activity, plus a spec-format note on the right). Overview content: **Access endpoints** card with 4 typed rows (OpenAPI YAML/JSON · Swagger UI · Arazzo · JSON Schema bundle) each showing the full URL and copy / QR / open buttons; **Release notes** card with semver heading, rose-tinted "Breaking changes" callout, Added / Improved sections, migration-guide link; **Schema & usage** card with 4-cell stat block (Paths · Operations · Schemas · Webhooks) and a top-operations-by-volume mini list (method chip + mono path + per-op sparkline + req count); **Swagger preview** card with the first 5 of 87 operations as an inline list (method chip · path · summary · expand caret), with a CTA to open the full Swagger UI. **Right rail**: QR card (faux dotted-grid QR + PNG / SVG download buttons + caption); Visibility card (current state pill, toggle to switch, mini audit log); Lineage rail (parent v2.4.6 deprecated → THIS v2.5.0 published → child v2.6.0-rc1 draft, with per-node req volume / consumer counts); Lifecycle alerts (errors trending up · consumer key expiring); Recent activity (compact 4-event timeline, link to full Activity tab). The remaining tabs (**Code**, **Consumers**, **Activity**) are rendered below as collapsible `<details>` panels — Code tab shows a language-tab strip (cURL active, plus fetch · axios · python · go) with a dark editor and a syntax-highlighted snippet covering both public and private (API key) cases; Consumers tab shows a 5-row API-key table (key + owner + req·24h + req·7d + errors + last-seen + expires + `⋯`); Activity tab shows a vertical timeline with publish · visibility-change · new-consumers · error-alert · spec-download · lineage events. Theme toggle persisted under `published-mockup-theme`. |

## Open

```
open objectified-ui/public/mockups/published/dashboard.html   # Phase 1 — listing
open objectified-ui/public/mockups/published/detail.html      # Phase 2 — drill-in
```

Or, with the Next.js dev server running:

```
http://localhost:3000/mockups/published/dashboard.html
http://localhost:3000/mockups/published/detail.html
```

## Why this redesign

The current page is **read-only and shape-less**. It tells the user
*there are some published versions* but doesn't surface anything an API
owner actually cares about:

- **Discovery.** Today there is no "share this catalog" affordance.
  Public versions exist but the tenant has no obvious public landing
  page to link to from external docs / Slack / partner portals.
- **Operational health.** Today there are no traffic, latency, or error
  signals on the page. Published = "served to consumers" should mean
  you can spot a hot endpoint, a stale one, or one that started erroring
  without leaving the page.
- **Visibility hygiene.** Today the public / private split is invisible
  at the tenant level. The redesign exposes counts, the proportion bar,
  and a count of private versions still missing an enabled API key.
- **Consumer-aware controls.** Unpublishing or flipping a public version
  to private has consumer impact. The redesign foregrounds consumer
  counts on every card so the operator never makes that change blind.
- **Per-row interactions are too cramped.** Today a 5-column row tries
  to hold project · version · visibility · URL · published-at · `…`,
  and the action menu is the only path to copy/share/visibility. The
  redesigned table puts copy / QR / open inline on the URL cell, makes
  the visibility pill a click-toggle, and reserves the `⋯` menu for
  less frequent ops (Swagger · Arazzo · JSON · cURL · Make private ·
  Unpublish).
- **No bulk operations.** Today every visibility flip and unpublish is
  per-row through the menu. The redesigned table adds row checkboxes
  and a contextual bulk-action toolbar (Make public · Make private ·
  Copy URLs · Export CSV · Unpublish) that replaces the filter row when
  ≥ 1 row is selected.
- **Doesn't scale.** Today the table is fine at 6 rows and gets noisy
  past 30. The redesign adds row-state inset bars (hot · errors ·
  stale) so the eye finds the rows that need attention immediately,
  sortable column headers (with the active sort marked), and a pager
  with rows-per-page so the page stays usable at hundreds of
  publications.

## Visual language

Inherits from `mockups/versions/` and `mockups/projects/`:

- **Visibility pills:** Public = emerald · Private = slate. The pill is
  a click-target (toggle visibility); the action menu still has the
  destructive long-form path.
- **Row-state inset bar (table view):** 3 px left edge tint — indigo
  for hot, rose for errors > 1%, amber for stale. Same semantic palette
  the cards use on their top accent strip, applied to the table rows
  so a long list still telegraphs which rows need attention.
- **Card top accent strip (cards view):** 4 px gradient signaling card
  state — emerald → cyan for public, slate for private, indigo →
  purple for hot, rose → amber for problem (errors > 1%), amber →
  orange for stale.
- **Stat tone:** Errors cell colored by tier (≤ 0.2% emerald,
  ≤ 1% amber, > 1% rose). Other cells stay neutral so the eye locks
  on health. In the table the errors column carries the tone; in the
  cards the 4-cell stat block does.
- **Project avatar:** deterministic gradient (indigo → purple, emerald
  → cyan, amber → orange, etc.) — matches the convention used by
  `mockups/versions/` and `mockups/projects/dashboard.html`.
- **URL preview:** dashed indigo border + soft indigo wash, mono
  truncated path, inline icon buttons (copy · QR · open), with a
  separate amber `key` chip when the version is private. Same block
  is reused in the table cell and the card body for visual continuity.
- **Method chips (detail page):** GET emerald · POST blue · PUT
  orange · DELETE rose · PATCH violet — bordered, mono, uppercase.
  Reused across the Swagger preview, top-operations list, and any
  future operation-level surface.
- **Lineage rail (detail page):** three vertically stacked nodes
  (parent → THIS → child) connected by down-arrows. The "this" node
  uses a soft indigo gradient + indigo border; siblings are flat
  cards; each carries a tag pill (`parent` orange, `this` solid
  indigo, `child` slate) and a one-line metric line.
- **Code editor (detail page):** dark slate background, JetBrains
  Mono, with the same token palette used in `mockups/versions/version-viewer.html`
  (keys amber, strings emerald, numbers / booleans violet, comments
  slate-italic). A language-tab strip sits above the editor; only
  the active tab is rendered.

## What's intentionally faked

- All projects, versions, request counts, latencies, error rates, and
  consumers are hard-coded.
- Sparklines are static SVG paths — no live history.
- Filter chips, group / sort dropdowns, and view switcher do not filter
  the rendered set. The Cards-view alternate is a `<details>` element
  toggled by clicking its summary, not by clicking the view switcher.
- Sortable column headers are visual only; they do not re-sort the
  table. The "Req · 24h" header is shown as the active sort just so
  the indicator pattern reads.
- Row checkboxes are interactive but the bulk-action toolbar shown in
  the Visual references panel is static — it does not appear above the
  real table when rows are checked.
- The QR code on the catalog banner is implied by an icon button only;
  it is not actually encoded.
- Theme toggle (persisted under `published-mockup-theme`) and Lucide
  icon hydration are the only working JS.
- The per-row action menu is rendered as a static visual reference; it
  is not actually anchored to any row's `⋯` button.
- **detail.html · Tabs:** the tab strip is visual-only. Overview is
  the rendered tab; Code, Consumers, and Activity are shown as
  collapsible `<details>` panels below the body so reviewers can read
  them all without JS. In production this collapses into a real tab
  switcher and the panels become the active-tab body.
- **detail.html · Hero KPIs and per-operation usage:** all numbers
  (412k req, 38ms p50, 0.2% errors, 18 consumers, top-operations
  volumes, sparklines) are hard-coded.
- **detail.html · QR card:** rendered as a faux dotted-grid (a CSS
  radial-gradient pattern), not an actual QR encoding of the spec
  URL. The PNG / SVG download buttons are inert.
- **detail.html · Visibility & lineage:** the visibility toggle, the
  audit-log preview, and the parent / this / child lineage links are
  all static. In production the parent and child nodes link to their
  own `detail.html`-equivalent routes.
- **detail.html · Code tab:** the language-tab strip is a single
  active tab (cURL); fetch, axios, python, go are inert. The Copy
  button is decorative.
- **detail.html · Consumers tab:** the per-key revoke / rotate menu
  (`⋯`) is decorative. Errors / req volumes / last-seen / expiry are
  hard-coded.
- **detail.html · Activity tab:** the timeline is static; in
  production it backs onto the existing audit log scoped by
  `version_id`.

## Out of scope (for now, by request)

- The actual **publish flow** modal (target audience, dry-run lint,
  schedule). Publishing happens from a draft on the per-version detail
  page; it is not initiated from this surface.
- The **unpublish / sunset** confirmation modal (consumer impact list,
  notify-consumers draft, migration-guide link).
- Per-tenant **catalog settings** page (custom domain, branding, terms,
  hidden tags). Hooked from the banner CTA but not designed yet.
- A **bulk-select** mode on the cards (multi-select to flip visibility
  or export). The single-row controls cover today's actions; bulk can
  follow in a phase 3 if the use case is real.

## Phasing

```
Phase 1 → dashboard.html         (done; primary listing — table-first)            ✓ shipped
Phase 2 → detail.html            (done; drill-in — analytics + code + QR + consumers + lineage)  ✓ shipped
Phase 3 → bulk + settings flows  (only if needed after live use)
```

The detail route shipped at `src/app/ade/dashboard/published/[versionId]/page.tsx`
(version UUID) rather than the originally-proposed
`[tenantSlug]/[projectSlug]/[versionId]` path — the version's UUID is
already tenant-scoped via `getPublishedVersionDetail`, so the slug
trio adds nothing for the detail route. The user-visible URLs for the
spec endpoints still use the slug trio.

The data layer that already shipped:

- `getPublishedVersionsForTenant(tenantId)` — listing, unchanged.
- `getPublishedVersionDetail(tenantId, versionId)` — base row +
  parent / child lineage from `odb.versions` ordering.
- `updateVersionVisibility(versionRecordId, visibility)` — unchanged.

Still deferred (placeholders in `_internal/fixtures.ts` today):

- traffic + latency + error rate per published version (24h / 7d windows)
- per-consumer request volume keyed by `(version_id, api_key_id)`
- top operations by request volume (server-side aggregate, optional)
- audit log entries scoped to a version (publish, visibility change,
  consumer add/expire)
- catalog metadata (public-catalog opt-in, custom domain) for the
  banner on the listing
- persisted release-notes column on `odb.versions` (the rail's
  "Edit notes" CTA is currently a toast placeholder)
- QR generation for the catalog banner and detail rail's QR card
