-- REPO-4.5 / #2783: Track poll failure backoff state for auto-pause logic.
SET search_path TO odb, public;

ALTER TABLE odb.repository_branch
  ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error_code VARCHAR(128),
  ADD COLUMN IF NOT EXISTS last_error_detail TEXT;

COMMENT ON COLUMN odb.repository_branch.consecutive_failures IS
  'Consecutive provider head-detection failures for the tracked branch; reset to 0 after a successful poll head check (#2783).';

COMMENT ON COLUMN odb.repository_branch.last_error_code IS
  'Most recent provider failure code recorded during poll head detection (#2783).';

COMMENT ON COLUMN odb.repository_branch.last_error_detail IS
  'Most recent provider failure detail recorded during poll head detection (#2783).';
