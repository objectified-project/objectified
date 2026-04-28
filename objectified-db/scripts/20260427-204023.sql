-- REPO-12.4 / #2937: persisted repository_scan_report artifact + tenant retention override.
SET search_path TO odb, public;

ALTER TABLE odb.tenants
  ADD COLUMN IF NOT EXISTS repository_scan_report_retention_days INTEGER;

COMMENT ON COLUMN odb.tenants.repository_scan_report_retention_days IS
  'Optional Enterprise override for repository_scan_report retention (days); NULL uses deployment default (90).';

CREATE TABLE IF NOT EXISTS odb.repository_scan_report (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scan_id UUID NOT NULL REFERENCES odb.repository_scan(id) ON DELETE CASCADE,
  repository_id UUID NOT NULL REFERENCES odb.repository(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL,
  totals_json JSONB NOT NULL,
  attention_score SMALLINT NOT NULL,
  payload_json JSONB NOT NULL,
  payload_overflow_url TEXT,
  CONSTRAINT uq_repository_scan_report_repo_scan UNIQUE (repository_id, scan_id),
  CONSTRAINT chk_repository_scan_report_attention CHECK (
    attention_score >= 0 AND attention_score <= 100
  )
);

CREATE INDEX IF NOT EXISTS idx_repository_scan_report_repository_generated_at
  ON odb.repository_scan_report (repository_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_repository_scan_report_generated_at
  ON odb.repository_scan_report (generated_at);

COMMENT ON TABLE odb.repository_scan_report IS
  'Point-in-time scan totals + bounded file payload (REPO-12.4 / #2937); overflow blob URL when >5000 rows.';
