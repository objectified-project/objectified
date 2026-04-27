-- REPO-9.1 / #2931: per-spec import opt-in on repository_file.
SET search_path TO odb, public;

ALTER TABLE IF EXISTS odb.repository_file
  ADD COLUMN IF NOT EXISTS import_enabled BOOLEAN;

-- Existing rows are treated as opted-in; new rows default to FALSE after the migration.
UPDATE odb.repository_file
SET import_enabled = TRUE
WHERE import_enabled IS NULL;

ALTER TABLE IF EXISTS odb.repository_file
  ALTER COLUMN import_enabled SET NOT NULL,
  ALTER COLUMN import_enabled SET DEFAULT FALSE;
