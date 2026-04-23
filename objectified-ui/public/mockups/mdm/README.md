# MDM mockups

Static, browser-openable design mockups for **Objectified Master Data
Management (MDM)**. MDM extends the event-sourced instance database
(see [`docs/FUTURE_FEATURE_ROADMAP_DATABASE.md`](../../../../docs/FUTURE_FEATURE_ROADMAP_DATABASE.md))
with the governance, match/merge, stewardship, and distribution surfaces
required to turn raw class instances into trusted **golden records**.

These files cover the **MVP scope** plus a forward look at higher-value
governance surfaces (unmerge, ML matching, hierarchies, auto-publish).
They are visual references — no API calls, no auth, no build step.

## Open

Either open the files directly:

```
open objectified-ui/public/mockups/mdm/index.html
```

Or, with the Next.js dev server running, browse to:

```
http://localhost:3000/mockups/mdm/index.html
```

## Files (Phase 1 — built)

| File              | Maps to roadmap                                            |
| ----------------- | ---------------------------------------------------------- |
| `index.html`      | Mockup hub linking to all screens (Epics 1–7)              |
| `dashboard.html`  | MDM Overview · cross-cutting KPIs, queues, sources         |

## Files (planned — referenced from hub, not yet built)

| File                       | Maps to roadmap issue                                       |
| -------------------------- | ----------------------------------------------------------- |
| `domains.html`             | 1.1 Domain registry · 1.2 Class promotion                   |
| `golden-record.html`       | 1.3 Golden record detail with field-level provenance        |
| `xref-map.html`            | 1.4 Cross-reference map · resolve API                       |
| `match-rules.html`         | 2.1 Deterministic blocks · 2.2 Fuzzy / ML scoring           |
| `merge-candidates.html`    | 2.3 Candidate queue · auto vs steward                       |
| `survivorship.html`        | 2.4 Per-field winner rules                                  |
| `unmerge.html`             | 2.5 Reverse merge · time-travel preview                     |
| `stewardship-inbox.html`   | 3.1 Triage queue · SLA timers                               |
| `steward-workspace.html`   | 3.2 Side-by-side compare · 3.3 Single-click merge           |
| `approvals.html`           | 3.4 Maker-checker · escalation chains                       |
| `quality-dashboard.html`   | 4.1 5-dimension DQ score (completeness, validity, etc.)     |
| `profiling.html`           | 4.2 Column profiling · distribution · outliers              |
| `dq-rules.html`            | 4.3 DQ rule authoring                                       |
| `hierarchies.html`         | 5.1 Parent-child trees (corp roll-ups, taxonomies)          |
| `reference-data.html`      | 5.2 Code lists · ISO standards · allowed-value sets         |
| `sources.html`             | 6.1 Source registry · trust rank · freshness SLO            |
| `lineage.html`             | 6.2 Field-level provenance · who · when · which source      |
| `subscriptions.html`       | 7.1 Outbound feed configuration                             |
| `publish-jobs.html`        | 7.2 Delivery jobs · 7.3 Retry / dead-letter / replay        |

## What MDM is, in Objectified terms

A **master data domain** is a designation applied to a Studio class
(`class_id`) that says: *"instances of this class represent a real-world
entity that may be reported by many source systems and must be
de-duplicated into a single trusted record."*

Each domain has:

- **Natural keys** — the property combinations that uniquely identify
  the entity (e.g. `email + tax_id` for Customer)
- **Match rules** — deterministic blocks plus fuzzy / ML comparators
- **Survivorship rules** — per-field winner selection (source rank, most
  recent, longest non-null, custom expression)
- **Stewards** — humans assigned to triage uncertain matches
- **Subscribers** — downstream systems that receive the golden record

The **golden record** is materialized into the existing instance
storage as a special instance whose `data` is the survived merge of all
contributing source records, whose `instance_data` event log records
every merge, override, and unmerge, and whose **xref table** maps each
contributing `(source_system_id, source_record_id)` to the master
`instance_id`.

Because golden records live in the same instance store as everything
else, they automatically inherit:

- **Snapshots** for O(1) reads of the current consolidated entity
- **Append-only event log** for full audit and time-travel
- **Optimistic locking** for safe concurrent steward edits
- **Detective audit events** for every merge / override / unmerge
- **Schema captures** so the golden record schema is versioned and
  immutable per release

## Design system

Mockups intentionally mirror the live `objectified-ui` shell and the
sibling `mockups/data-transform/` and `mockups/data-shield/` folders:

- **Brand glyph**: indigo→sky gradient (`gem` lucide icon)
- **Typography**: Inter (400/500/600/700), JetBrains Mono for IDs and metric values
- **Accent**: indigo-500 / 600 (Radix `accentColor="indigo"`)
- **Gray scale**: slate (Radix `grayColor="slate"`)
- **Layout**: 280px gradient sidebar, 48px top platform bar, panel cards
  (`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700`)
- **Icons**: Lucide (CDN), matching the live `lucide-react` icon set
- **Charts**: hand-rolled inline SVG (line, donut, radar, sparkline) — no
  chart library; final implementation will use Recharts per the database
  roadmap tech stack
- **Theme**: class-based dark mode toggle, persisted to `localStorage`
  under `mdm-mockup-theme`. Honors `prefers-color-scheme` on first load.

## Conventions matched from production code

The shared layout tokens come from
`src/app/components/ade/dashboard/dashboardScreenClasses.ts` and
`src/app/components/ade/dashboard/DashboardSideNav.tsx`. Notable patterns:

- Section headers in the sidebar use `text-[0.65rem]` uppercase with a 1×1 indigo dot
- Panels use `bg-gray-50 dark:bg-gray-900` for header bars
- Active nav items use a 10% indigo fill + 1px border + indigo text + a small dot indicator
- Page headers follow the `<h2>` + lucide icon + subtitle pattern from `dashboard/page.tsx`
- Time-range pill groups appear in the header right slot (7d / 30d / 90d / 1y)

## MDM best practices reflected in the design

The mockups are organised around the patterns codified in industry MDM
playbooks (Gartner / TDWI / Informatica / Reltio / Profisee):

1. **Multi-domain** — one shared engine governs Customer, Product,
   Location, Supplier, Employee
2. **Multi-source** — every contributing system is registered with a
   trust rank that drives default survivorship
3. **Match → merge → survive** as three explicit, separately-tunable
   stages, with clear thresholds (auto / steward / no-match)
4. **Steward-first** — humans are first-class actors; SLA timers,
   maker-checker approvals, and side-by-side compare are core surfaces
5. **Field-level lineage** — every property on a golden record exposes
   *which source*, *which version*, and *which rule* produced it
6. **Reversibility** — all merges are reversible via the event log;
   unmerge is a first-class operation, not a database hack
7. **Closed-loop publish** — golden records flow back out to subscribing
   systems via Kafka / webhook / pull subscriptions with delta or
   snapshot delivery, retries, and dead-letter handling
8. **Reference data alongside master data** — code lists and standards
   (currencies, countries, business units) governed in the same console

## What's intentionally faked

- All data is hard-coded (record counts, scores, sparklines)
- Filters, sort buttons, search inputs, and time range pills are visual only
- Steward action buttons (Approve, Reject, Open compare) are decorative
- The radar chart on `dashboard.html` is a static SVG polygon
- Source freshness dots are CSS-only, not real heartbeat polling
- The theme toggle is the only piece of working JS (plus Lucide icon hydration)

## Out of scope (not built as standalone screens)

- Per-domain RBAC and steward assignment (lives inline on `domains.html`)
- ML model training UX for the fuzzy matcher (referenced from `match-rules.html`)
- Subscriber acknowledgement protocol (referenced from `publish-jobs.html`)
- Cross-tenant golden record federation (Enterprise post-MVP)

Sidebar items marked `Ent` are intentional placeholders showing the
eventual nav surface area without committing to a screen design.
