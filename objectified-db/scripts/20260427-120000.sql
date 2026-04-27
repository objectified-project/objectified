-- REPO-9.1 / #2931: per-spec import opt-in on repository_file.
SET search_path TO odb, public;

DO $$
BEGIN
  IF to_regclass('odb.repository_file') IS NOT NULL THEN
    ALTER TABLE odb.repository_file
      ADD COLUMN IF NOT EXISTS import_enabled BOOLEAN;

    -- Existing rows are treated as opted-in; new rows default to FALSE after the migration.
    UPDATE odb.repository_file
    SET import_enabled = TRUE
    WHERE import_enabled IS NULL;

    ALTER TABLE odb.repository_file
      ALTER COLUMN import_enabled SET NOT NULL,
      ALTER COLUMN import_enabled SET DEFAULT FALSE;
  END IF;
END;
$$;
