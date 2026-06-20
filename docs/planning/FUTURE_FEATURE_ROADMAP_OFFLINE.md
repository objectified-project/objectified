# Schema Designer — Offline-First & Buffered Git-Like Workflow

**Scope:** ADE **Schema Designer** (`/ade/studio` editor) only — not Paths, Browse, or other surfaces.  
**Goal:** Local editing with a **bulk commit/push** model, **localStorage** persistence of pending work, **undo/redo** without server calls, and **merge** of server-ahead revisions using existing **conflict management** UI.  
**Repository:** [KenSuenobu/objectified-commercial](https://github.com/KenSuenobu/objectified-commercial) (workspace `origin`).  
**GitHub epic (OFFLINE-R1):** [#2680](https://github.com/KenSuenobu/objectified-commercial/issues/2680).

---

## Roadmap ID

| ID | Meaning |
|----|---------|
| **OFFLINE-R1** | Umbrella epic — offline buffer, toolbar, sync, undo/redo, merge |
| **OFFLINE-01** | Branch icon menu (Designer toolbar) |
| **OFFLINE-02** | Local buffer, bulk commit, localStorage |
| **OFFLINE-03** | Undo/redo over buffered operations |
| **OFFLINE-04** | Merge server-ahead into buffered branch + conflicts |

---

## Design principle

Today, many Designer operations can be modeled as **immediate** REST actions (e.g. class-level changes). For **offline-capable** editing and **local** undo/redo, the client must treat edits as **operations in a buffer** and apply them to the server in **one or more bulk operations** (commit/push), not one REST round-trip per micro-edit.

```
  User edits  -->  [ Local op buffer ]  -->  undo/redo (local)
                           |
                           v
                    localStorage (durability)
                           |
                           v (online)
                    bulk commit / push  -->  REST
                           ^
                           |
  Remote ahead   -->  merge preview  -->  conflict UI (existing)
```

---

## Issues to track (order of implementation)

| Priority | Roadmap ID | Title (one line) | MVP vs V2 | Parallelism |
|---------:|------------|------------------|-----------|---------------|
| 1 | OFFLINE-01 | Add Schema Designer branch icon menu beside Layout and Export with Commit, Revert, Branch, Merge, and Reset wired to available actions. | **MVP** | High — UI only; depends on existing version APIs |
| 2 | OFFLINE-02 | Implement Designer local change buffer with bulk commit, localStorage persistence, and push batching instead of per-edit REST commits. | **MVP** | Medium — coordinates with REST bulk contract; blocks OFFLINE-03 |
| 3 | OFFLINE-03 | Add session undo/redo over buffered local Designer operations without server round-trips. | **MVP** | High after OFFLINE-02 — pure client |
| 4 | OFFLINE-04 | Merge server-ahead revisions into the buffered branch using existing conflict management flows. | **V2 (enterprise)** | Medium — depends on OFFLINE-02 + merge/conflict UI |

> **Note:** MVP ships a credible **buffered edit + persist + push** story; full **merge-ahead + conflict triage** may follow in V2 if scope or API gaps require it.

---

## GitHub labels

**Created for this pack** (if they did not already exist): `roadmap-offline`, `schema-designer`, `v2-enterprise`.

Apply to all issues in this pack:

- `epic` — parent umbrella (OFFLINE-R1 only)
- `roadmap-offline` — this roadmap
- `schema-designer` — Designer-only scope
- `enhancement`
- `browser`
- `versions` — version-control semantics

Per issue:

- `mvp` — [#2681](https://github.com/KenSuenobu/objectified-commercial/issues/2681), [#2682](https://github.com/KenSuenobu/objectified-commercial/issues/2682), [#2683](https://github.com/KenSuenobu/objectified-commercial/issues/2683); also `rest` on [#2682](https://github.com/KenSuenobu/objectified-commercial/issues/2682) (bulk API contract)
- `v2-enterprise` — [#2684](https://github.com/KenSuenobu/objectified-commercial/issues/2684) (merge-ahead + conflicts; enterprise track)

---

## Visual step-by-step testing plan

After each milestone below, run the **full** plan up to that milestone so regressions surface early.

### Milestone A — OFFLINE-01 (branch menu)

1. Open **Designer** (`/ade/studio` editor) with a schema loaded.
2. Locate the **upper-right** toolbar: **Layout** and **Export** (and related controls). Confirm a new **branch (git) icon** button sits **immediately beside** them (same row, consistent spacing).
3. Click the branch icon: a **dropdown/menu** opens.
4. For each menu entry (**Commit**, **Revert**, **Branch**, **Merge**, **Reset to version**, etc.):
   - If the action is **implemented** server-side today, the item is **enabled** and launches the **same flow** as elsewhere (or a thin wrapper).
   - If not available (e.g. offline-only buffer not ready), the item is **disabled** with a **tooltip** explaining why.
5. Resize the window to narrow width: menu remains usable (no overflow clipping).
6. Keyboard: tab to the branch button and open menu with Enter/Space where applicable.

### Milestone B — OFFLINE-02 (buffer + localStorage)

1. Make several class/property edits **without** triggering a manual commit (per new buffer rules).
2. Confirm **no** per-edit server commit occurs (network tab: batch or explicit commit only).
3. **Reload** the browser tab: pending edits **rehydrate** from **localStorage** (or documented storage key).
4. Use **Commit** (bulk): a **single** logical commit (or documented chunking) hits the API.
5. Simulate **quota exceeded** or **private mode**: app shows a **clear error** and does not silently drop work.

### Milestone C — OFFLINE-03 (undo/redo)

1. With a non-empty buffer, **Undo** repeatedly until empty; **Redo** restores operations in order.
2. After **bulk commit**, confirm undo stack policy (e.g. clears or marks “post-sync”) matches spec.
3. No network calls during undo/redo of **local** ops.,

### Milestone D — OFFLINE-04 (merge + conflicts)

1. User A pushes; User B has local buffer: **Merge** or **pull merge** offers **preview**.
2. On conflict, **existing conflict management** screens appear (side-by-side / resolution controls per current design).
3. After resolution, buffer + server state are **consistent**; push succeeds.

### Regression smoke (all milestones)

- **Layout** save and **Export** still work.
- **Versions** dashboard and existing banners (e.g. server-ahead) remain correct.
- Switching **branch/version** with unsaved buffer shows **guardrail** dialog per policy.

---

## Relationship to existing git-like work

Server and UI already implement much of **commit / push / pull / merge / branch / history** (see `docs/PLANNED_FEATURE_ROADMAP_GITLIKE.md` and closed issues in the commercial repo). This roadmap **does not** replace that stack; it adds a **client-side buffer and Designer entry point** so behavior matches **offline-first** and **bulk** semantics.

---

## Sub-issues under the epic

| Sub-issue | Roadmap ID | GitHub |
|-----------|------------|--------|
| Branch toolbar menu | OFFLINE-01 | [#2681](https://github.com/KenSuenobu/objectified-commercial/issues/2681) |
| Buffer + localStorage + bulk commit | OFFLINE-02 | [#2682](https://github.com/KenSuenobu/objectified-commercial/issues/2682) |
| Undo/redo | OFFLINE-03 | [#2683](https://github.com/KenSuenobu/objectified-commercial/issues/2683) |
| Merge server-ahead + conflicts | OFFLINE-04 | [#2684](https://github.com/KenSuenobu/objectified-commercial/issues/2684) |
