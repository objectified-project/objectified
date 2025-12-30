SET search_path TO odb, public;

-- ============================================================================
-- SCHEMA CAPTURE TABLE
-- Immutable snapshot of a finalized version schema
-- ============================================================================
CREATE TABLE schema_capture (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES odb.versions(id) ON DELETE CASCADE,
    schema JSONB NOT NULL,
    captured_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    captured_by UUID REFERENCES odb.users(id),
    CONSTRAINT schema_capture_version_unique UNIQUE (version_id)
);

COMMENT ON TABLE schema_capture IS 'Immutable snapshot of a finalized version schema';
COMMENT ON COLUMN schema_capture.schema IS 'Complete JSON Schema snapshot for the version';

CREATE INDEX idx_schema_capture_version_id ON schema_capture(version_id);
CREATE INDEX idx_schema_capture_captured_at ON schema_capture(captured_at);
CREATE INDEX idx_schema_capture_schema ON schema_capture USING GIN (schema);

-- ============================================================================
-- SCHEMA CAPTURE CLASS TABLE
-- Individual class definitions within a captured schema
-- ============================================================================
CREATE TABLE schema_capture_class (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schema_capture_id UUID NOT NULL REFERENCES odb.schema_capture(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES odb.classes(id) ON DELETE RESTRICT,
    class_name TEXT NOT NULL,
    class_schema JSONB NOT NULL,
    CONSTRAINT schema_capture_class_unique UNIQUE (schema_capture_id, class_id)
);

COMMENT ON TABLE schema_capture_class IS 'Individual class definitions within a schema capture';
COMMENT ON COLUMN schema_capture_class.class_schema IS 'Full JSON Schema for this class including properties and validation rules';

CREATE INDEX idx_schema_capture_class_capture_id ON schema_capture_class(schema_capture_id);
CREATE INDEX idx_schema_capture_class_class_id ON schema_capture_class(class_id);
CREATE INDEX idx_schema_capture_class_name ON schema_capture_class(class_name);
CREATE INDEX idx_schema_capture_class_schema ON schema_capture_class USING GIN (class_schema);

-- ============================================================================
-- INSTANCE ACTION ENUM
-- ============================================================================
CREATE TYPE instance_action AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- ============================================================================
-- INSTANCE TABLE
-- Represents a logical data object tied to a schema class
-- ============================================================================
CREATE TABLE instance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schema_capture_class_id UUID NOT NULL REFERENCES odb.schema_capture_class(id) ON DELETE RESTRICT,
    tenant_id UUID NOT NULL REFERENCES odb.tenants(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES odb.users(id) ON DELETE RESTRICT,
    name VARCHAR(80) NOT NULL,
    description TEXT,
    status instance_action NOT NULL DEFAULT 'CREATE',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    deleted_at TIMESTAMP WITHOUT TIME ZONE
);

COMMENT ON TABLE instance IS 'Logical data object instance tied to a schema class';
COMMENT ON COLUMN instance.is_active IS 'FALSE when soft-deleted';
COMMENT ON COLUMN instance.status IS 'Current lifecycle status of the instance';

CREATE INDEX idx_instance_schema_capture_class_id ON instance(schema_capture_class_id);
CREATE INDEX idx_instance_tenant_id ON instance(tenant_id);
CREATE INDEX idx_instance_owner_id ON instance(owner_id);
CREATE INDEX idx_instance_status ON instance(status);
CREATE INDEX idx_instance_is_active ON instance(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_instance_created_at ON instance(created_at);
CREATE INDEX idx_instance_tenant_class ON instance(tenant_id, schema_capture_class_id) WHERE is_active = TRUE;

-- ============================================================================
-- INSTANCE DATA TABLE
-- Event-sourced versioned data for each instance
-- ============================================================================
CREATE TABLE instance_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID NOT NULL REFERENCES odb.instance(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES odb.users(id) ON DELETE RESTRICT,
    action instance_action NOT NULL,
    data JSONB NOT NULL,
    vector vector,
    version INT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    CONSTRAINT instance_data_version_unique UNIQUE (instance_id, version)
);

COMMENT ON TABLE instance_data IS 'Event-sourced versioned data storage for instances';
COMMENT ON COLUMN instance_data.action IS 'CREATE for initial, UPDATE for delta, DELETE for soft-delete marker';
COMMENT ON COLUMN instance_data.data IS 'Full data for CREATE, delta/patch for UPDATE, empty for DELETE';
COMMENT ON COLUMN instance_data.version IS 'Auto-incremented version per instance, starting from 1';
COMMENT ON COLUMN instance_data.vector IS 'Optional embedding vector for similarity search';

-- Function to auto-increment version per instance_id
CREATE OR REPLACE FUNCTION set_instance_data_version()
RETURNS TRIGGER AS $$
BEGIN
    SELECT COALESCE(MAX(version), 0) + 1 INTO NEW.version
    FROM odb.instance_data
    WHERE instance_id = NEW.instance_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set version before insert
CREATE TRIGGER trigger_set_instance_data_version
    BEFORE INSERT ON instance_data
    FOR EACH ROW
    EXECUTE FUNCTION set_instance_data_version();

-- Primary lookup indices
CREATE INDEX idx_instance_data_instance_id ON instance_data(instance_id);
CREATE INDEX idx_instance_data_user_id ON instance_data(user_id);
CREATE INDEX idx_instance_data_action ON instance_data(action);

-- Version lookups (latest first)
CREATE INDEX idx_instance_data_instance_version ON instance_data(instance_id, version DESC);

-- Time-based queries
CREATE INDEX idx_instance_data_created_at ON instance_data(created_at);

-- JSONB GIN index for data queries
CREATE INDEX idx_instance_data_data ON instance_data USING GIN (data);

-- ============================================================================
-- INSTANCE SNAPSHOT TABLE
-- Materialized current state for fast reads
-- ============================================================================
CREATE TABLE instance_snapshot (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID NOT NULL REFERENCES odb.instance(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES odb.tenants(id) ON DELETE CASCADE,
    current_data JSONB NOT NULL,
    current_vector vector,
    last_version INT NOT NULL,
    last_data_id UUID NOT NULL REFERENCES odb.instance_data(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    CONSTRAINT instance_snapshot_instance_unique UNIQUE (instance_id)
);

COMMENT ON TABLE instance_snapshot IS 'Materialized current state for O(1) reads';
COMMENT ON COLUMN instance_snapshot.current_data IS 'Fully merged JSONB representing current object state';
COMMENT ON COLUMN instance_snapshot.last_version IS 'Version number of last applied event';
COMMENT ON COLUMN instance_snapshot.is_active IS 'FALSE if the instance has been soft-deleted';

CREATE INDEX idx_instance_snapshot_instance_id ON instance_snapshot(instance_id);
CREATE INDEX idx_instance_snapshot_tenant_id ON instance_snapshot(tenant_id);
CREATE INDEX idx_instance_snapshot_is_active ON instance_snapshot(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_instance_snapshot_tenant_active ON instance_snapshot(tenant_id) WHERE is_active = TRUE;
CREATE INDEX idx_instance_snapshot_current_data ON instance_snapshot USING GIN (current_data);
CREATE INDEX idx_instance_snapshot_updated_at ON instance_snapshot(updated_at);

