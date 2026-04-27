-- REPO-8.1 / #2929: provider-agnostic repository file content checksums.
SET search_path TO odb, public;

ALTER TABLE IF EXISTS odb.repository_file
  ADD COLUMN IF NOT EXISTS content_checksum VARCHAR(64) CHECK (content_checksum ~ '^[0-9a-f]{64}$');

ALTER TABLE IF EXISTS odb.repository_file
  ADD COLUMN IF NOT EXISTS content_algo VARCHAR(16) NOT NULL DEFAULT 'sha256';

CREATE INDEX IF NOT EXISTS idx_repository_file_content_checksum
  ON odb.repository_file (content_checksum)
  WHERE content_checksum IS NOT NULL;
