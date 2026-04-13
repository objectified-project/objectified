# Publication change reports — epics, tickets, and testing

**Pack:** `docs/FUTURE_FEATURE_CHANGE_REPORTS.md`  
**GitHub label:** `roadmap-change-reports` (plus per-issue labels; see below)  
**Repository:** [KenSuenobu/objectified-commercial](https://github.com/KenSuenobu/objectified-commercial)

This document lists **epics**, **implementation tickets** (in **GitHub creation order**), how features should be **tested**, and ASCII **diagrams** for quick visual review. Issue bodies on GitHub are authoritative for acceptance text; this file is the **roadmap index**.

---

## Labels applied

| Label | Purpose |
|-------|---------|
| `roadmap-change-reports` | This feature pack |
| `epic` | Umbrella issue CR-R1 only |
| `mvp` | MVP-first-release scope (CR-01 … CR-06) |
| `v2-enterprise` | Enterprise / post-MVP (**CR-V2-01**) |
| Per-area | `diff`, `rest`, `database`, `templates`, `git-behavior`, `browser`, `ui`, `versions`, `testing`, `governance`, `enterprise-hub`, `tenancy`, `version-control`, `python`, `enhancement` |

**Created for this pack:** `roadmap-change-reports` (other labels reused from the repo where they already existed).

---

## Epic — CR-R1

**Major feature change:** Introduce **publication change reports**: semantic **OpenAPI diff** between a **baseline** and **candidate** resolved spec at publish time, rendered into a **header / body / footnote** report, **persisted** per published version, and shown on the **Version** page with **edit** flows for the **report instance** and **template**.

| Role | Issue | Title (one sentence) |
|------|------:|----------------------|
| **Epic** | [#2698](https://github.com/KenSuenobu/objectified-commercial/issues/2698) | Epic: Publication change reports — OpenAPI diff to human-readable reports on the Version page (CR-R1). |

**Tickets in this epic (MVP + V2):** [#2699](https://github.com/KenSuenobu/objectified-commercial/issues/2699) [#2700](https://github.com/KenSuenobu/objectified-commercial/issues/2700) [#2701](https://github.com/KenSuenobu/objectified-commercial/issues/2701) [#2702](https://github.com/KenSuenobu/objectified-commercial/issues/2702) [#2703](https://github.com/KenSuenobu/objectified-commercial/issues/2703) [#2704](https://github.com/KenSuenobu/objectified-commercial/issues/2704) [#2705](https://github.com/KenSuenobu/objectified-commercial/issues/2705)

### ASCII: epic scope

```
  Publish spec  --->  [ Diff + template + persist ]  --->  Version page
                              ^
                              |
                       baseline vs candidate
                       (resolved OpenAPI)
```

---

## Tickets in creation order (dependency-oriented)

| Order | Roadmap ID | Issue | MVP / V2 |
|------:|------------|-------|----------|
| 1 | CR-01 | [#2699](https://github.com/KenSuenobu/objectified-commercial/issues/2699) Semantic OpenAPI diff engine produces ChangeReportModel for publication change reports | **MVP** |
| 2 | CR-02 | [#2700](https://github.com/KenSuenobu/objectified-commercial/issues/2700) Persist change report artifacts, edits, and template links per published revision | **MVP** |
| 3 | CR-03 | [#2701](https://github.com/KenSuenobu/objectified-commercial/issues/2701) Change report template system with header, body, and footnote rendering | **MVP** |
| 4 | CR-04 | [#2702](https://github.com/KenSuenobu/objectified-commercial/issues/2702) Invoke change report generation from the publication workflow with baseline selection | **MVP** |
| 5 | CR-05 | [#2703](https://github.com/KenSuenobu/objectified-commercial/issues/2703) Version page UI to view, edit, and regenerate publication change reports | **MVP** |
| 6 | CR-06 | [#2704](https://github.com/KenSuenobu/objectified-commercial/issues/2704) Tests and release gate for publication change reports (golden fixtures, REST, E2E) | **MVP** |
| 7 | CR-V2-01 | [#2705](https://github.com/KenSuenobu/objectified-commercial/issues/2705) Enterprise change reports: PDF export, approvals, and audit trail for report and template edits | **V2** |

---

## How each feature should be tested

### CR-01 — Diff engine ([#2699](https://github.com/KenSuenobu/objectified-commercial/issues/2699))

- **Unit:** Golden JSON pairs → `ChangeReportModel` snapshots; cover schema add/remove, property type change, `$ref` change, `info` description change.
- **Property:** Deterministic output (same input → same JSON); sorted ordering for collections.
- **Manual:** Run engine against two exported Studio OpenAPI snapshots and eyeball structure.

```
  fixture A + fixture B  -->  pytest  -->  snapshot ChangeReportModel
```

### CR-02 — Persistence ([#2700](https://github.com/KenSuenobu/objectified-commercial/issues/2700))

- **Integration:** Migration up/down on dev DB; `GET` report after seed.
- **Auth:** Negative tests for wrong tenant / role.
- **Manual:** `curl` or REST client against documented routes.

```
  seed publish  -->  GET change-report  -->  PATCH  -->  GET (edited)
```

### CR-03 — Templates ([#2701](https://github.com/KenSuenobu/objectified-commercial/issues/2701))

- **Unit:** Render golden `ChangeReportModel` through default template; snapshot HTML/Markdown.
- **Validation:** Invalid template produces clear error (no server 500).
- **Manual:** Edit template with intentional typo → recover.

```
  ChangeReportModel  -->  template engine  -->  rendered artifact
```

### CR-04 — Publish hook ([#2702](https://github.com/KenSuenobu/objectified-commercial/issues/2702))

- **Integration:** Full publish flow in test env → DB row for `change_report` with expected revision IDs.
- **Edge:** First publish (no baseline) yields defined narrative, not crash.
- **Manual:** Publish from UI; refresh Version page.

```
  UI publish  -->  REST  -->  workflow_audit?  -->  report row
```

### CR-05 — Version page UI ([#2703](https://github.com/KenSuenobu/objectified-commercial/issues/2703))

- **Component:** Storybook or shallow tests optional (if project uses them).
- **E2E (Playwright):** Login → navigate to Version → report visible → edit save → reload verifies persistence.
- **A11y:** Smoke keyboard navigation on tab panel.

```
  User  -->  Version page  -->  Report tab  -->  Edit  -->  API PATCH
```

### CR-06 — Release gate ([#2704](https://github.com/KenSuenobu/objectified-commercial/issues/2704))

- **CI:** All new tests green on PR touching `objectified-rest` / `objectified-ui` as applicable.
- **Regression:** Re-run golden suite after template tweak.

```
        /--> unit (diff)
  CI --+--> REST int
        \--> Playwright E2E (seeded)
```

### CR-V2-01 — Enterprise ([#2705](https://github.com/KenSuenobu/objectified-commercial/issues/2705))

- **Integration:** Approval state transitions only with correct role; PDF byte-stable for golden report.
- **Audit:** Query audit API for template edit events.
- **Manual:** Approve → external viewer sees report; export PDF matches.

```
  Draft report  -->  approve  -->  visible  -->  PDF hash recorded
```

---

## MVP vs V2 summary

| Item | In first major public release (MVP) |
|------|-------------------------------------|
| CR-01 … CR-06 | **Yes** |
| CR-V2-01 | **No** (enterprise-focused follow-on) |

---

## Revision

Update this file when GitHub issues are **closed**, **rescoped**, or **split**.
