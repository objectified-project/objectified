-- REPO-9.1 / #2931: per-spec import opt-in on repository_file.
SET search_path TO odb, public;

DO $$
BEGIN
  IF to_regclass('odb.repository_file') IS NOT NULL THEN
    ALTER TABLE odb.repository_file
      ADD COLUMN IF NOT EXISTS import_enabled BOOLEAN,
      ADD COLUMN IF NOT EXISTS auto_import_enabled BOOLEAN;

    -- Existing rows are treated as opted-in; new rows default to FALSE after the migration.
    UPDATE odb.repository_file
    SET import_enabled = TRUE
    WHERE import_enabled IS NULL;

    UPDATE odb.repository_file
    SET auto_import_enabled = FALSE
    WHERE auto_import_enabled IS NULL;

    UPDATE odb.repository_file
    SET auto_import_enabled = FALSE
    WHERE import_enabled = FALSE
      AND auto_import_enabled = TRUE;

    ALTER TABLE odb.repository_file
      ALTER COLUMN import_enabled SET NOT NULL,
      ALTER COLUMN import_enabled SET DEFAULT FALSE,
      ALTER COLUMN auto_import_enabled SET NOT NULL,
      ALTER COLUMN auto_import_enabled SET DEFAULT FALSE;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION odb.repository_file_clear_auto_import_when_import_disabled()
RETURNS trigger AS $$
BEGIN
  IF NEW.import_enabled IS NOT TRUE THEN
    NEW.auto_import_enabled := FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF to_regclass('odb.repository_file') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_trigger
       WHERE tgname = 'trg_repository_file_clear_auto_import_when_import_disabled'
         AND tgrelid = 'odb.repository_file'::regclass
         AND NOT tgisinternal
     ) THEN
    CREATE TRIGGER trg_repository_file_clear_auto_import_when_import_disabled
    BEFORE INSERT OR UPDATE OF import_enabled, auto_import_enabled
    ON odb.repository_file
    FOR EACH ROW
    EXECUTE FUNCTION odb.repository_file_clear_auto_import_when_import_disabled();
  END IF;
END;
$$;
