-- REPO-11.1 / #2941: per-repository "needs attention" materialized rollup.
SET search_path TO odb, public;

ALTER TABLE IF EXISTS odb.repository_file
  ADD COLUMN IF NOT EXISTS last_imported_checksum VARCHAR(64) CHECK (last_imported_checksum IS NULL OR last_imported_checksum ~ '^[0-9a-f]{64}$'),
  ADD COLUMN IF NOT EXISTS stale_mismatch_at TIMESTAMPTZ;

COMMENT ON COLUMN odb.repository_file.last_imported_checksum IS
  'SHA-256 of file content at last successful import commit; used for stale / ready-to-import signals (#2941).';
COMMENT ON COLUMN odb.repository_file.stale_mismatch_at IS
  'When a sustained checksum drift was first seen for the ready-to-promote bucket; cleared on match or when auto_import is on (#2941).';

CREATE TABLE IF NOT EXISTS odb.repository_attention (
  repository_id UUID NOT NULL PRIMARY KEY REFERENCES odb.repository(id) ON DELETE CASCADE,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reasons TEXT[] NOT NULL,
  open_count INTEGER NOT NULL,
  attention_score SMALLINT NOT NULL,
  last_change_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_repository_attention_computed_at
  ON odb.repository_attention (computed_at DESC);

COMMENT ON TABLE odb.repository_attention IS
  'O(1) dashboard rollup of repository health signals; recomputed on events + hourly safety sweep (#2941).';

COMMENT ON COLUMN odb.repository_attention.reasons IS
  'One or more of: parse_error, manifest_error, token_revoked, scheduler_paused, repeated_failures, stale_checksum, import_failed.';
COMMENT ON COLUMN odb.repository_attention.open_count IS
  'Distinct spec paths with file-level issues contributing to "needs attention".';
COMMENT ON COLUMN odb.repository_attention.attention_score IS
  'Sum of reason weights, capped at 100.';
