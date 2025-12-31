# Objectified - Database Data Storage Feature Roadmap

> Comprehensive roadmap for enterprise-level data storage functionality using event-sourced architecture
> 
> **Last Updated**: December 30, 2025
> **Version**: 1.0 - Initial Data Storage Architecture
> **Primary Technologies**: Python, PostgreSQL, JSON Schema Validation

---

## Overview

This roadmap covers the data storage layer of Objectified, which enables storing actual data instances against frozen schema definitions. The architecture follows an event-sourced pattern where:

- **Schema Capture**: Frozen/immutable snapshots of version schemas
- **Schema Capture Class**: Individual class definitions with full JSON Schema
- **Instance**: Logical data object tied to a schema class
- **Instance Data**: Event-sourced versioned data (CREATE/UPDATE/DELETE actions)
- **Instance Snapshot**: Materialized current state for O(1) reads

---

## 🗄️ Core Data Storage Engine

> **Section Status**: 🔴 Not Started
> **Priority**: Critical - Foundation for all data operations

### Schema Capture & Freezing

**Schema Finalization Workflow**
- Trigger schema capture when version is published/finalized
- Capture complete JSON Schema for the entire version
- Capture individual class schemas into schema_capture_class
- Prevent modifications to captured schemas (immutability)
- Support schema capture versioning for audit trails
- Validate all class schemas are complete before capture
- Generate schema fingerprint/hash for integrity verification

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Schema Validation Engine**
- Integrate JSON Schema validation library (jsonschema/fastjsonschema)
- Validate instance data against class_schema before INSERT
- Support JSON Schema draft-07/2020-12 specifications
- Handle $ref resolution within captured schemas
- Custom validation error messages with field paths
- Performance-optimized validation for batch operations
- Schema validation caching for repeated validations

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Instance Lifecycle Management

**Instance Creation (CREATE Action)**
- Create new instance record with metadata
- Validate complete JSON data against class schema
- Insert full data object into instance_data with action='CREATE'
- Create initial instance_snapshot with current_data
- Auto-increment version starting from 1
- Support optional embedding vector generation
- Return instance ID and version for client reference

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Instance Updates (UPDATE Action)**
- Compute delta/patch between current snapshot and new data
- Validate merged result against class schema
- Store only delta in instance_data with action='UPDATE'
- Apply delta to instance_snapshot.current_data
- Increment version number automatically
- Support JSON Patch (RFC 6902) format for deltas
- Support JSON Merge Patch (RFC 7396) format
- Track which fields changed for audit purposes

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Instance Deletion (DELETE Action)**
- Soft-delete: Set instance.deleted_at and is_active=FALSE
- Insert empty data record with action='DELETE'
- Remove or mark instance_snapshot as inactive
- Preserve full history for audit compliance
- Support bulk soft-delete operations
- Implement retention policies for deleted data
- Hard-delete option for GDPR/compliance (with approval)

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Instance Restoration**
- Restore soft-deleted instances within retention period
- Rebuild instance_snapshot from instance_data history
- Clear deleted_at and set is_active=TRUE
- Log restoration action for audit trail
- Validate restored data still matches current schema
- Handle schema evolution conflicts gracefully

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

## 🔗 Data Linking & Relationships

> **Section Status**: 🔴 Not Started
> **Priority**: High - Enables relational data modeling

### Link Definition Tables

**Link Definition Schema (link_def)**
- Define relationship types between schema classes
- Store source class reference (from $ref in schema)
- Store target class reference
- Relationship cardinality: one-to-one, one-to-many, many-to-many
- Relationship direction: unidirectional, bidirectional
- Cascade behavior: cascade, restrict, set-null, no-action
- Metadata for UI visualization (line style, color, label)

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**$ref Extraction & Analysis**
- Parse class_schema for $ref entries
- Resolve $ref paths to target classes
- Auto-generate link_def entries from schema analysis
- Handle nested $ref in arrays and objects
- Support circular reference detection
- Generate relationship graph from link definitions

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Instance Linking (link Table)

**Link Table Structure**
- t1: Left-side instance reference (source)
- t2: Right-side instance reference (target)
- t3: Variability/junction data for many-to-many relationships
- Reference to link_def for relationship type
- Created/updated timestamps for audit
- Optional metadata JSONB for relationship attributes
- Soft-delete support for link records

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Link Management Operations**
- Create links between instances
- Validate link against link_def cardinality rules
- Validate both instances exist and are active
- Validate instances match expected schema classes
- Cascade operations based on link_def settings
- Query linked instances efficiently
- Bulk link creation for batch imports

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Link Visualization**
- Generate visual link diagrams from link data
- Show relationship cardinality on diagram
- Interactive navigation through linked instances
- Filter diagram by relationship type
- Export link diagram as image/SVG
- Real-time updates as links change

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

## 🔍 Search & Query Engine

> **Section Status**: 🔴 Not Started
> **Priority**: High - Essential for data discovery

### Full-Text Search

**JSONB Search Capabilities**
- GIN index-powered JSONB containment queries
- Search across specific JSON paths
- Full-text search on text fields within JSONB
- Fuzzy matching and typo tolerance
- Search result ranking and scoring
- Highlight matching terms in results
- Search within specific schema classes

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Search API**
- RESTful search endpoints with query DSL
- Support for complex boolean queries (AND, OR, NOT)
- Field-specific searches with operators
- Range queries for numeric/date fields
- Pagination with cursor-based navigation
- Faceted search with aggregations
- Search suggestions and autocomplete

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Vector Similarity Search

**Embedding Generation**
- Generate embeddings for instance data
- Store embeddings in vector column
- Support multiple embedding models
- Incremental embedding updates on data change
- Batch embedding generation for imports
- Configurable embedding fields per class

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Similarity Queries**
- K-nearest neighbor (KNN) search
- Cosine similarity scoring
- Hybrid search: combine text + vector
- Filter by schema class before similarity
- Similarity thresholds for relevance
- Explain similarity scores

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

## 📦 Batch Processing & Import/Export

> **Section Status**: 🔴 Not Started
> **Priority**: High - Enterprise data operations

### Batch Import

**Bulk Data Import**
- Import from CSV, JSON, JSONL formats
- Map import columns to schema properties
- Validate all records before committing
- Transactional batch insert (all or nothing)
- Partial success mode with error report
- Progress tracking for large imports
- Resume interrupted imports
- Duplicate detection and handling strategies

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Import Templates**
- Save import mappings as reusable templates
- Share templates across projects
- Template versioning for schema changes
- Auto-suggest mappings based on column names
- Transform functions during import
- Default value assignments
- Validation rule overrides per import

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Batch Export

**Bulk Data Export**
- Export to CSV, JSON, JSONL, Parquet formats
- Filter data before export
- Select specific fields to export
- Include/exclude linked data
- Paginated export for large datasets
- Scheduled/automated exports
- Export to cloud storage (S3, GCS, Azure Blob)
- Encrypted exports for sensitive data

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Batch Operations

**Bulk Updates**
- Update multiple instances with single operation
- Query-based bulk updates (UPDATE WHERE)
- Preview affected records before execution
- Atomic transactions for consistency
- Progress tracking and cancellation
- Rollback support for failed batches
- Audit logging for bulk operations

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Bulk Deletes**
- Soft-delete multiple instances
- Query-based bulk deletes
- Cascade delete linked instances (configurable)
- Dry-run mode to preview deletions
- Retention policy enforcement
- Archive before delete option

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

## 📊 Data History & Auditing

> **Section Status**: 🔴 Not Started
> **Priority**: Medium - Compliance and debugging

### Event History

**Version History Viewer**
- View complete history of instance changes
- Show CREATE/UPDATE/DELETE timeline
- Display delta/patch for each UPDATE
- Show who made each change (user_id)
- Timestamp for each version
- Compare any two versions side-by-side
- Visual diff highlighting changes
- Restore to any previous version

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**History Reconstruction**
- Rebuild instance state at any point in time
- Apply events sequentially to reconstruct
- Handle schema migrations in history
- Performance-optimized reconstruction
- Cache frequently accessed historical states

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Audit Trail

**Comprehensive Audit Logging**
- Log all data operations with context
- User identification and session tracking
- IP address and client information
- Operation timestamps with timezone
- Before/after values for changes
- Query audit logs by user, time, operation
- Immutable audit log storage
- Audit log retention policies

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Compliance Reports**
- Generate audit reports for compliance reviews
- Filter by date range, user, operation type
- Export reports in standard formats
- GDPR data access reports
- Data lineage tracking
- Anomaly detection in access patterns

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

## 🔒 Data Integrity & Transactions

> **Section Status**: 🔴 Not Started
> **Priority**: Critical - Data reliability

### Transaction Management

**ACID Compliance**
- Full transaction support for all operations
- Savepoints for complex multi-step operations
- Automatic rollback on validation failures
- Deadlock detection and retry logic
- Transaction timeout configuration
- Nested transaction support
- Distributed transaction coordination

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Optimistic Locking**
- Version-based conflict detection
- Reject updates to stale data
- Merge conflict resolution strategies
- Auto-merge for non-conflicting changes
- Conflict notification to users
- Retry with latest version option

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Data Validation

**Schema Enforcement**
- Strict mode: Reject invalid data
- Permissive mode: Log warnings, allow data
- Custom validation rules per class
- Cross-field validation support
- Async validation for expensive checks
- Validation result caching

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Referential Integrity**
- Validate links reference existing instances
- Prevent deletion of linked instances (optional)
- Orphan detection and cleanup
- Circular reference handling
- Integrity check jobs (scheduled)
- Repair tools for integrity violations

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

## ⚡ Performance & Optimization

> **Section Status**: 🔴 Not Started
> **Priority**: Medium - Scale readiness

### Indexing Strategy

**Automatic Index Management**
- Analyze query patterns for index suggestions
- Auto-create indexes for common queries
- Index usage monitoring and cleanup
- Partial indexes for filtered queries
- Expression indexes for computed values
- Index maintenance scheduling

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**JSONB Path Indexes**
- Create indexes on specific JSON paths
- UI for configuring indexed paths
- Index performance monitoring
- Dynamic index recommendations
- Index impact analysis before creation

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Query Optimization

**Query Analysis**
- EXPLAIN ANALYZE for slow queries
- Query plan caching
- Automatic query rewriting for performance
- Connection pooling optimization
- Read replica routing for queries
- Query timeout management

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Caching Layer**
- Cache frequently accessed snapshots
- Cache invalidation on updates
- Distributed cache support (Redis)
- Cache warming strategies
- Cache hit/miss monitoring
- Configurable TTL per class

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Snapshot Optimization

**Snapshot Maintenance**
- Periodic snapshot consistency checks
- Rebuild corrupted snapshots from events
- Snapshot compression for large objects
- Snapshot partitioning by tenant
- Archive old snapshots to cold storage
- Snapshot size monitoring and alerts

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

## 🔌 API & Integration

> **Section Status**: 🔴 Not Started
> **Priority**: High - External access

### API Key Authentication & Authorization

**API Key Management**
- Generate API keys per tenant
- API key scopes: read, write, delete, admin
- API key expiration dates (optional)
- API key rotation without downtime
- Multiple API keys per tenant (development, staging, production)
- API key naming and description
- Revoke API keys immediately
- API key usage tracking and analytics

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**API Key Security**
- Secure API key storage (hashed, salted)
- API key transmitted via `X-API-Key` header
- Rate limiting per API key
- IP allowlist per API key (optional)
- API key permissions tied to version_id access
- Audit logging of all API key usage
- Suspicious activity detection and alerting
- API key breach notification

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Version-Based Access Control**
- API keys scoped to specific version_id(s)
- Wildcard access to all versions (admin keys)
- Read-only access to finalized versions
- Write access only to active versions
- Cross-version query permissions
- Version access inheritance from project

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### REST API - Schema Capture Endpoints

**Schema Capture CRUD** (`/api/v1/versions/{version_id}/schema-capture`)
- `POST /api/v1/versions/{version_id}/schema-capture` - Capture/freeze current schema
  - Requires: version_id, API key with write scope
  - Creates immutable snapshot of version schema
  - Returns: schema_capture_id, captured_at timestamp
- `GET /api/v1/versions/{version_id}/schema-capture` - Get captured schema
  - Returns: Full JSON Schema snapshot
  - Includes: captured_at, captured_by metadata
- `GET /api/v1/versions/{version_id}/schema-capture/classes` - List captured classes
  - Returns: Array of class_id, class_name pairs
  - Supports: pagination, filtering by class_name
- `GET /api/v1/versions/{version_id}/schema-capture/classes/{class_id}` - Get class schema
  - Returns: Full JSON Schema for specific class
  - Includes: validation rules, property definitions
- `DELETE /api/v1/versions/{version_id}/schema-capture` - Delete schema capture (admin only)
  - Cascades to schema_capture_class entries
  - Blocked if instances exist referencing this capture

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### REST API - Instance Endpoints

**Instance CRUD** (`/api/v1/versions/{version_id}/classes/{class_id}/instances`)
- `POST /instances` - Create new instance
  - Request body: { name, description, data }
  - Validates data against class_schema
  - Creates instance + instance_data (CREATE action) + instance_snapshot
  - Returns: instance_id, version: 1
- `GET /instances` - List instances
  - Query params: page, limit, sort, filter, is_active
  - Returns: Paginated array of instance summaries
  - Supports: JSONB field filtering
- `GET /instances/{instance_id}` - Get instance details
  - Returns: Instance metadata + current_data from snapshot
  - Includes: version, created_at, updated_at, status
- `PUT /instances/{instance_id}` - Update instance (full replacement)
  - Request body: { name, description, data }
  - Validates data against class_schema
  - Computes delta, stores in instance_data (UPDATE action)
  - Updates instance_snapshot with merged data
  - Returns: instance_id, new version number
- `PATCH /instances/{instance_id}` - Partial update instance
  - Request body: JSON Patch (RFC 6902) or JSON Merge Patch (RFC 7396)
  - Validates merged result against class_schema
  - Stores patch in instance_data (UPDATE action)
  - Updates instance_snapshot
  - Returns: instance_id, new version number
- `DELETE /instances/{instance_id}` - Soft-delete instance
  - Sets instance.is_active = FALSE, deleted_at = NOW()
  - Creates instance_data record (DELETE action, empty data)
  - Removes/deactivates instance_snapshot
  - Returns: confirmation with deleted_at timestamp

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Instance Restoration** (`/api/v1/versions/{version_id}/classes/{class_id}/instances/{instance_id}`)
- `POST /instances/{instance_id}/restore` - Restore soft-deleted instance
  - Clears deleted_at, sets is_active = TRUE
  - Rebuilds instance_snapshot from instance_data history
  - Returns: restored instance with current state

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### REST API - Instance Data (Event History) Endpoints

**Instance Data Read** (`/api/v1/versions/{version_id}/instances/{instance_id}/history`)
- `GET /history` - Get version history for instance
  - Returns: Array of all instance_data records
  - Includes: version, action, timestamp, user_id
  - Ordered: by version DESC (newest first)
- `GET /history/{version}` - Get specific version
  - Returns: instance_data record for specific version
  - Includes: full data (CREATE) or delta (UPDATE)
- `GET /history/range?from={v1}&to={v2}` - Get version range
  - Returns: Array of instance_data in version range
  - Useful for: reconstructing state at specific point
- `GET /history/at?timestamp={iso8601}` - Get state at timestamp
  - Reconstructs instance state at specific time
  - Returns: Merged data object as of timestamp

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### REST API - Instance Snapshot Endpoints

**Snapshot Read** (`/api/v1/versions/{version_id}/snapshots`)
- `GET /snapshots` - List all active snapshots for version
  - Returns: Paginated array of current instance states
  - Supports: JSONB filtering on current_data
  - Fast: O(1) reads from materialized snapshots
- `GET /snapshots/{instance_id}` - Get snapshot for instance
  - Returns: current_data, last_version, updated_at
  - Fastest way to read current instance state
- `POST /snapshots/bulk` - Bulk read snapshots
  - Request body: { instance_ids: [...] }
  - Returns: Array of snapshots for requested instances
  - Optimized: Single query for multiple instances
- `POST /snapshots/search` - Search snapshots by data content
  - Request body: { filters: {...}, fields: [...] }
  - Returns: Matching snapshots with selected fields
  - Uses: GIN index on current_data

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Snapshot Management** (Admin)
- `POST /snapshots/{instance_id}/rebuild` - Rebuild snapshot from history
  - Re-applies all instance_data events
  - Useful for: Fixing corrupted snapshots
- `POST /snapshots/verify` - Verify snapshot consistency
  - Compares snapshots against instance_data
  - Returns: List of inconsistencies found

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### REST API - Bulk Operations

**Bulk Instance Operations** (`/api/v1/versions/{version_id}/classes/{class_id}/bulk`)
- `POST /bulk/create` - Create multiple instances
  - Request body: { instances: [{name, data}, ...] }
  - Validates all before committing
  - Transactional: all succeed or all fail
  - Returns: Array of created instance_ids
- `POST /bulk/update` - Update multiple instances
  - Request body: { updates: [{instance_id, data}, ...] }
  - Computes deltas for each instance
  - Returns: Array of updated versions
- `POST /bulk/delete` - Soft-delete multiple instances
  - Request body: { instance_ids: [...] }
  - Returns: Count of deleted instances
- `POST /bulk/restore` - Restore multiple instances
  - Request body: { instance_ids: [...] }
  - Returns: Count of restored instances

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Bulk Import/Export**
- `POST /bulk/import` - Import instances from file
  - Content-Type: multipart/form-data
  - Supports: JSON, JSONL, CSV formats
  - Returns: Job ID for async processing
- `GET /bulk/import/{job_id}` - Check import status
  - Returns: Progress, success count, error count
- `POST /bulk/export` - Export instances to file
  - Request body: { format, filters, fields }
  - Returns: Job ID for async processing
- `GET /bulk/export/{job_id}` - Get export download
  - Returns: Signed download URL

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### REST API - Batch Job Submission & Processing

**Batch Job Lifecycle** (`/api/v1/batch`)
- `POST /batch/jobs` - Submit new batch job
  - Request body:
    ```json
    {
      "job_type": "import" | "export" | "transform" | "validate" | "delete" | "update",
      "version_id": "uuid",
      "class_id": "uuid",
      "config": { ... job-specific configuration ... },
      "priority": "low" | "normal" | "high",
      "scheduled_at": "ISO8601 timestamp (optional)",
      "webhook_url": "callback URL (optional)",
      "notification_email": "email (optional)"
    }
    ```
  - Returns: job_id, estimated_duration, queue_position
- `GET /batch/jobs` - List all batch jobs for tenant
  - Query params: status, job_type, created_after, created_before, page, limit
  - Returns: Paginated array of job summaries
- `GET /batch/jobs/{job_id}` - Get job details and status
  - Returns: Full job details, progress, timing, errors
- `DELETE /batch/jobs/{job_id}` - Cancel pending/running job
  - Returns: Cancellation confirmation
- `POST /batch/jobs/{job_id}/retry` - Retry failed job
  - Returns: New job_id (or requeues same job)
- `POST /batch/jobs/{job_id}/pause` - Pause running job (if supported)
- `POST /batch/jobs/{job_id}/resume` - Resume paused job

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Batch Job Status & Progress** (`/api/v1/batch/jobs/{job_id}`)
- `GET /status` - Get current status
  - Returns:
    ```json
    {
      "job_id": "uuid",
      "status": "pending" | "queued" | "running" | "paused" | "completed" | "failed" | "cancelled",
      "progress": {
        "percent_complete": 75,
        "records_processed": 7500,
        "records_total": 10000,
        "records_succeeded": 7450,
        "records_failed": 50,
        "current_phase": "validation" | "processing" | "committing"
      },
      "timing": {
        "submitted_at": "ISO8601",
        "started_at": "ISO8601",
        "estimated_completion": "ISO8601",
        "completed_at": "ISO8601 (if done)"
      }
    }
    ```
- `GET /progress/stream` - SSE stream for real-time progress
  - Server-Sent Events with progress updates
  - Useful for: Live UI progress bars
- `GET /logs` - Get job execution logs
  - Query params: level (info, warn, error), limit
  - Returns: Array of log entries with timestamps
- `GET /errors` - Get detailed error report
  - Returns: Array of failed records with error details
  - Includes: Record index, field, error message, original data

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Batch Import Jobs** (`/api/v1/batch/import`)
- `POST /import/upload` - Upload file for import
  - Content-Type: multipart/form-data
  - Supports: JSON, JSONL, CSV, Excel, Parquet
  - Returns: upload_id, file_size, detected_format
- `POST /import/preview` - Preview import mapping
  - Request body: { upload_id, sample_size: 10 }
  - Returns: Detected columns, sample data, suggested mappings
- `POST /import/configure` - Configure import mapping
  - Request body:
    ```json
    {
      "upload_id": "uuid",
      "version_id": "uuid",
      "class_id": "uuid",
      "column_mappings": {
        "source_column": "target_property",
        ...
      },
      "transforms": [
        { "column": "date", "type": "parse_date", "format": "MM/DD/YYYY" }
      ],
      "default_values": { "status": "active" },
      "on_duplicate": "skip" | "update" | "fail",
      "validation_mode": "strict" | "lenient"
    }
    ```
  - Returns: configuration_id, validation_preview
- `POST /import/validate` - Dry-run validation
  - Request body: { upload_id, configuration_id }
  - Returns: Validation results without committing
- `POST /import/execute` - Execute import job
  - Request body: { upload_id, configuration_id }
  - Returns: job_id for tracking
- `GET /import/{job_id}/results` - Get import results
  - Returns: Success count, failure details, created instance_ids

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Batch Export Jobs** (`/api/v1/batch/export`)
- `POST /export/configure` - Configure export job
  - Request body:
    ```json
    {
      "version_id": "uuid",
      "class_ids": ["uuid", ...] | "all",
      "filters": { ... JSONB filters ... },
      "fields": ["field1", "data.nested.field", ...] | "all",
      "format": "json" | "jsonl" | "csv" | "excel" | "parquet",
      "include_metadata": true,
      "include_history": false,
      "compression": "none" | "gzip" | "zip"
    }
    ```
  - Returns: export_config_id, estimated_record_count
- `POST /export/execute` - Execute export job
  - Request body: { export_config_id }
  - Returns: job_id for tracking
- `GET /export/{job_id}/download` - Download export file
  - Returns: Signed URL with expiration (24h default)
  - Supports: Range requests for large files
- `GET /export/{job_id}/manifest` - Get export manifest
  - Returns: File list, record counts, checksums

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Batch Transform Jobs** (`/api/v1/batch/transform`)
- `POST /transform/configure` - Configure transformation
  - Request body:
    ```json
    {
      "version_id": "uuid",
      "class_id": "uuid",
      "filters": { ... select records to transform ... },
      "transformations": [
        { "field": "data.price", "operation": "multiply", "value": 1.1 },
        { "field": "data.status", "operation": "set", "value": "migrated" },
        { "field": "data.legacy_field", "operation": "delete" },
        { "field": "data.new_field", "operation": "copy_from", "source": "data.old_field" }
      ],
      "dry_run": false
    }
    ```
  - Returns: transform_config_id, affected_record_count
- `POST /transform/preview` - Preview transformation on sample
  - Request body: { transform_config_id, sample_size: 10 }
  - Returns: Before/after comparison for sample records
- `POST /transform/execute` - Execute transformation
  - Request body: { transform_config_id }
  - Returns: job_id for tracking

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Batch Validation Jobs** (`/api/v1/batch/validate`)
- `POST /validate/execute` - Validate all instances against schema
  - Request body:
    ```json
    {
      "version_id": "uuid",
      "class_id": "uuid" | "all",
      "validation_rules": "schema" | "custom",
      "custom_rules": [ ... optional custom validation rules ... ],
      "stop_on_first_error": false
    }
    ```
  - Returns: job_id for tracking
- `GET /validate/{job_id}/report` - Get validation report
  - Returns: Valid count, invalid count, errors by field/rule
  - Exportable as CSV/JSON

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Batch Delete Jobs** (`/api/v1/batch/delete`)
- `POST /delete/configure` - Configure bulk delete
  - Request body:
    ```json
    {
      "version_id": "uuid",
      "class_id": "uuid",
      "filters": { ... select records to delete ... },
      "delete_type": "soft" | "hard",
      "cascade_links": true | false,
      "require_confirmation": true
    }
    ```
  - Returns: delete_config_id, affected_record_count, confirmation_token
- `POST /delete/confirm` - Confirm and execute delete
  - Request body: { delete_config_id, confirmation_token }
  - Returns: job_id for tracking
- `GET /delete/{job_id}/results` - Get delete results
  - Returns: Deleted count, skipped count (due to links), errors

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Batch Job Queue Management

**Queue Status** (`/api/v1/batch/queue`)
- `GET /queue/status` - Get queue status for tenant
  - Returns:
    ```json
    {
      "pending_jobs": 5,
      "running_jobs": 2,
      "queued_position": { "job_id": 3 },
      "estimated_wait_time": "PT5M",
      "worker_capacity": { "available": 3, "total": 10 }
    }
    ```
- `GET /queue/jobs` - List jobs in queue
  - Returns: Ordered list of pending/running jobs
- `POST /queue/prioritize/{job_id}` - Boost job priority (admin)
  - Returns: New queue position

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Job Scheduling** (`/api/v1/batch/schedules`)
- `POST /schedules` - Create scheduled batch job
  - Request body:
    ```json
    {
      "name": "Daily Export",
      "job_config": { ... full job configuration ... },
      "schedule": {
        "type": "cron" | "interval" | "once",
        "cron_expression": "0 2 * * *",
        "timezone": "America/Los_Angeles"
      },
      "enabled": true
    }
    ```
  - Returns: schedule_id, next_run_at
- `GET /schedules` - List scheduled jobs
- `GET /schedules/{schedule_id}` - Get schedule details
- `PUT /schedules/{schedule_id}` - Update schedule
- `DELETE /schedules/{schedule_id}` - Delete schedule
- `POST /schedules/{schedule_id}/trigger` - Manually trigger scheduled job
- `GET /schedules/{schedule_id}/history` - Get execution history

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Batch Job Templates** (`/api/v1/batch/templates`)
- `POST /templates` - Save job configuration as template
  - Request body: { name, description, job_config }
  - Returns: template_id
- `GET /templates` - List templates
- `GET /templates/{template_id}` - Get template
- `PUT /templates/{template_id}` - Update template
- `DELETE /templates/{template_id}` - Delete template
- `POST /templates/{template_id}/execute` - Execute job from template
  - Request body: { parameter_overrides: { ... } }
  - Returns: job_id

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Batch Processing Webhooks & Notifications

**Webhook Configuration** (`/api/v1/batch/webhooks`)
- `POST /webhooks` - Register webhook endpoint
  - Request body:
    ```json
    {
      "url": "https://your-server.com/batch-callback",
      "events": ["job.started", "job.progress", "job.completed", "job.failed"],
      "secret": "shared-secret-for-verification",
      "headers": { "Authorization": "Bearer token" }
    }
    ```
  - Returns: webhook_id
- `GET /webhooks` - List registered webhooks
- `DELETE /webhooks/{webhook_id}` - Remove webhook
- `POST /webhooks/{webhook_id}/test` - Send test webhook
- Webhook payload format:
  ```json
  {
    "event": "job.completed",
    "job_id": "uuid",
    "timestamp": "ISO8601",
    "data": { ... event-specific data ... },
    "signature": "HMAC-SHA256 signature"
  }
  ```

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Email Notifications**
- Configure email notifications per job
- Events: job_started, job_completed, job_failed
- Include summary statistics in email
- Attach error report for failed jobs
- Configurable recipient list

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### REST API - Link Endpoints

**Link Definition CRUD** (`/api/v1/versions/{version_id}/link-definitions`)
- `GET /link-definitions` - List all link definitions
  - Returns: Array of relationship types between classes
- `GET /link-definitions/{link_def_id}` - Get link definition details
  - Returns: Source class, target class, cardinality, metadata
- `POST /link-definitions` - Create link definition
  - Request body: { source_class_id, target_class_id, cardinality, name }
  - Returns: link_def_id
- `DELETE /link-definitions/{link_def_id}` - Delete link definition
  - Blocked if links exist using this definition

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Link CRUD** (`/api/v1/versions/{version_id}/links`)
- `POST /links` - Create link between instances
  - Request body: { link_def_id, t1 (source), t2 (target), t3 (junction data) }
  - Validates instances exist and match link_def classes
  - Returns: link_id
- `GET /links` - List links
  - Query params: link_def_id, source_instance_id, target_instance_id
  - Returns: Paginated array of links
- `GET /links/{link_id}` - Get link details
  - Returns: Full link with resolved instance summaries
- `PUT /links/{link_id}` - Update link junction data (t3)
  - Request body: { t3: {...} }
  - Returns: Updated link
- `DELETE /links/{link_id}` - Delete link
  - Returns: Confirmation

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Link Traversal** (`/api/v1/versions/{version_id}/instances/{instance_id}/links`)
- `GET /links/outgoing` - Get links where instance is source (t1)
  - Returns: Array of linked target instances
- `GET /links/incoming` - Get links where instance is target (t2)
  - Returns: Array of linked source instances
- `GET /links/all` - Get all links for instance
  - Returns: Combined outgoing + incoming links

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### REST API - Query Endpoints

**Ad-hoc Queries** (`/api/v1/versions/{version_id}/query`)
- `POST /query` - Execute query against snapshots
  - Request body: { class_id, filters, fields, sort, limit, offset }
  - Returns: Query results with selected fields
- `POST /query/count` - Count matching instances
  - Request body: { class_id, filters }
  - Returns: { count: N }
- `POST /query/aggregate` - Aggregate query
  - Request body: { class_id, group_by, aggregations, filters }
  - Returns: Aggregated results
- `POST /query/natural` - Natural language query
  - Request body: { query: "Find all orders over $100" }
  - Returns: Translated query + results

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Saved Queries** (`/api/v1/queries`)
- `POST /queries` - Save query
  - Request body: { name, description, query_definition }
  - Returns: query_id
- `GET /queries` - List saved queries
- `GET /queries/{query_id}` - Get saved query
- `POST /queries/{query_id}/execute` - Execute saved query
  - Request body: { parameters: {...} } (optional)
  - Returns: Query results
- `DELETE /queries/{query_id}` - Delete saved query

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### API Response Standards

**Response Format**
- Consistent JSON response structure:
  ```json
  {
    "success": true,
    "data": { ... },
    "meta": {
      "page": 1,
      "limit": 50,
      "total": 1000,
      "version": "1.0.0"
    }
  }
  ```
- Error response format:
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Data validation failed",
      "details": [
        { "field": "data.email", "message": "Invalid email format" }
      ]
    }
  }
  ```

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**HTTP Status Codes**
- 200 OK: Successful GET, PUT, PATCH
- 201 Created: Successful POST (create)
- 204 No Content: Successful DELETE
- 400 Bad Request: Invalid request body
- 401 Unauthorized: Missing or invalid API key
- 403 Forbidden: API key lacks required scope
- 404 Not Found: Resource not found
- 409 Conflict: Version conflict (optimistic locking)
- 422 Unprocessable Entity: Schema validation failed
- 429 Too Many Requests: Rate limit exceeded
- 500 Internal Server Error: Server error

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Pagination**
- Cursor-based pagination for large datasets
- Query params: `cursor`, `limit` (max 100)
- Response includes: `next_cursor`, `has_more`
- Alternative: Offset-based with `page`, `limit`

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Filtering & Sorting**
- Filter syntax: `?filter[field][op]=value`
- Operators: eq, ne, gt, gte, lt, lte, contains, starts_with
- JSONB path filtering: `?filter[data.address.city][eq]=Seattle`
- Sort syntax: `?sort=field:asc,field2:desc`
- Multiple filters combined with AND

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### API Documentation & SDKs

**OpenAPI Documentation**
- Auto-generated OpenAPI 3.1 spec
- Swagger UI for interactive testing
- ReDoc for readable documentation
- Code samples in multiple languages
- Schema definitions from JSON Schema
- Authentication examples

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Python SDK

**Client Library**
- Pythonic interface for all operations
- Async/await support
- Connection pooling
- Automatic retry with backoff
- Type hints for IDE support
- Comprehensive documentation
- Example notebooks

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**ORM-like Interface**
- Class-based model definitions from schemas
- Lazy loading for linked instances
- Query builder with method chaining
- Automatic validation before save
- Change tracking (dirty fields)
- Relationship traversal helpers

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

## 🗂️ Multi-Tenancy & Isolation

> **Section Status**: 🔴 Not Started
> **Priority**: High - Enterprise requirement

### Tenant Data Isolation

**Row-Level Security**
- PostgreSQL RLS policies per tenant
- Automatic tenant filtering on all queries
- Tenant context in all operations
- Cross-tenant query prevention
- Tenant impersonation for support (audited)

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Resource Quotas**
- Instance count limits per tenant
- Storage size limits per tenant
- API rate limits per tenant
- Quota usage monitoring
- Quota exceeded notifications
- Quota upgrade workflows

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Data Partitioning

**Tenant-Based Partitioning**
- Partition large tables by tenant_id
- Automatic partition management
- Partition pruning in queries
- Partition-level backups
- Tenant data migration tools

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

## 📈 Monitoring & Observability

> **Section Status**: 🔴 Not Started
> **Priority**: Medium - Operational excellence

### Metrics & Dashboards

**Operational Metrics**
- Instance counts by class and tenant
- Operation rates (create/update/delete per second)
- Query latency percentiles
- Error rates by operation type
- Storage usage trends
- Active connection counts

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Health Checks**
- Database connectivity checks
- Schema validation service health
- Snapshot consistency checks
- Replication lag monitoring
- Disk space alerts
- Connection pool exhaustion alerts

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Logging

**Structured Logging**
- JSON-formatted log entries
- Correlation IDs for request tracing
- Log levels: DEBUG, INFO, WARN, ERROR
- Sensitive data masking in logs
- Log aggregation integration (ELK, Datadog)
- Log retention policies

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

## 🎨 Data Visualization & Relationship Graphs

> **Section Status**: 🔴 Not Started
> **Priority**: High - Core user experience for data exploration

### Relationship Graph Visualization

**Schema-Level Graph View**
- Visualize all schema classes as nodes in a graph
- Show $ref relationships as directed edges between nodes
- Display relationship cardinality on edges (one-to-one, one-to-many, many-to-many)
- Color-code nodes by schema class type or domain
- Interactive zoom/pan controls (similar to Studio canvas)
- Click node to view class schema details
- Hover to highlight connected relationships
- Filter graph by specific classes or relationship types

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Multi-Level Relationship Depth**
- Configure visualization depth levels (1-ref, 2-refs, 3-refs, etc.)
- Level 1: Direct relationships from selected class
- Level 2: Relationships of related classes (2 hops)
- Level 3+: Extended relationship chains
- Visual distinction between depth levels (opacity, color gradient)
- Slider control for adjusting depth dynamically
- Collapse/expand nodes at each level
- Performance optimization for deep graphs (lazy loading)

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Relationship Path Visualization**
- Show all paths between two selected classes
- Highlight shortest path vs all paths
- Display path length and relationship types along path
- Animate path traversal for understanding data flow
- Export path information as documentation
- Path-based navigation through related data

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Instance Data Graphs

**Data Volume Visualization**
- Show instance counts per schema class as node size
- Visualize data distribution across classes
- Heat map overlay showing data density
- Trend indicators (growing, stable, declining)
- Filter by tenant for multi-tenant views
- Time-based animation of data growth
- Compare volumes across schema captures

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Link Distribution View**
- Visualize actual link counts between tables
- Edge thickness based on link volume
- Show link statistics on hover (count, avg links per instance)
- Identify orphaned instances (no links)
- Identify heavily-linked instances (hub detection)
- Filter by link type or relationship definition
- Drill-down from aggregate to individual links

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Data Flow Diagrams**
- Sankey diagram showing data relationships
- Flow width proportional to link counts
- Interactive filtering by source/target class
- Bi-directional flow visualization
- Export as SVG/PNG for documentation
- Highlight anomalous flow patterns

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Interactive Graph Controls

**Graph Layout Algorithms**
- Force-directed layout for organic arrangement
- Hierarchical layout for tree-like structures
- Circular layout for hub-and-spoke patterns
- Grid layout for structured comparison
- User-adjustable layout parameters
- Save layout preferences per user
- Auto-layout on graph changes

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Node & Edge Styling**
- Customizable node shapes by class type
- Edge styles (solid, dashed, dotted) by relationship type
- User-defined color themes
- Dark mode support
- Accessibility-friendly color palettes
- Legend generation for graph symbols
- Consistent styling with Studio canvas

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Graph Interaction**
- Click-to-select nodes and edges
- Multi-select with shift-click or lasso
- Right-click context menu for actions
- Drag nodes to rearrange layout
- Double-click to expand/collapse relationships
- Keyboard shortcuts for navigation
- Search/filter nodes by name or property

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Graph Analytics & Insights

**Relationship Statistics**
- Total relationship count by type
- Average relationships per instance
- Most connected classes (hub analysis)
- Least connected classes (potential orphans)
- Relationship symmetry analysis
- Circular reference detection and display

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Graph Metrics Dashboard**
- Node degree distribution chart
- Clustering coefficient visualization
- Path length statistics
- Connected component analysis
- Graph density metrics
- Comparison across schema versions

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Anomaly Detection**
- Highlight classes with unusual link patterns
- Detect potential data integrity issues
- Identify over-connected instances
- Flag under-utilized relationships
- Visual alerts for schema/data mismatches
- Recommendations for data optimization

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Export & Sharing

**Graph Export Options**
- Export as PNG/SVG/PDF image
- Export as GraphML/GEXF for external tools
- Export as JSON graph data
- Export as Mermaid diagram syntax
- Configurable export resolution
- Include/exclude metadata in export

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Shareable Graph Views**
- Generate shareable links to specific views
- Embed graphs in external documentation
- Snapshot graph state for comparison
- Collaborative graph annotations
- Version-specific graph permalinks

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Integration with Studio

**Studio Canvas Integration**
- Navigate from Studio class to data graph view
- Sync graph view with Studio selection
- Unified styling between Studio and data graphs
- Toggle between schema design and data visualization
- Side-by-side schema and data views
- Highlight data issues on Studio canvas

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Cross-View Navigation**
- Click class in graph to open in Studio
- Click instance count to view data browser
- Breadcrumb navigation between views
- Deep linking to specific graph states
- History navigation (back/forward)

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

## 🔎 Visual Query Builder & Natural Language Queries

> **Section Status**: 🔴 Not Started
> **Priority**: High - Core data exploration and analytics capability

### Natural Language Query Interface

**Natural Language to SQL Translation**
- Accept plain English queries from users
- Translate natural language to optimized SQL queries
- Support common query patterns: filtering, sorting, aggregation
- Context-aware schema understanding (class names, property names)
- Handle ambiguous queries with clarification prompts
- Show generated SQL for transparency and learning
- Support multiple languages (English primary, extensible)
- Integration with LLM providers (OpenAI, Anthropic, local models)

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Query Intent Recognition**
- Detect query type: retrieval, aggregation, comparison, trend
- Identify target schema classes from query context
- Extract filter conditions from natural language
- Recognize date/time references (last week, yesterday, Q4)
- Parse numeric comparisons (greater than, between, top N)
- Understand relationship traversal requests
- Handle negations and exclusions properly

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Query Suggestions & Autocomplete**
- Suggest queries based on schema structure
- Autocomplete class names and property names
- Show example queries for each schema class
- Learn from user query patterns
- Popular queries across tenant
- Recent queries quick access
- Query templates for common use cases

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Visual Query Builder

**Drag-and-Drop Query Construction**
- Visual canvas for building queries
- Drag schema classes onto canvas
- Connect classes via relationships (links)
- Add filter conditions visually
- Configure output fields by selection
- Group and aggregate with visual controls
- Sort order configuration
- Limit/pagination settings

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Filter Builder Interface**
- Visual filter condition builder
- Support all comparison operators (=, !=, >, <, >=, <=)
- String operators (contains, starts with, ends with, regex)
- Array operators (contains, overlaps, is empty)
- Null/not null checks
- Date range pickers
- Numeric range sliders
- Combine filters with AND/OR logic
- Nested filter groups
- Save filter presets for reuse

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Join & Relationship Builder**
- Visual join configuration between classes
- Support inner, left, right, full outer joins
- Join on link relationships automatically
- Multi-hop relationship traversal
- Preview join results before execution
- Optimize join order automatically
- Handle many-to-many relationships

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Aggregation Builder**
- Visual aggregation configuration
- Support COUNT, SUM, AVG, MIN, MAX
- GROUP BY with visual field selection
- HAVING clause builder
- Nested aggregations
- Pivot table generation
- Window functions (running totals, rankings)
- Custom aggregation formulas

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Query Execution Engine

**Snapshot-Based Queries (Current State)**
- Query against instance_snapshot for latest data
- Optimized for O(1) current state access
- Automatic tenant isolation via RLS
- Join across multiple snapshot tables
- Filter by is_active for non-deleted records
- JSONB path extraction for property access
- Index utilization for common query patterns

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Query Optimization**
- Analyze query before execution
- Suggest index creation for slow queries
- Query plan visualization
- Automatic query rewriting for performance
- Parallel query execution where beneficial
- Query cost estimation
- Timeout management for long-running queries

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Query Execution Controls**
- Execute query with progress indicator
- Cancel running queries
- Query execution history
- Retry failed queries
- Explain plan viewer
- Performance metrics per query
- Resource usage monitoring

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Query Results & Output

**Results Viewer**
- Tabular display of query results
- Sortable and filterable result columns
- Pagination for large result sets
- Column resizing and reordering
- Freeze columns for wide results
- Cell-level data inspection (expand JSONB)
- Copy cell/row/table data
- Inline editing (with write permissions)

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Results Visualization**
- Auto-suggest visualizations based on data types
- Chart types: bar, line, pie, scatter, heatmap
- Pivot table view
- Summary statistics cards
- Trend lines and annotations
- Interactive chart drilling
- Multiple visualizations per query
- Dashboard pinning

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Export Query Results**
- Export to CSV, JSON, JSONL, Excel
- Export to Parquet for big data tools
- Stream large exports (no memory limits)
- Schedule recurring exports
- Export with applied formatting
- Include query metadata in export
- Secure download links with expiry

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Saved Queries & Sharing

**Query Library**
- Save queries with name and description
- Organize queries in folders
- Tag queries for categorization
- Query versioning (edit history)
- Duplicate and modify existing queries
- Mark queries as favorites
- Query usage analytics

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Query Sharing & Collaboration**
- Share queries with team members
- Permission levels: view, edit, execute
- Publish queries as templates
- Comment on shared queries
- Query review and approval workflow
- Embed query results in external tools
- API access to saved queries

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Parameterized Queries**
- Define query parameters (variables)
- Parameter types: text, number, date, select list
- Default parameter values
- Required vs optional parameters
- Parameter validation rules
- Dynamic parameter lists from data
- Share parameterized queries as forms

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Query Security & Governance

**Access Control**
- Row-level security enforcement
- Column-level security (hide sensitive fields)
- Query result masking for PII
- Tenant isolation in all queries
- Role-based query permissions
- Audit log for all query executions
- Data access request workflow

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Query Policies**
- Maximum query execution time
- Maximum result set size
- Rate limiting per user/tenant
- Blocked query patterns (prevent expensive queries)
- Required filters for large tables
- Cost-based query approval
- Query complexity scoring

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Integration & API

**Query API**
- REST API for query execution
- GraphQL endpoint for flexible queries
- Batch query execution
- Async query execution with callbacks
- Query status polling
- Result streaming for large datasets
- API rate limiting and quotas

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**External Tool Integration**
- JDBC/ODBC driver for BI tools
- Connect to Tableau, Power BI, Looker
- Metabase integration
- Jupyter notebook connector
- dbt integration for data transformations
- Airflow operators for scheduled queries

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

## ⏱️ Time-Audited Queries (Historical Data Access)

> **Section Status**: 🔴 Not Started
> **Priority**: Medium - Compliance and historical analytics
> **Prerequisite**: Visual Query Builder must be implemented first

### Point-in-Time Queries

**As-Of Timestamp Queries**
- Query data as it existed at a specific timestamp
- Reconstruct instance state from instance_data events
- Support date picker for timestamp selection
- Handle timezone conversions properly
- Show data version active at query time
- Compare current vs historical state
- Highlight changes between timestamps

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Version-Specific Queries**
- Query specific version of an instance
- Browse version history in query context
- Select version range for analysis
- Aggregate across version history
- Find when specific values changed
- Track field-level change history
- Version comparison in results

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Historical Range Queries

**Time Range Analysis**
- Query data changes within a time range
- Filter by created_at, updated_at ranges
- Track instance lifecycle events
- Count changes per time period
- Identify high-change instances
- Detect change patterns and anomalies
- Trend analysis over time periods

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Change Event Queries**
- Query specific action types (CREATE, UPDATE, DELETE)
- Filter by user who made changes
- Find all changes to specific fields
- Identify bulk change operations
- Correlate changes across related instances
- Change frequency analysis
- Change attribution reports

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Event Reconstruction Engine

**State Reconstruction**
- Rebuild instance state from event log
- Apply CREATE → UPDATE → ... sequence
- Handle delta/patch application correctly
- Support JSON Patch (RFC 6902) replay
- Support JSON Merge Patch (RFC 7396) replay
- Performance optimization with checkpoints
- Cache reconstructed states for reuse

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Reconstruction Performance**
- Checkpoint creation for long histories
- Parallel reconstruction for multiple instances
- Lazy reconstruction (on-demand)
- Reconstruction result caching
- Incremental reconstruction from checkpoint
- Memory-efficient streaming reconstruction

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Compliance & Audit Queries

**Audit Trail Queries**
- Query all changes by user
- Query all changes to specific instance
- Query changes by source/client application
- IP address and session tracking in queries
- Generate compliance audit reports
- Data access pattern analysis
- Suspicious activity detection

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Regulatory Reporting**
- GDPR data access reports (all data for a subject)
- Data retention compliance queries
- Right to erasure verification
- Data lineage tracking queries
- Cross-reference audit events with data changes
- Export audit trails for regulators

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Bi-Temporal Query Support

**Valid Time vs Transaction Time**
- Distinguish when data was valid vs when recorded
- Support bi-temporal data models
- Query by valid time range
- Query by transaction time range
- Combined bi-temporal queries
- Temporal join operations
- As-of/between temporal operators

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Temporal Aggregations**
- Time-series aggregations
- Moving averages and windows
- Period-over-period comparisons
- Seasonal pattern detection
- Gap and island analysis
- Temporal density analysis
- Historical trend projections

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Historical Query Interface

**Time Travel UI**
- Visual timeline navigation
- Scrub through time to see data changes
- Play/pause animation of changes
- Bookmark significant timestamps
- Compare snapshots at different times
- Visual diff between time points
- Timeline annotations and markers

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Historical Query Builder**
- Extend visual query builder for time queries
- Add temporal filter controls
- Time range selection widgets
- Version selector integration
- AS OF clause builder
- BETWEEN clause for ranges
- Combine current and historical data

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

## 📅 Time-Series Queries & Background Processing

> **Section Status**: 🔴 Not Started
> **Priority**: Medium - Advanced historical analytics
> **Prerequisite**: Time-Audited Queries must be implemented first

### Time-Series Query Engine

**Time-Series Query Definition**
- Define time-series queries with start/end timestamps
- Specify time granularity (minute, hour, day, week, month)
- Select target schema classes for reconstruction
- Configure aggregation functions per time bucket
- Support for multiple classes in single query
- Define time window sliding parameters
- Set sampling strategies for large datasets

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**State Reconstruction from Events**
- Rebuild instance state from instance + instance_data tables
- Apply event sequence (CREATE → UPDATE → DELETE) chronologically
- Reconstruct state at each time bucket boundary
- Handle delta/patch application for UPDATE events
- Track instance lifecycle across time range
- Support JSON Patch (RFC 6902) replay
- Support JSON Merge Patch (RFC 7396) replay
- Handle schema evolution during time range

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Query Cost Estimation**
- Analyze query before execution
- Estimate time to completion based on:
  - Number of instances affected
  - Time range span
  - Number of events to process
  - Reconstruction complexity
- Display estimated duration to user: "This query will take approximately X seconds/minutes"
- Provide confidence interval for estimate
- Learn from historical query performance
- Warn for exceptionally long queries

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Background Query Processing

**Async Query Submission**
- Submit time-series query for background processing
- Generate unique request ID for tracking
- Return immediately with request ID and estimate
- Queue query for background worker processing
- Priority queuing based on user/tenant tier
- Query cancellation support
- Query deduplication (reuse running identical queries)

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Background Worker System**
- Dedicated worker pool for time-series queries
- Configurable concurrency per tenant
- Resource-aware scheduling (CPU, memory, I/O)
- Progress tracking during execution
- Checkpoint/resume for long-running queries
- Graceful handling of worker failures
- Auto-retry with exponential backoff
- Dead letter queue for failed queries

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Query Progress Monitoring**
- Real-time progress updates (percent complete)
- Estimated time remaining updates
- Events processed / total events counter
- Current processing timestamp
- WebSocket subscription for live updates
- Email notification on completion (optional)
- In-app notification on completion

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Result Storage & Retrieval

**Result Persistence**
- Store completed query results in dedicated storage
- Configurable result retention period (TTL)
- Compress large result sets
- Partition results for streaming access
- Result metadata (query params, timing, row count)
- Result integrity checksums
- Automatic cleanup of expired results

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**REST API Result Retrieval**
- GET /api/queries/{request_id}/status - Check query status
- GET /api/queries/{request_id}/result - Retrieve results
- GET /api/queries/{request_id}/result/stream - Stream large results
- GET /api/queries/{request_id}/progress - Get progress details
- DELETE /api/queries/{request_id} - Cancel query
- Paginated result retrieval for large datasets
- Support for partial result retrieval (ranges)
- Result format options (JSON, CSV, Parquet)

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Visual Result Retrieval**
- Query status dashboard in UI
- List pending/running/completed queries
- Real-time progress bar for running queries
- Click to view results when complete
- Download results in multiple formats
- Visualize results directly in UI
- Re-run previous queries with modifications
- Share result links with team members

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Time-Series Visualization

**Temporal Data Charts**
- Line charts for value changes over time
- Area charts for cumulative metrics
- Step charts for discrete state changes
- Candlestick charts for range data
- Multiple series comparison
- Zoom/pan through time ranges
- Annotations for significant events

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Instance Lifecycle Timeline**
- Visualize instance CREATE/UPDATE/DELETE events
- Show state at each point in time
- Color-code by event type
- Drill-down to see specific changes
- Compare multiple instances on same timeline
- Export timeline as image/data

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Aggregated Time-Series Views**
- Count of instances per time bucket
- Sum/avg/min/max of numeric fields over time
- Percentage change period-over-period
- Moving averages and trend lines
- Anomaly highlighting
- Forecast projections (optional ML integration)

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Performance Optimization

**Reconstruction Caching**
- Cache reconstructed states at checkpoint intervals
- Reuse cached states for overlapping queries
- Invalidate cache on data changes
- LRU eviction for cache management
- Warm cache for frequently queried ranges
- Tenant-isolated cache partitions

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Incremental Processing**
- Process only changed instances since last query
- Detect unchanged time ranges
- Skip reconstruction for stable periods
- Merge incremental results with cached data
- Track data lineage for incremental validity

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Parallel Reconstruction**
- Parallelize across instances
- Parallelize across time buckets
- Map-reduce pattern for aggregations
- Configurable parallelism level
- Resource throttling per query
- Load balancing across workers

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Query Templates & Scheduling

**Time-Series Query Templates**
- Save time-series query definitions as templates
- Parameterize time ranges (last 7 days, this month)
- Parameterize class filters
- Share templates across team
- Template versioning
- Import/export templates

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Scheduled Time-Series Queries**
- Schedule queries to run on a recurring basis
- Cron-style scheduling (daily, weekly, monthly)
- Automatic result storage and notification
- Rolling time windows (always last N days)
- Dependency chains (query A triggers query B)
- Schedule management UI
- Execution history and logs

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Query Result Subscriptions**
- Subscribe to query results via webhook
- Receive results via email
- Push to external systems (S3, Kafka, API)
- Configurable result formatting
- Retry logic for failed deliveries
- Delivery confirmation tracking

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

## 🤖 AI & Vector-Powered Features

> **Section Status**: 🔴 Not Started
> **Priority**: High - Competitive differentiator leveraging pgvector
> **Prerequisite**: Core Data Storage Engine with vector embeddings

### Semantic Search & Similarity

**Vector Embedding Generation**
- Auto-generate embeddings on instance CREATE/UPDATE
- Support multiple embedding models (OpenAI, Cohere, local models)
- Configurable embedding fields per schema class
- Batch embedding generation for bulk imports
- Embedding versioning (re-embed on model upgrade)
- Embedding quality metrics and monitoring
- Cost tracking for external embedding APIs

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Semantic Similarity Search**
- Find similar instances using vector distance
- K-nearest neighbor (KNN) queries via pgvector
- Cosine, Euclidean, and inner product distance metrics
- Configurable similarity thresholds
- Filter by schema class before similarity search
- Combine semantic + keyword search (hybrid)
- Explain similarity scores to users
- Real-time similarity as you type

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Cross-Class Semantic Linking**
- Discover relationships via embedding similarity
- Suggest links between semantically related instances
- Auto-link threshold configuration
- Review and approve suggested links
- Semantic clustering of instances
- Outlier detection (instances with no similar matches)

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### AI-Powered Data Discovery

**Natural Language Data Search**
- Search data using plain English queries
- Convert queries to vector + filter combinations
- Context-aware search understanding schema
- Search across multiple classes simultaneously
- Relevance ranking with explanations
- Search refinement suggestions
- "Did you mean?" for ambiguous queries

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Intelligent Data Classification**
- Auto-categorize instances using ML models
- Suggest tags based on content similarity
- Anomaly detection in data patterns
- Duplicate/near-duplicate detection
- Data quality scoring per instance
- Classification confidence scores
- Human-in-the-loop verification workflow

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**AI-Assisted Data Entry**
- Auto-complete fields based on similar instances
- Suggest property values from patterns
- Validate entries against learned patterns
- Flag unusual values for review
- Learn from user corrections
- Template suggestions based on context

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Vector-Accelerated Queries

**Fast Association Lookups**
- Pre-computed vector indices for O(1) similarity
- Approximate nearest neighbor (ANN) for speed
- HNSW index optimization for pgvector
- Query result caching with vector keys
- Batch similarity queries
- Streaming similarity results

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Relationship Inference**
- Infer missing links from vector proximity
- Predict likely relationships
- Confidence scoring for inferred links
- Graph completion suggestions
- Relationship strength estimation
- Temporal relationship prediction

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Clustering & Segmentation**
- Automatic instance clustering by similarity
- Dynamic cluster assignment
- Cluster visualization on canvas
- Cluster-based aggregations
- Segment discovery and naming
- Cluster evolution over time

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### AI Query Enhancement

**Query Understanding**
- Parse user intent from natural language
- Entity extraction from queries
- Query expansion with synonyms
- Spelling correction and normalization
- Multi-language query support
- Query intent classification

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Smart Query Suggestions**
- Suggest queries based on data patterns
- "Users who queried X also queried Y"
- Trending queries across tenant
- Personalized query recommendations
- Query optimization suggestions
- Alternative query formulations

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**AI-Generated Insights**
- Automatic insight generation from query results
- Summarize large result sets in natural language
- Highlight anomalies and trends
- Generate executive summaries
- Comparative analysis narratives
- Export insights as reports

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### RAG (Retrieval Augmented Generation)

**Context-Aware AI Responses**
- Use vector search to find relevant data context
- Feed context to LLM for accurate responses
- Ground AI responses in actual data
- Citation of source instances
- Confidence scoring for responses
- Hallucination detection and prevention

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Conversational Data Interface**
- Chat-based data exploration
- Multi-turn conversation support
- Context persistence across sessions
- Follow-up question handling
- Clarification requests when ambiguous
- Action suggestions (create, update, link)

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

## 🏢 Enterprise Data Offloading (Redis/MongoDB)

> **Section Status**: 🔴 Not Started
> **Priority**: Medium - Enterprise performance tier
> **Prerequisite**: Core Data Storage and Time-Series Queries

### Delta Snapshot Offloading

**Delta Object Storage in MongoDB**
- Store instance_data deltas as MongoDB documents
- Maintain delta sequence with version ordering
- Index by instance_id, timestamp, action type
- Store full CREATE payloads for reconstruction
- Store compact UPDATE deltas (JSON Patch format)
- Mark DELETE events with tombstone documents
- TTL indexes for automatic expiration
- Sharding by tenant_id for scale

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**MongoDB Document Schema**
- Document structure:
  ```
  {
    _id: ObjectId,
    tenant_id: UUID,
    instance_id: UUID,
    schema_class_id: UUID,
    version: Integer,
    action: "CREATE" | "UPDATE" | "DELETE",
    data: BSON (full or delta),
    timestamp: ISODate,
    user_id: UUID,
    metadata: Object
  }
  ```
- Compound indexes for query patterns
- Covered queries for common access patterns
- Document validation rules

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Synchronization Pipeline**
- Real-time sync from PostgreSQL to MongoDB
- Change Data Capture (CDC) from instance_data
- Exactly-once delivery guarantees
- Sync lag monitoring and alerting
- Conflict resolution strategies
- Bulk initial sync for new tenants
- Incremental sync for ongoing operations
- Sync status dashboard

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Redis Caching Layer

**Snapshot Caching in Redis**
- Cache current instance_snapshot in Redis
- Key structure: `tenant:{id}:instance:{id}:snapshot`
- JSON serialization with compression
- Configurable TTL per schema class
- Write-through caching on updates
- Cache invalidation on DELETE
- Redis Cluster support for scale
- Memory usage monitoring per tenant

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Delta Sequence Caching**
- Cache recent deltas in Redis Lists
- Fast retrieval for time-series reconstruction
- Sliding window of N most recent versions
- Automatic eviction to MongoDB for older deltas
- Pre-fetch deltas for predicted queries
- Delta compression in cache

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Query Result Caching**
- Cache expensive query results
- Time-series query result caching
- Key based on query hash
- Automatic invalidation on data changes
- Partial result caching for pagination
- Cache warming for popular queries
- Hit rate monitoring and optimization

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Time-Series Query Acceleration

**MongoDB-Accelerated Time Queries**
- Route time-series queries to MongoDB
- Match time constraints against delta timestamps
- Pull matching delta documents in bulk
- Parallel retrieval across shards
- Stream results back to query engine
- Fallback to PostgreSQL if MongoDB unavailable

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Delta Matching for Time Constraints**
- Query MongoDB for deltas within time range
- Filter by action type (CREATE/UPDATE/DELETE)
- Retrieve only relevant deltas for reconstruction
- Skip unchanged instances in time window
- Aggregate delta counts per instance
- Identify high-change instances quickly

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Reconstruction from MongoDB Deltas**
- Fetch CREATE event as base state
- Apply UPDATE deltas sequentially
- Handle DELETE for lifecycle tracking
- Parallel reconstruction across instances
- Checkpoint caching for long histories
- Merge with PostgreSQL for consistency

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Hybrid Query Execution

**Query Router**
- Analyze query to determine optimal data source
- Route snapshot queries to Redis first
- Route time-series queries to MongoDB
- Fallback chain: Redis → MongoDB → PostgreSQL
- Query cost estimation per data source
- Load balancing across replicas
- Circuit breaker for unavailable sources

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Cross-Store Joins**
- Join data across Redis, MongoDB, PostgreSQL
- Federated query execution
- Result merging and deduplication
- Consistency guarantees across stores
- Transaction coordination (where supported)
- Performance optimization for cross-store queries

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Consistency Management**
- Eventual consistency model for offloaded data
- Consistency level configuration per query
- Read-your-writes guarantees (optional)
- Conflict detection and resolution
- Consistency monitoring dashboard
- Manual consistency repair tools

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Data Lifecycle Management

**Tiered Storage Strategy**
- Hot tier: Redis (recent snapshots, active queries)
- Warm tier: MongoDB (deltas, time-series data)
- Cold tier: PostgreSQL (source of truth, audit)
- Archive tier: S3/GCS (long-term retention)
- Automatic data movement between tiers
- Configurable retention policies per tier
- Cost optimization recommendations

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Data Replication & Backup**
- Cross-region MongoDB replication
- Redis replication with persistence
- Point-in-time recovery capabilities
- Backup scheduling and retention
- Disaster recovery procedures
- RTO/RPO configuration per tenant
- Backup verification testing

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Tenant Data Isolation**
- Separate MongoDB databases per tenant (optional)
- Redis key namespacing per tenant
- Network isolation where required
- Encryption at rest per tenant
- Tenant-specific retention policies
- Data residency compliance
- Tenant offboarding with data purge

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Monitoring & Operations

**Offload Performance Metrics**
- Sync lag (PostgreSQL → MongoDB)
- Cache hit rates (Redis)
- Query latency by data source
- Storage utilization per tier
- Cost per query by source
- Throughput metrics

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Health Dashboards**
- Redis cluster health
- MongoDB replica set status
- Sync pipeline status
- Storage capacity projections
- Alert configuration
- Runbook integration

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Operational Tools**
- Manual cache invalidation
- Force sync from PostgreSQL
- Data verification/repair
- Performance tuning recommendations
- Capacity planning tools
- Cost analysis reports

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

## 🚀 Future Considerations

> **Section Status**: 🔵 Planning Phase
> **Priority**: Low - Long-term vision

### Advanced Features

**Change Data Capture (CDC)**
- Stream changes to external systems
- Kafka/RabbitMQ integration
- Webhook notifications on changes
- Configurable change filters
- At-least-once delivery guarantees

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Time-Travel Queries**
- Query data as of a specific timestamp
- Bi-temporal data support
- Valid time vs transaction time
- Historical analytics
- Compliance snapshot generation

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Schema Evolution**
- Handle schema changes for existing data
- Migration scripts generation
- Data transformation during migration
- Backwards compatibility checks
- Schema versioning for stored data

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Geo-Distribution**
- Multi-region data replication
- Read replicas in different regions
- Conflict resolution for writes
- Latency-based routing
- Data residency compliance

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

## Database Schema Reference

### Current Tables

| Table | Purpose |
|-------|---------|
| `schema_capture` | Immutable snapshot of finalized version schema |
| `schema_capture_class` | Individual class definitions within a capture |
| `instance` | Logical data object tied to a schema class |
| `instance_data` | Event-sourced versioned data (CREATE/UPDATE/DELETE) |
| `instance_snapshot` | Materialized current state for fast reads |

### Planned Tables

| Table | Purpose |
|-------|---------|
| `link_def` | Defines relationship types between schema classes |
| `link` | Stores actual links between instance records (t1, t2, t3) |
| `audit_log` | Comprehensive audit trail for all operations |
| `import_job` | Tracks batch import operations |
| `export_job` | Tracks batch export operations |

---

## Implementation Notes

### Technology Stack
- **Database**: PostgreSQL 15+ with pgvector extension
- **Backend**: Python 3.11+ with FastAPI/asyncpg
- **Validation**: jsonschema or fastjsonschema
- **Caching**: Redis for snapshot caching
- **Search**: PostgreSQL full-text search + pgvector

### Event Sourcing Pattern
```
CREATE → Full object stored → Snapshot created
UPDATE → Delta/patch stored → Snapshot updated (merged)
DELETE → Empty record stored → Snapshot removed/deactivated
```

### Delta Computation
- Use JSON Patch (RFC 6902) for precise deltas
- Fall back to JSON Merge Patch (RFC 7396) for simpler cases
- Store both formats for compatibility

### Performance Targets
- Single instance read: < 5ms (from snapshot)
- History reconstruction: < 100ms for 100 versions
- Batch import: > 1000 records/second
- Search queries: < 100ms for 1M records

---

*This roadmap is a living document and will be updated as features are implemented and new requirements emerge.*

