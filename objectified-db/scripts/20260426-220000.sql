-- REPO-8.2 / #2930: version provenance tuple (repository_source).
SET search_path TO odb, public;

ALTER TABLE IF EXISTS odb.versions
  ADD COLUMN IF NOT EXISTS repository_source JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'versions_repository_source_shape_check'
      AND conrelid = 'odb.versions'::regclass
  ) THEN
    ALTER TABLE odb.versions
      ADD CONSTRAINT versions_repository_source_shape_check
      CHECK (
        repository_source IS NULL
        OR (
          jsonb_typeof(repository_source) = 'object'
          AND repository_source ?& ARRAY[
            'repositoryId',
            'branch',
            'path',
            'commitSha',
            'contentChecksum',
            'contentAlgo',
            'importedAt'
          ]
          AND jsonb_typeof(repository_source->'repositoryId') = 'string'
          AND (repository_source->>'repositoryId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          AND jsonb_typeof(repository_source->'branch') = 'string'
          AND char_length(repository_source->>'branch') <= 256
          AND jsonb_typeof(repository_source->'path') = 'string'
          AND char_length(repository_source->>'path') <= 1024
          AND jsonb_typeof(repository_source->'commitSha') = 'string'
          AND (repository_source->>'commitSha') ~ '^[0-9a-f]{40,64}$'
          AND jsonb_typeof(repository_source->'contentChecksum') = 'string'
          AND (repository_source->>'contentChecksum') ~ '^[0-9a-f]{64}$'
          AND jsonb_typeof(repository_source->'contentAlgo') = 'string'
          AND (repository_source->>'contentAlgo') = 'sha256'
          AND jsonb_typeof(repository_source->'importedAt') = 'string'
          AND (repository_source->>'importedAt') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(?:Z|[+-]\d{2}:\d{2})$'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_version_repo_source_lookup
  ON odb.versions ((repository_source->>'repositoryId'), (repository_source->>'path'))
  WHERE repository_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_version_content_checksum
  ON odb.versions ((repository_source->>'contentChecksum'))
  WHERE repository_source IS NOT NULL;
