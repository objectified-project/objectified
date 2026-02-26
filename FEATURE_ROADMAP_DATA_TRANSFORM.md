# Objectified - Data Transform & Schema Migration Roadmap

> Roadmap for upgrading and migrating data stored in the Objectified Data offering when schema versions change. When new schemas are created and published (or frozen in Version), data in the database must be migrated from its old format to the new while preserving data maintainability and storage guarantees.
>
> **Last Updated**: February 2025  
> **Version**: 1.0 - Initial Data Transform Plan  
> **Relationship**: Complements [FEATURE_ROADMAP_DATABASE_DATA_STORAGE.md](FEATURE_ROADMAP_DATABASE_DATA_STORAGE.md); part of the Database/Data offering.

---

## Overview

This roadmap covers the **data transformation and migration layer** that sits between stored instance data and evolving schema versions. The Objectified Data offering stores instance data against **frozen** schema captures. When a version is published or a new schema capture is created:

- Existing instance data may no longer conform to the new schema (renamed properties, type changes, removed/added columns).
- Migration must be **explicit**, **auditable**, and **safe**: no silent data loss, no migration across incompatible major versions without explicit rules.
- Transformation can be multi-step (e.g., source → MongoDB → transform → PostgreSQL) and parallelized (e.g., via Spark) for scale.

**Guiding principles:**

- **Data maintainability**: Data is a first-class asset; schema changes must not drop or corrupt data without explicit translation or documented acceptance of loss.
- **Storage guarantees**: Migrations are transactional where possible; interim storage (e.g., MongoDB) is used only as a staging area with clear lifecycle.
- **Version discipline**: Major version boundaries (e.g., deleted classes, dropped properties without migration rules) block automatic migration and require human-defined rules or explicit acceptance.

---

## 1. Schema Comparison & Compatibility

> **Section Status**: 🔴 Not Started  
> **Priority**: Critical – Foundation for safe migration

When planning a migration from **source schema version** (e.g., schema_capture A) to **target schema version** (schema_capture B), the system must compare schemas and classify compatibility.

### 1.1 Schema Diff Engine

- **Class-level diff**: Which classes exist in both, only in source, only in target.
- **Property-level diff per class**: For each class present in both versions:
  - **Added**: Properties only in target → no data migration needed for existing rows; default or null handling.
  - **Removed**: Properties only in source → **must** have explicit migration rule (map to new property, archive, or accept drop) or migration is **blocked**.
  - **Renamed / type-changed**: Detected via naming heuristics, annotations, or explicit mapping; require translation rules.
- **Structural changes**: Nested object/array shape changes; impact on JSON Schema validation and required translation.
- **Output**: Machine-readable **compatibility report** (safe / unsafe / blocked) and list of required translation rules.

| Ticket | Feature Description |
|--------|---------------------|

### 1.2 Column/Property Deletion Policy

- **Strict mode**: Any property present in source but missing in target **blocks** migration until a rule is defined (map to new field, export to archive, or explicit “drop” with confirmation).
- **Report-only mode**: Generate report of “orphaned” source properties; migration may proceed with data loss documented.
- **Allow-list**: Only allow migration when target explicitly declares accepted removals (e.g., via migration manifest).
- **Audit**: All dropped or unmapped properties logged with counts and sample IDs for compliance.

| Ticket | Feature Description |
|--------|---------------------|

### 1.3 Backward Compatibility Checks

- Validate that target schema does not **delete classes** that still have instance data in source, unless:
  - A migration rule maps instances to another class, or
  - An explicit “purge or archive” decision is recorded.
- Integrate with versioning roadmap: **backward compatibility checker** ([PLANNED_FEATURE_ROADMAP_VERSIONING.md](PLANNED_FEATURE_ROADMAP_VERSIONING.md) #506) to flag breaking schema changes before publish.

| Ticket | Feature Description |
|--------|---------------------|

---

## 2. Data Translation Rules

> **Section Status**: 🔴 Not Started  
> **Priority**: Critical – Defines how data moves from old to new shape

Translation rules convert data from **existing properties** (source schema) to **new properties** (target schema). Rules are first-class configuration, versioned and auditable.

### 2.1 Rule Definition Model

- **Rule set**: Tied to (source_schema_capture_id, target_schema_capture_id) or (source_version_id, target_version_id).
- **Per-class rules**: Each class with instance data can have:
  - **Property mappings**: `source_property_path` → `target_property_path` (rename, move, copy).
  - **Transform functions**: Type coercion (string→number, date parsing), format changes, expressions (e.g., `concat(firstName, " ", lastName)` → `fullName`).
  - **Default / null handling**: What to write to target when source has no value or when property was removed.
- **Multi-step expressions**: Support for small expression language or script hooks (e.g., JavaScript/Python snippet or reference to registered transform) for complex logic.
- **Validation**: After applying rules, output must validate against target class JSON Schema; failed validation can be configured to reject row or send to error queue.

| Ticket | Feature Description |
|--------|---------------------|

### 2.2 Rule Authoring & Storage

- **UI**: Form or visual editor to define mappings and transforms per class (align with Import roadmap “Transformation Rules” and Batch Transform concepts in [FEATURE_ROADMAP_DATABASE_DATA_STORAGE.md](FEATURE_ROADMAP_DATABASE_DATA_STORAGE.md)).
- **API**: CRUD for migration rule sets; list rule sets by version pair.
- **Versioning**: Rule sets are versioned; each migration run records which rule set version was used.
- **Templates**: Reuse rule patterns across version pairs (e.g., “rename field A to B” template).

| Ticket | Feature Description |
|--------|---------------------|

### 2.3 Execution Semantics

- **Order**: Apply rules in defined order (e.g., renames first, then type transforms, then defaults).
- **Idempotency**: Where possible, transformations are idempotent so re-runs don’t double-apply.
- **Rollback**: Define rollback strategy (e.g., keep source data until target is verified; revert snapshot if validation fails).

| Ticket | Feature Description |
|--------|---------------------|

---

## 3. Major Version Safeguards

> **Section Status**: 🔴 Not Started  
> **Priority**: Critical – Prevents unsafe cross-version migration

Migration between **major** schema versions (e.g., where classes are deleted or large-scale breaking changes exist) must not run without explicit controls.

### 3.1 Version Semantics

- **Major / minor / patch**: Use semantic versioning or project-defined version policy for schema versions (link to [PLANNED_FEATURE_ROADMAP_VERSIONING.md](PLANNED_FEATURE_ROADMAP_VERSIONING.md)).
- **Major version**: Defined as “breaking” when:
  - One or more classes are removed.
  - One or more properties are removed without a defined migration rule.
  - Contract/API breaking changes are declared in version notes.
- **Migration policy**: Configurable per tenant or project:
  - **Allow same-major only**: Automatic migration only within same major version.
  - **Allow cross-major with full rule set**: Migration allowed only if every affected class has a complete rule set and no “blocked” compatibility items.
  - **Allow cross-major with approval**: Requires explicit approval workflow (e.g., admin approval, signed-off migration plan).

| Ticket | Feature Description |
|--------|---------------------|

### 3.2 Blocking Conditions

- **Deleted classes**: If source version has instances for class C and target version has no class C (and no “map to other class” rule), migration is **blocked** until:
  - Rule set adds “archive instances of C” or “map to class D”, or
  - Admin explicitly accepts data loss for that class and records reason.
- **Missing translation rules**: Any property that exists in source but not in target, and has no rule (map, default, or explicit drop), blocks migration.
- **Audit**: All blocked migrations and overrides (accepted data loss) logged with who, when, and reason.

| Ticket | Feature Description |
|--------|---------------------|

---

## 4. Visual Migration Step Plans

> **Section Status**: 🔴 Not Started  
> **Priority**: High – Clarity and auditability

Users and operators need a **visual representation** of migration steps: where data lives at each stage and how it moves.

### 4.1 Migration Plan Model

- **Steps**: Ordered list of steps, e.g.:
  1. Export from PostgreSQL (source version) → **interim store** (e.g., MongoDB).
  2. Transform in interim store (apply translation rules, validate).
  3. Load from interim store → PostgreSQL (target version / new schema capture).
  4. Verify (counts, checksums, sample validation).
- **Data locations**: Each step has “data in” and “data out” locations (e.g., “PostgreSQL instance_snapshot” → “MongoDB collection X” → “PostgreSQL instance_snapshot (new capture)”).
- **Dependencies**: Steps can depend on previous steps; parallelization boundaries (e.g., “after step 2, run step 3 in parallel per partition”).

| Ticket | Feature Description |
|--------|---------------------|

### 4.2 Visual Representation

- **Flow diagram**: Visual migration step plan showing:
  - Source DB and schema version.
  - Interim store (e.g., MongoDB) with collection/namespace.
  - Transform step (rules applied).
  - Target DB and schema version.
  - Arrows labeled with record counts or “N instances”.
- **Per-step status**: When a migration is run, each step shows status (pending / running / completed / failed) and duration.
- **Export**: Export diagram as image or document for change management / runbooks.

| Ticket | Feature Description |
|--------|---------------------|

### 4.3 Runbook Integration

- **One-click or API-triggered run**: Execute migration plan (or dry-run) from UI or API.
- **Pause / resume**: Pause after a step (e.g., after export to MongoDB) for manual checks before continuing.
- **Rollback plan**: Documented or automated rollback (e.g., discard target data and keep source; restore from MongoDB if needed).

| Ticket | Feature Description |
|--------|---------------------|

---

## 5. MongoDB as Interim Database

> **Section Status**: 🔴 Not Started  
> **Priority**: High – Enables flexible multi-step transforms

Using **MongoDB** as an interim store between transformation steps allows:

- **Decoupling**: Read from PostgreSQL, write to MongoDB; run transforms (or Spark jobs) against MongoDB without blocking primary store.
- **Schema flexibility**: JSON documents in MongoDB can hold denormalized or intermediate shapes during transformation.
- **Resumability**: If a later step fails, data remains in MongoDB until the pipeline is fixed and re-run.

### 5.1 Interim Store Lifecycle

- **Create**: Allocate MongoDB database/collection(s) for a given migration plan (e.g., one collection per source class or one DB per migration run).
- **Write**: Export from PostgreSQL (source) into MongoDB (document per instance or batched).
- **Transform**: Apply translation rules (via application code or Spark) reading from and writing to MongoDB (or read MongoDB, write to PostgreSQL in one step).
- **Read for load**: Load from MongoDB into PostgreSQL (target schema capture).
- **Retention**: Configurable retention (e.g., delete MongoDB data 7 days after successful migration, or after explicit “confirm and cleanup”).
- **Security**: Encryption at rest and in transit; access scoped to migration service; no long-term PII in interim store beyond retention.

| Ticket | Feature Description |
|--------|---------------------|

### 5.2 Schema in MongoDB

- **Document shape**: Store instance id, version, current_data (JSON), and metadata (source_capture_id, class_id, etc.) so that transforms and load step have full context.
- **Indexes**: Index by class_id, instance_id, and any partition keys used by Spark for parallelization.
- **Idempotency**: Use instance_id (or composite key) as `_id` or unique index so re-runs don’t duplicate documents.

| Ticket | Feature Description |
|--------|---------------------|

### 5.3 Integration with Migration Steps

- **Step 1 (Export)**: PostgreSQL → MongoDB; job type “migration_export” in batch API.
- **Step 2 (Transform)**: MongoDB → MongoDB (or MongoDB → PostgreSQL); job type “migration_transform”.
- **Step 3 (Load)**: MongoDB → PostgreSQL; job type “migration_load”.
- **Step 4 (Verify & cleanup)**: Compare counts, optionally checksums; then trigger MongoDB retention/cleanup.

| Ticket | Feature Description |
|--------|---------------------|

---

## 6. Spark for Parallel Migration

> **Section Status**: 🔴 Not Started  
> **Priority**: High – Scale and performance

Use **Apache Spark** to run migration in parallel: partition instance data (e.g., by instance_id or class_id), run translation and load per partition, and aggregate results.

### 6.1 Spark Job Design

- **Data source**: Read from MongoDB (MongoDB Spark Connector) or from PostgreSQL export (e.g., Parquet/JSONL in object storage) for maximum throughput.
- **Partitioning**: Partition by instance_id hash or class_id so that each partition can be processed independently.
- **Transformation**: Apply translation rules inside Spark (UDFs or DataFrame operations); validate against target schema (e.g., broadcast target JSON Schema and validate in worker).
- **Sink**: Write to MongoDB (interim) or directly to PostgreSQL (via JDBC or bulk load API) per partition.
- **Job orchestration**: Triggered by migration step plan (e.g., “Step 2: Run Spark job migration_transform_xyz”).

| Ticket | Feature Description |
|--------|---------------------|

### 6.2 Error Handling & Observability

- **Failed records**: Rows that fail validation or transform go to an error dataset (e.g., separate MongoDB collection or table); migration report lists count and sample.
- **Progress**: Spark job progress reported back to Objectified (e.g., via callback or polling Spark status); surface in migration step status.
- **Resource control**: Configurable Spark executor count and memory so migrations don’t overwhelm shared clusters.

| Ticket | Feature Description |
|--------|---------------------|

### 6.3 Optional: Spark as Only Transform Engine

- **Single engine**: Use Spark for both “transform” and “load” (read MongoDB → transform → write PostgreSQL) to simplify pipeline and reuse parallelism.
- **Consistency**: Same translation rule execution whether run in app server or Spark; rules should be defined in a shared format (e.g., JSON config or code generated from Objectified rule set).

| Ticket | Feature Description |
|--------|---------------------|

---

## 7. Integration with Database Data Storage Roadmap

This transform roadmap integrates with [FEATURE_ROADMAP_DATABASE_DATA_STORAGE.md](FEATURE_ROADMAP_DATABASE_DATA_STORAGE.md) as follows:

- **Schema capture**: Source and target are schema_capture (or schema_capture_class) entities; migration is always “from capture A to capture B.”
- **Instance & instance_snapshot**: Export reads from instance_snapshot (and optionally instance_data for history); load writes new instance and instance_data (CREATE) and instance_snapshot.
- **Batch jobs**: Migration runs as batch jobs (job_type e.g. `migration_export`, `migration_transform`, `migration_load`); reuse batch job lifecycle, status, and progress APIs.
- **Batch Transform**: Align translation rule format and execution with existing “Batch Transform Jobs” where possible (field-level operations, preview, dry-run).
- **Schema evolution**: The “Schema Evolution” section in the database roadmap (migration scripts, data transformation, backwards compatibility) is implemented by this transform roadmap.

---

## 8. Data Maintainability & Storage Guarantees

### 8.1 Guarantees

- **No silent data loss**: Migration does not drop columns or classes without explicit rules or explicit acceptance (with audit).
- **Traceability**: Every migrated instance can be traced back to source instance_id and version; migration run id and rule set version stored with target data.
- **Rollback**: Design supports rollback (e.g., keep source data until target is verified; retain interim MongoDB for a retention window).
- **Validation**: Data written to target is validated against target schema; failures are reported and optionally quarantined.

### 8.2 Operational Requirements

- **Backup**: Source data should be backed up before migration; interim MongoDB included in backup/retention policy if it holds canonical copy during pipeline.
- **Compliance**: Migration audit log supports compliance (who migrated what, when, which rules, any overrides).
- **SLA**: Document expected duration and resource usage for migration (e.g., “N instances in M minutes with Spark cluster of size X”).

---

## 9. Implementation Notes

### 9.1 Technology Stack (Proposed)

- **Schema diff**: Custom (JSON Schema comparison) or existing lib (e.g., json-schema-diff); Python or Node depending on Objectified backend.
- **Rule engine**: In-app (Python/Node) for small runs; Spark for large runs; rule format shared (e.g., JSON).
- **Interim store**: MongoDB (Atlas or self-hosted); use official MongoDB Spark Connector for Spark reads/writes.
- **Orchestration**: Reuse batch job system; optional integration with workflow engine (e.g., Airflow, Step Functions) for multi-step plans.
- **Spark**: Apache Spark 3.x; cluster managed by customer or Objectified-managed (e.g., EMR, Databricks) depending on offering tier.

### 9.2 Phasing Suggestion

1. **Phase 1**: Schema comparison and compatibility report; translation rule definition and in-process execution (no MongoDB/Spark).
2. **Phase 2**: Major version safeguards and blocking conditions; visual migration step plan (design-time).
3. **Phase 3**: MongoDB interim store and export/load steps; run migration plan with interim store.
4. **Phase 4**: Spark-based parallel transform and load; full pipeline with Spark and MongoDB.

---

## 10. Open Questions & Future Work

- **Multi-tenant MongoDB**: Single shared MongoDB cluster vs per-tenant databases for interim data.
- **Spark offering**: Whether Objectified provides Spark as a managed service or only defines the contract for customer-run Spark jobs.
- **Real-time vs batch**: This roadmap is batch-focused; future consideration for near-real-time schema evolution (e.g., dual-write, gradual cutover).
- **Versioning of rule sets**: Granularity (per version pair vs reusable templates) and promotion from dev to prod.

---

*This roadmap is a living document and will be updated as the Database Data Storage offering is refined and implementation proceeds.*
