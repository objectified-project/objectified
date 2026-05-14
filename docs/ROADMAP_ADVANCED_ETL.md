# Objectified Suite — Advanced ETL & Data Loading Roadmap Ideas

This document captures potential new products for the Objectified enterprise suite focused on **ETL, data ingestion, extraction, and big-data transport**. These ideas are based on analysis of the existing UI mockup suite, the `objectified-db` schema model (where `classes` and `class_properties` define dynamically-generated table schemas), and common enterprise data engineering requirements. Every proposed product ultimately writes to, reads from, or routes data through objectified-db instances. Each product fills a genuine gap not covered by the existing `import`, `data-transform`, `connect`, `db`, `detective`, or `harvest` mockups.

---

Create a mockup in the objectified-ui /mockups directory that creates a new ReverseETL project in /mockups/reverse-etl as follows:
### Objectified Reverse
**Reverse ETL: outbound sync from objectified-db to operational destinations**

Pushes data FROM objectified-db OUT to operational systems — CRMs (Salesforce, HubSpot), data warehouses (Snowflake, BigQuery, Redshift), marketing automation platforms, and custom REST endpoints. Closes the loop: objectified-db becomes both the canonical destination for incoming data AND the source of truth for downstream operational systems. An audience/segment builder lets users filter Class instances using a visual query interface to define which rows to sync (e.g., "all Customer instances where `tier = enterprise` and `last_activity_date > 30d`"). A field mapping editor maps objectified Class properties to destination system field names. Sync cadence is configurable per destination (real-time, hourly, daily). A delivery log shows per-row sync status, API rate limit consumption, and error classifications. Volume metering feeds into the `monetization/` billing model for usage-based pricing of outbound sync operations.

- **DB Hooks:** `classes`, `class_properties`, `properties`, `tenants`, `api_keys`, `reverse_sync_destinations`, `reverse_sync_runs`, `load_jobs`
- **Target Buyer:** RevOps teams, marketing operations, data engineering teams
- **Enterprise Value:** ⭐⭐⭐⭐

Update the /mockups/index.html page after implementing the mockup so the index is updated with the latest addition.

---

Create a mockup in the objectified-ui /mockups directory that creates a new Wormhole project in /mockups/wormhole as follows:
### Objectified Wormhole
**Cross-tenant and cross-region data bridge**

Enterprise product for moving objectified-db data between tenants, environments (dev → staging → production), or geographic regions with schema-version awareness and compliance-governed data residency controls. A wormhole map provides a visual topology of all configured source/destination environment pairs. A schema compatibility check validates that the source Class definition is compatible with the destination before transfer. A data residency policy editor enforces which data classes may cross region boundaries, with classification tags driving automatic allow/deny decisions. Bi-directional sync mode includes conflict resolution policies (source-wins, destination-wins, manual merge). All cross-boundary transfers are written to an immutable audit ledger with HMAC-signed manifests suitable for compliance reporting. Integrates with the `comply/` and `data-shield/` mockups for policy enforcement.

- **DB Hooks:** `classes`, `class_properties`, `tenants`, `tenant_users`, `api_keys`, `versions`, `load_jobs`, `wormhole_bridges`, `wormhole_transfer_audit`
- **Target Buyer:** Enterprise platform teams, multi-region deployments, regulated industries
- **Enterprise Value:** ⭐⭐⭐⭐

Update the /mockups/index.html page after implementing the mockup so the index is updated with the latest addition.

---

## Summary Matrix

| Product | Directory | Category | Complexity | Enterprise Value |
|---|---|---|---|---|
| **Forge** | `/mockups/forge` | Pipeline | High | ⭐⭐⭐⭐⭐ |
| **Temporal** | `/mockups/temporal` | Orchestration | High | ⭐⭐⭐⭐⭐ |
| **Scheduler** | `/mockups/job-scheduler` | Orchestration | Medium | ⭐⭐⭐⭐ |
| **Bulk** | `/mockups/bulk` | Ingestion | High | ⭐⭐⭐⭐⭐ |
| **Stream** | `/mockups/stream` | Ingestion | High | ⭐⭐⭐⭐⭐ |
| **CDC** | `/mockups/cdc` | Ingestion | High | ⭐⭐⭐⭐ |
| **File Gateway** | `/mockups/file-gateway` | Ingestion | Medium | ⭐⭐⭐⭐ |
| **Data Federate** | `/mockups/data-federate` | Query | High | ⭐⭐⭐⭐⭐ |
| **DeltaSync** | `/mockups/delta-sync` | Sync | Medium | ⭐⭐⭐⭐ |
| **Profile (Data)** | `/mockups/data-profile` | Discovery | Medium | ⭐⭐⭐⭐⭐ |
| **Quality** | `/mockups/data-quality` | Governance | Medium | ⭐⭐⭐⭐⭐ |
| **Reverse** | `/mockups/reverse-etl` | Egress | Medium | ⭐⭐⭐⭐ |
| **Wormhole** | `/mockups/wormhole` | Governance | Medium | ⭐⭐⭐⭐ |

---

## Recommended Priority Order

Based on market demand, natural fit with the existing objectified-db schema model, and lowest incremental build cost:

1. **Forge** — the ETL pipeline canvas is the anchor product for the entire data-loading suite; every other product feeds into or is triggered from a Forge pipeline; DataFusion and Spark support are already referenced in the `data-transform/` mockup, making this a natural extension
2. **Profile (Data)** — highest leverage per effort; generating objectified Class definitions from source data samples dramatically lowers the barrier to entry for new users and makes every other ingestion product easier to configure; no similar mockup exists today
3. **Quality** — universally demanded by enterprise data governance teams; DQ rules attached to Class definitions are a unique differentiator because quality policy travels with the schema version; directly reinforces the value of the objectified schema model
4. **Bulk** — addresses the single most common enterprise data loading pattern (file-based batch loads from S3/cloud object stores); DataFusion and Spark references already present in `data-transform/` Spark Jobs mockup
5. **Temporal** — critical for any long-running load job that needs durability guarantees beyond what a cron scheduler provides; positions objectified-db as a reliable enterprise data platform rather than a lightweight tool
6. **Stream** — completes the real-time ingestion story alongside CDC; Kafka integration is one of the top-asked-for capabilities in enterprise data platforms
7. **CDC** — enables near-zero-latency replication from operational databases; high value for analytics-on-operational-data use cases; Debezium/PgLogical are mature and well-understood
8. **Data Federate** — DataFusion as a virtual query engine is a strong differentiator; allows analysts to query data in place before committing to full loads; powers exploratory use cases that drive adoption
9. **DeltaSync** — fills the gap between full-load (Bulk) and real-time (CDC/Stream); the most common production pattern for daily/hourly ETL from OLTP sources
10. **Scheduler** — high operational value once multiple pipeline products exist; best built after Forge and Temporal are established so the scheduling surface has real jobs to manage
11. **File Gateway** — solves a very common enterprise pain point (file drops from legacy systems); medium complexity with high practical value for brownfield integrations
12. **Reverse** — completes the data lifecycle story; high value for RevOps and marketing teams; best positioned after the ingestion products are mature
13. **Wormhole** — primarily an enterprise/regulated-industry product; high compliance value; best built after the core ingestion and quality products establish objectified-db as a trustworthy data store
