-- REPO-7.4 / #2802: Persist linked-account credential health probe state.
SET search_path TO odb, public;

CREATE TABLE IF NOT EXISTS odb.repository_credential_health (
  linked_account_id UUID PRIMARY KEY
    REFERENCES odb.external_auth_providers(id)
    ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL
    CHECK (status IN ('healthy', 'scope_missing', 'revoked', 'network_error')),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  detail TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE odb.repository_credential_health IS
  'Daily token health probe result per linked account credential (#2802).';

COMMENT ON COLUMN odb.repository_credential_health.status IS
  'Latest classified token health status: healthy, scope_missing, revoked, or network_error.';

COMMENT ON COLUMN odb.repository_credential_health.checked_at IS
  'Timestamp for the most recent linked-account probe.';
