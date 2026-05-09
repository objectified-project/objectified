-- CLI import job persistence: odb.import_jobs (#3305, T4)
SET search_path TO odb, public;

CREATE TABLE IF NOT EXISTS odb.import_jobs (
    job_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES odb.tenants(id) ON DELETE CASCADE,
    project_id UUID NULL REFERENCES odb.projects(id) ON DELETE SET NULL,
    state TEXT NOT NULL CHECK (state IN (
        'queued', 'running', 'pending-approval', 'committing',
        'completed', 'failed', 'canceled', 'rolled-back')),
    source_kind TEXT NOT NULL CHECK (source_kind IN ('openapi', 'swagger', 'arazzo')),
    blob_sha TEXT NULL,
    repository_source JSONB NULL,
    input JSONB NOT NULL,
    events JSONB NOT NULL DEFAULT '[]'::jsonb,
    progress JSONB NULL,
    summary JSONB NULL,
    result JSONB NULL,
    percent SMALLINT NOT NULL DEFAULT 0,
    error JSONB NULL,
    created_by UUID NOT NULL REFERENCES odb.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS import_jobs_tenant_id_idx ON odb.import_jobs (tenant_id);
CREATE INDEX IF NOT EXISTS import_jobs_tenant_state_idx ON odb.import_jobs (tenant_id, state);
CREATE INDEX IF NOT EXISTS import_jobs_created_at_idx ON odb.import_jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS import_jobs_expires_at_idx ON odb.import_jobs (expires_at)
    WHERE state IN ('completed', 'failed', 'canceled', 'rolled-back');

COMMENT ON TABLE odb.import_jobs IS
    'Persisted spec-import job state for REST workers and importer sidecar (#3305); input is redacted (no credentials)';

COMMENT ON COLUMN odb.import_jobs.input IS 'Redacted ImportJobInput JSON for audit and retry';
COMMENT ON COLUMN odb.import_jobs.events IS 'Append-only event log JSON array; orchestrator caps length (e.g. last 1000)';
COMMENT ON COLUMN odb.import_jobs.result IS 'On success: { projectId, versionId }';

-- DOWN
-- Rollback (#3305): drops table and all attached indexes (no orphans)
-- DROP TABLE IF EXISTS odb.import_jobs CASCADE;
