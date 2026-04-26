# Tenants mockups

A polished **master–detail** redesign of the tenants experience that maps to
[`/ade/dashboard/tenants`](../../../src/app/ade/dashboard/tenants/page.tsx).

## What production does today

- Single table: name, slug, description, status, overflow actions (edit, manage
  members, switch tenant).
- “Manage” toggles a **hidden block** below the table per tenant — easy to
  miss and hard to scan when you administer several workspaces.

## What this mockup proposes

| Area | Change |
| ---- | ------ |
| **Layout** | Persistent **directory rail** (all workspaces) + **detail pane** (one selected tenant). No buried panels. |
| **Context** | **KPI strip** in the rail: workspace count, how many you administer, members/admins rollup. |
| **List rows** | Avatar, name, mono slug, enabled/disabled pill, **Admin vs Member** badge, **Active workspace** pill. |
| **Detail header** | Gradient hero, copy-slug, primary **Invite** / **Edit** / **Active workspace** actions. |
| **Tabs** | **Overview** · **Members** · **Activity** · **Danger zone** — members table and activity are teased on `index.html`. |
| **Safety** | Inline **slug rename impact** callout (URLs, webhooks) aligned with the existing confirmation flow. |

## Open

```bash
open objectified-ui/public/mockups/tenants/index.html
```

With the Next.js dev server:

```
http://localhost:3000/mockups/tenants/index.html
```

## Visual language

- **Active workspace**: indigo → blue gradient pill (matches production
  “Current” chip).
- **Enabled / Disabled**: emerald / red pills with dot (matches production).
- **Administrator**: violet badge; **Member**: slate badge.
- Shell (280px sidebar, 48px top bar, tenant switcher) aligns with
  [`mockups/projects/dashboard.html`](../projects/dashboard.html).

## What’s intentionally faked

- All tenants, IDs, dates, members, and activity lines are static.
- Directory rows and tabs are not wired; theme toggle + Lucide are the only JS.

## Next iterations (optional)

- Separate HTML for **Members** tab (full table, bulk actions, promote/demote).
- **Activity** tab with filters and export.
- **Danger zone** with disable / soft-delete copy matching production dialogs.
- **Empty state** and **non-admin** read-only detail when the user only has
  “switch workspace”.
