SET search_path TO odb, public;

-- Create enum type for visibility
CREATE TYPE visibility_type AS ENUM ('public', 'private');

-- Add visibility column to versions table with default value
ALTER TABLE versions ADD COLUMN visibility visibility_type NOT NULL DEFAULT 'private';

-- Add comment to the column
COMMENT ON COLUMN versions.visibility IS 'Visibility level of the version: public (accessible to all) or private (restricted access)';

