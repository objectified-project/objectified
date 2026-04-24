-- REPO-3.1 / #2780: Add last_known_etag to repository_branch for proper GitHub conditional request support.
SET search_path TO odb, public;

ALTER TABLE odb.repository_branch
  ADD COLUMN IF NOT EXISTS last_known_etag VARCHAR(255);

COMMENT ON COLUMN odb.repository_branch.last_known_etag IS
  'The ETag header value returned by the provider on the last successful HEAD commit fetch; used for If-None-Match conditional requests (#2780).';
