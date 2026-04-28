-- REPO-12.3 / #2936: repository_file tracks last imported revision for idempotency.
SET search_path TO odb, public;

ALTER TABLE IF EXISTS odb.repository_file
  ADD COLUMN IF NOT EXISTS last_imported_version_id UUID REFERENCES odb.versions(id) ON DELETE SET NULL;

COMMENT ON COLUMN odb.repository_file.last_imported_version_id IS
  'ODB revision created by the last successful repository auto-import commit (#2936).';
