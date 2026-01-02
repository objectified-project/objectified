-- Path Tags Migration
-- Adds junction table for linking API paths to tags for operational grouping
-- This follows the same pattern as class_tags and operation_tags

SET search_path TO odb, public;

-- ============================================================================
-- PATH TAGS TABLE
-- Junction table linking API paths to tags
-- Enables operational grouping of paths (e.g., by domain, team, status, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS path_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    path_id UUID NOT NULL REFERENCES api_paths(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT path_tags_unique UNIQUE (path_id, tag_id)
);

COMMENT ON TABLE path_tags IS 'Junction table linking API paths to project tags for operational grouping';
COMMENT ON COLUMN path_tags.id IS 'Unique identifier for the path-tag relationship';
COMMENT ON COLUMN path_tags.path_id IS 'Reference to the API path';
COMMENT ON COLUMN path_tags.tag_id IS 'Reference to the project tag';
COMMENT ON COLUMN path_tags.created_at IS 'Timestamp when the tag was assigned to the path';

-- Indices for performance
CREATE INDEX idx_path_tags_path_id ON path_tags(path_id);
CREATE INDEX idx_path_tags_tag_id ON path_tags(tag_id);
CREATE INDEX idx_path_tags_created_at ON path_tags(created_at);
