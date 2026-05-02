-- MCP-1.3 (#2824): api_keys purpose/scopes for MCP vs REST; optional owner linkage.
SET search_path TO odb, public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'odb' AND table_name = 'api_keys' AND column_name = 'purpose'
  ) THEN
    ALTER TABLE odb.api_keys
      ADD COLUMN purpose VARCHAR(16) NOT NULL DEFAULT 'rest'
        CONSTRAINT api_keys_purpose_chk CHECK (purpose IN ('rest', 'mcp', 'both'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'odb' AND table_name = 'api_keys' AND column_name = 'scopes'
  ) THEN
    ALTER TABLE odb.api_keys
      ADD COLUMN scopes TEXT[] NOT NULL DEFAULT '{}';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'odb' AND table_name = 'api_keys' AND column_name = 'label'
  ) THEN
    ALTER TABLE odb.api_keys
      ADD COLUMN label VARCHAR(120);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'odb' AND table_name = 'api_keys' AND column_name = 'owner_user_id'
  ) THEN
    ALTER TABLE odb.api_keys
      ADD COLUMN owner_user_id UUID REFERENCES odb.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS api_keys_purpose_idx
  ON odb.api_keys (purpose)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN odb.api_keys.purpose IS 'rest: REST-only key; mcp: MCP-only key; both: allowed for either surface';
COMMENT ON COLUMN odb.api_keys.scopes IS 'RBAC scope strings enforced by MCP (MCP-1.4)';
COMMENT ON COLUMN odb.api_keys.label IS 'Optional short label for MCP keys (Linked Accounts UI)';
COMMENT ON COLUMN odb.api_keys.owner_user_id IS 'User who owns this key when minted from Linked Accounts; optional for legacy REST keys';
