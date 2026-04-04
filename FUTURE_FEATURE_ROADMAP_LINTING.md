# Objectified: Schema Linting & Quality Scoring - Feature Roadmap

> A real-time schema linting engine and quality scoring system that continuously evaluates schema design, documentation coverage, API best practices, security posture, and performance patterns. Surfaces actionable feedback inline in the studio editor and provides a quantitative quality score for tracking improvement over time.
>
> **Revenue Model**: Basic linting in Free tier; custom rule engine, team-shared lint configs, score history, and PDF export gated at Pro/Enterprise
>
> **Tech Stack**: NextJS App Router, TypeScript rules engine, PostgreSQL (score history), Radix UI, OpenAPI 3.1, PDF generation via Puppeteer

---

## MVP Definition

- Real-time validation with red/yellow squiggles as the schema is edited
- Overall quality score (0–100) displayed in the studio header, updating live
- Score breakdown by category: Design Quality, Documentation, API Best Practices, Security, Performance
- Color-coded score indicator (green/yellow/orange/red) with gauge visualization
- Core naming convention and documentation rules enforced by default
- Circular dependency detection and unused class detection
- Historical score tracking persisted per schema version

---

## Epic 1 (#1698): Real-Time Validation Engine

### Summary Table

| #   | Title                                  | Description                                                                     | Labels                                       | MVP | Parallel |
|-----|----------------------------------------|---------------------------------------------------------------------------------|----------------------------------------------|-----|----------|
| 1.1 (#1700) | Live Schema Validation Infrastructure  | Event-driven validation pipeline that runs rules on every schema change event   | `enhancement`, `mvp`, `linting`             | Yes | No       |
| 1.2 (#1702) | Red/Yellow Squiggle Annotations        | Inline error (red) and warning (yellow) markers in the schema editor canvas     | `enhancement`, `mvp`, `linting`             | Yes | No       |
| 1.3 (#1704) | Hover Tooltip for Errors               | Hover over squiggle to see rule name, message, severity, and quick fix options  | `enhancement`, `mvp`, `linting`             | Yes | Yes      |
| 1.4 (#1706) | Quick Fix Suggestions                  | One-click auto-fix for common lint issues (add missing description, rename)     | `enhancement`, `linting`                    | No  | Yes      |
| 1.5 (#1708) | Validation Summary Panel               | Sidebar panel listing all current errors and warnings with click-to-navigate    | `enhancement`, `mvp`, `linting`             | Yes | No       |
| 1.6 (#1710) | Naming Convention Rules                | Enforce PascalCase classes, camelCase properties, max name length, no abbrevs   | `enhancement`, `mvp`, `linting`             | Yes | Yes      |
| 1.7 (#1712) | Required Description Rules             | Warn when a class has no description (< 20 chars) or property has none (< 10)  | `enhancement`, `mvp`, `linting`             | Yes | Yes      |
| 1.8 (#1714) | Circular Dependency Detection          | Detect and report circular references across class relationships                | `enhancement`, `mvp`, `linting`             | Yes | No       |
| 1.9 (#1716) | Unused Class Detection                 | Flag classes defined in the schema that are never referenced by any other class | `enhancement`, `linting`                    | No  | Yes      |
| 1.10 (#1718) | Deprecated Pattern Detection           | Detect use of known deprecated patterns and suggest modern alternatives         | `enhancement`, `linting`                    | No  | Yes      |

### Detailed Issue Descriptions

#### 1.1 (#1700) — Live Schema Validation Infrastructure

Build the core validation pipeline that triggers rule evaluation on every schema mutation event. The pipeline receives a diff of the changed schema, runs all enabled rules against the affected nodes, and produces a `ValidationResult[]` array. Results are stored in component state and consumed by the annotation and summary panel components. The pipeline must complete in < 100ms for schemas under 500 classes to maintain a real-time feel.

```
Schema Edit Event
       │
       ▼
  Diff Engine (changed nodes)
       │
       ▼
  Rule Runner (parallel per rule)
  ┌──────────┬──────────┬──────────┐
  │ Naming   │ Docs     │ Circular │ ...
  └──────────┴──────────┴──────────┘
       │
       ▼
  ValidationResult[]
  { nodeId, ruleName, severity, message, fixable }
       │
       ├──▶ Editor Annotation Layer (squiggles)
       └──▶ Summary Panel Store
```

**Acceptance Criteria:**
- Rule pipeline runs on every schema change with debounce of 300ms
- Runs in < 100ms for schemas with ≤ 500 classes (measured in CI benchmark)
- Results include `nodeId`, `ruleName`, `severity` (error | warning | info), `message`, and `fixable` boolean
- Rules can be disabled individually via tenant lint configuration

**Tech Stack:** TypeScript, Web Worker (offload from main thread), JSON Patch diffing

Part of Epic: Real-Time Validation Engine

---

#### 1.8 (#1714) — Circular Dependency Detection

Implement a directed graph cycle detection algorithm (DFS with color marking) over the class relationship graph. When a cycle is detected, report every class in the cycle as an error, and include the full cycle path in the error message so the developer knows exactly which classes to unlink.

```
ClassA → ClassB → ClassC → ClassA  ← circular!

Error on ClassA: "Circular dependency detected: ClassA → ClassB → ClassC → ClassA"
Error on ClassB: "Part of circular dependency chain (see ClassA)"
```

**Acceptance Criteria:**
- Cycle detection runs in O(V + E) using DFS coloring
- All classes in a detected cycle are annotated with an error
- Error message includes the full cycle path
- Schema with no cycles produces zero circular-dependency errors
- Works correctly with multi-hop cycles (A → B → C → A and A → B → A)

**Tech Stack:** TypeScript graph traversal, adjacency list derived from schema relationship definitions

Part of Epic: Real-Time Validation Engine

---

## Epic 2 (#1720): Quality Scoring System

### Summary Table

| #   | Title                                  | Description                                                                       | Labels                                 | MVP | Parallel |
|-----|----------------------------------------|-----------------------------------------------------------------------------------|----------------------------------------|-----|----------|
| 2.1 (#1722) | Real-Time Score Calculation Engine     | Compute quality score (0–100) from weighted category sub-scores on every change   | `enhancement`, `mvp`, `linting`       | Yes | No       |
| 2.2 (#1724) | Score Display in Studio Header         | Prominently display current score in the studio header, updating in real time     | `enhancement`, `mvp`, `linting`       | Yes | No       |
| 2.3 (#1726) | Score Breakdown by Category            | Expandable breakdown panel: Design (30), Docs (20), API (25), Security (15), Perf (10) | `enhancement`, `mvp`, `linting`  | Yes | No       |
| 2.4 (#1728) | Historical Score Tracking              | Persist quality score snapshot on each schema version save; display trend chart   | `enhancement`, `mvp`, `linting`, `rest` | Yes | No     |
| 2.5 (#1730) | Color-Coded Score Indicator            | Green (90–100), Yellow (70–89), Orange (50–69), Red (0–49) badge on score display | `enhancement`, `mvp`, `linting`       | Yes | Yes      |
| 2.6 (#1732) | Animated Score Gauge                   | Radial gauge component with smooth transition animations when score changes        | `enhancement`, `linting`              | No  | Yes      |
| 2.7 (#1733) | Score Comparison Across Versions       | Side-by-side or overlay chart comparing quality scores across schema versions     | `enhancement`, `linting`              | No  | Yes      |
| 2.8 (#1734) | Team Average Score Benchmarking        | Display org-wide average score alongside project score for context                | `enhancement`, `linting`              | No  | Yes      |
| 2.9 (#1735) | Score Report Export as PDF             | Generate a PDF report of the quality score breakdown and historical trend         | `enhancement`, `linting`              | No  | Yes      |
| 2.10 (#1736) | Schema Statistics Dashboard            | API surface area, class count, property count, depth distribution summary        | `enhancement`, `linting`              | No  | Yes      |

### Detailed Issue Descriptions

#### 2.1 (#1722) — Real-Time Score Calculation Engine

The quality score is a weighted sum of five category sub-scores. Each category score ranges from 0–100 and is weighted to produce the composite:

| Category          | Weight | Max Points |
|-------------------|--------|-----------|
| Design Quality    | 30%    | 30        |
| Documentation     | 20%    | 20        |
| API Best Practices| 25%    | 25        |
| Security          | 15%    | 15        |
| Performance       | 10%    | 10        |

Each active rule contributes a point deduction when violated. The scoring engine normalizes deductions against the maximum possible deductions per category so the score is always between 0 and 100, even for schemas with very few elements.

**Acceptance Criteria:**
- Score recalculates within 200ms of any schema change
- Score is deterministic: same schema always produces same score
- Category sub-scores are individually accessible via the breakdown panel
- Scores persisted to `schema_quality_score` table on each version save

**Tech Stack:** TypeScript, PostgreSQL (`schema_quality_score` table)

Part of Epic: Quality Scoring System

---

#### 2.4 (#1728) — Historical Score Tracking

Persist a quality score snapshot every time a schema version is saved. Store: `schema_id`, `version_id`, `tenant_id`, `score`, `breakdown_json` (per-category scores), `rule_violations_json` (list of active violations), and `calculated_at`. Expose the history as a time-series REST endpoint and render as a line chart in the scoring panel.

```
┌────────────────────────────────────────┐
│  schema_quality_score                  │
├────────────────────────────────────────┤
│ id              UUID PK                │
│ schema_id       UUID FK                │
│ version_id      UUID FK                │
│ tenant_id       UUID FK                │
│ score           SMALLINT (0–100)       │
│ breakdown_json  JSONB                  │
│ violations_json JSONB                  │
│ calculated_at   TIMESTAMPTZ            │
└────────────────────────────────────────┘
```

**OpenAPI Endpoints:**
```
GET /api/v1/schemas/{id}/quality-history
  ?from=...&to=...&limit=100
  → 200: QualityScoreHistory[]
```

**Acceptance Criteria:**
- Snapshot saved atomically with schema version save (same transaction)
- History endpoint returns scores in chronological order
- Data retained indefinitely (no TTL by default)
- Chart renders correctly with as few as 1 and as many as 365 data points

**Depends on:** 2.1 (scoring engine must exist)

Part of Epic: Quality Scoring System

---

## Epic 3 (#1737): Validation Rules Engine

### Summary Table

| #   | Title                                      | Description                                                                      | Labels                           | MVP | Parallel |
|-----|--------------------------------------------|----------------------------------------------------------------------------------|----------------------------------|-----|----------|
| 3.1 (#1738) | Naming Convention Rules Set                | PascalCase classes, camelCase properties, no abbreviations, max length          | `enhancement`, `mvp`, `linting` | Yes | Yes      |
| 3.2 (#1739) | Documentation Rules Set                    | Min description length per class/property, at least one example per class       | `enhancement`, `mvp`, `linting` | Yes | Yes      |
| 3.3 (#1740) | Schema Design Rules Set                    | Max nesting depth, no primitive obsession, consistent composition patterns       | `enhancement`, `linting`        | No  | Yes      |
| 3.4 (#1741) | API Design Rules Set                       | RESTful URL patterns, correct HTTP methods, pagination required for lists       | `enhancement`, `linting`        | No  | Yes      |
| 3.5 (#1742) | Security Rules Set                         | Auth required for non-public endpoints, sensitive fields writeOnly, no PII in URLs | `enhancement`, `linting`, `security` | No | Yes |
| 3.6 (#1743) | Performance Rules Set                      | Response size limits, cache headers required, ETag/conditional requests support | `enhancement`, `linting`        | No  | Yes      |
| 3.7 (#1744) | Lint Rule Configuration UI                 | Per-project rule toggle, severity override (error → warning), and global defaults | `enhancement`, `linting`       | No  | No       |
| 3.8 (#1745) | Custom Rule Builder                        | UI and TypeScript sandbox for authoring custom validation rules                 | `enhancement`, `linting`        | No  | No       |
| 3.9 (#1746) | Shared Lint Configurations                 | Save and share named rule configurations across projects and teams              | `enhancement`, `linting`        | No  | Yes      |
| 3.10 (#1747) | Rule Set Import/Export                    | Export rule configs as JSON; import from file or URL                            | `enhancement`, `linting`        | No  | Yes      |
| 3.11 (#1748) | Rule Templates Library                    | Pre-built rule configs: REST API Best Practices, Healthcare, Finance, etc.      | `enhancement`, `linting`        | No  | Yes      |

### Detailed Issue Descriptions

#### 3.7 (#1744) — Lint Rule Configuration UI

Provide a settings page (`/settings/linting`) where project owners can toggle individual rules on/off, override severity (change an error to a warning or silence it), and set rule parameters (e.g., minimum description length). Changes apply immediately to real-time validation. Configuration is stored per-project in `lint_config_json` on the project record.

```
Settings → Linting
┌──────────────────────────────────────────────────────┐
│  Lint Rules                              [Save]       │
├──────────────────────────────────────────────────────┤
│  ○ Naming Conventions                    [Preset ▼]  │
│  ├── PascalCase class names  [✓ ON]  Severity: Error │
│  ├── camelCase properties    [✓ ON]  Severity: Error │
│  └── Max name length (40)    [✓ ON]  Value: [40]     │
├──────────────────────────────────────────────────────┤
│  ○ Documentation                                     │
│  ├── Min class description   [✓ ON]  Min chars: [20] │
│  └── Example required        [○ OFF]                 │
└──────────────────────────────────────────────────────┘
```

**Acceptance Criteria:**
- Rule toggle changes take effect on next schema validation run (no page reload)
- Severity override persists in project settings
- Default configuration matches opinionated best-practice defaults
- Admin can set org-wide defaults that projects can optionally override

**Depends on:** 1.1 (rule pipeline must support per-rule enable/disable)

Part of Epic: Validation Rules Engine

---

#### 3.8 (#1745) — Custom Rule Builder

Provide a sandboxed TypeScript editor where developers can write custom validation rules. Each rule is a TypeScript function receiving the schema graph and returning `ValidationResult[]`. Rules are compiled and run in a secure sandboxed environment (VM module or isolated iframe). The builder includes a test panel for running the rule against the current schema.

```typescript
// Example custom rule
export default function noSnakeCaseProperties(schema: Schema): ValidationResult[] {
  return schema.classes.flatMap(cls =>
    cls.properties
      .filter(p => p.name.includes('_'))
      .map(p => ({
        nodeId: p.id,
        ruleName: 'no-snake-case-properties',
        severity: 'warning',
        message: `Property "${p.name}" uses snake_case; prefer camelCase`,
        fixable: false,
      }))
  );
}
```

**Acceptance Criteria:**
- Custom rules are isolated from host environment (no filesystem/network access)
- Rule compilation errors surface as readable TypeScript diagnostics in the editor
- Custom rules participate in the quality score calculation
- Rules can be tested against the current schema in the builder panel before saving

Part of Epic: Validation Rules Engine

---

## Epic 4 (#1749): Schema Intelligence & Analysis

### Summary Table

| #   | Title                               | Description                                                                    | Labels                           | MVP | Parallel |
|-----|-------------------------------------|--------------------------------------------------------------------------------|----------------------------------|-----|----------|
| 4.1 (#1750) | Complexity Score Metric             | Per-schema complexity: depth × property count × relationship count, color coded | `enhancement`, `linting`        | No  | Yes      |
| 4.2 (#1751) | Maintainability Index               | Composite score: documentation coverage + consistency + size penalties         | `enhancement`, `linting`        | No  | Yes      |
| 4.3 (#1752) | Reusability Score                   | Measure coupling and dependency count to assess how reusable classes are        | `enhancement`, `linting`        | No  | Yes      |
| 4.4 (#1753) | Documentation Coverage Metric       | Percentage of classes and properties with descriptions and examples            | `enhancement`, `mvp`, `linting` | Yes | Yes      |
| 4.5 (#1754) | Dependency Graph Visualization      | Interactive directed graph showing class-to-class relationships and depth      | `enhancement`, `linting`        | No  | No       |
| 4.6 (#1755) | Orphaned Property Detection         | Detect properties with no type reference and no usage in any schema path       | `enhancement`, `linting`        | No  | Yes      |
| 4.7 (#1756) | Duplicate Class Detection           | Flag classes with > 80% structural similarity as potential duplicates           | `enhancement`, `linting`        | No  | Yes      |
| 4.8 (#1757) | Breaking Change Detection           | Compare schema versions and flag any removals or type changes as breaking      | `enhancement`, `linting`, `rest` | No | Yes      |
| 4.9 (#1758) | API Surface Area Calculation        | Count of public endpoints, operations, and request/response type coverage      | `enhancement`, `linting`        | No  | Yes      |

### Detailed Issue Descriptions

#### 4.5 (#1754) — Dependency Graph Visualization

Render the schema's class dependency graph as an interactive force-directed or hierarchical layout. Nodes represent classes; edges represent relationships. Node color indicates complexity score (green → red). Clicking a node highlights its direct dependencies and dependents. Zoom, pan, and filter by subsystem.

```
         ┌──────────┐
         │   Order  │◄──────────────┐
         └────┬─────┘               │
              │ has                 │ placed by
              ▼                     │
         ┌──────────┐         ┌──────────┐
         │OrderItem │         │  User    │
         └────┬─────┘         └──────────┘
              │ references
              ▼
         ┌──────────┐
         │ Product  │
         └──────────┘
```

**Acceptance Criteria:**
- Graph renders for schemas up to 300 classes without performance degradation
- Cycle edges highlighted in red
- Clicking a node dims unrelated nodes (focus mode)
- Graph exports as SVG or PNG

**Depends on:** 1.8 (cycle detection), 1.1 (validation pipeline)

Part of Epic: Schema Intelligence & Analysis

---

#### 4.8 (#1757) — Breaking Change Detection

Compare two schema versions and produce a diff report categorizing each change as: `non-breaking` (additive), `potentially-breaking` (deprecation, type widening), or `breaking` (removal, type narrowing, rename). Surface breaking changes as errors in the validation panel and expose via REST for CI integration.

**OpenAPI Endpoints:**
```
GET /api/v1/schemas/{id}/breaking-changes
  ?from_version=...&to_version=...
  → 200: BreakingChangeDiff

POST /api/v1/schemas/{id}/versions/{v}/validate-breaking
  → 200: BreakingChangeSummary
```

**Acceptance Criteria:**
- Removal of a required property classified as `breaking`
- Addition of a new optional property classified as `non-breaking`
- Change of property type from `string` to `integer` classified as `breaking`
- Report includes the specific field path and a human-readable explanation for each change
- CI webhook integration: POST result to a configurable URL on each version comparison

Part of Epic: Schema Intelligence & Analysis
