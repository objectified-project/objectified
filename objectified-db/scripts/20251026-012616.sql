-- Database Schema for Multi-tenant System
-- Tables: users, groups, tenants
-- All IDs use uuid_generate_v4() for automatic UUIDv4 generation

DROP SCHEMA IF EXISTS odb CASCADE;
CREATE SCHEMA odb;

-- Set the search path to use odb schema by default
SET search_path TO odb, public;

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT false,
    enabled BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Groups table
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    slug VARCHAR(255) NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tenants table
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    slug VARCHAR(255) NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Roles table
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table (named permissions with allow/deny scope)
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE, -- e.g., 'documents.create', 'users.assign_to_group'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Role permissions (assigns permissions to roles with allow/deny)
CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    scope VARCHAR(10) NOT NULL CHECK (scope IN ('allow', 'deny')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, permission_id)
);

-- User roles (assigns roles to users, can be scoped to tenant or group)
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL means global
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,   -- NULL means not group-specific
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role_id, tenant_id, group_id)
);

-- User verification codes (for email verification with 30-minute expiry)
CREATE TABLE user_verification_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 minutes'),
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User Groups (assigns users to groups)
CREATE TABLE user_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, group_id)
);

-- Group Hierarchies (groups can contain other groups)
CREATE TABLE group_hierarchies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    child_group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(parent_group_id, child_group_id),
    CHECK (parent_group_id != child_group_id) -- Prevent self-reference
);

-- Tenant Users (assigns users to tenants)
CREATE TABLE tenant_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, user_id)
);

-- Tenant Groups (assigns groups to tenants)
CREATE TABLE tenant_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, group_id)
);

-- Group Administrators (assigns users as admins of groups)
CREATE TABLE group_administrators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, user_id)
);

-- Tenant Administrators (assigns users as admins of tenants)
CREATE TABLE tenant_administrators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, user_id)
);

-- Indexes for administrator tables
CREATE INDEX idx_group_administrators_group_id ON group_administrators(group_id);
CREATE INDEX idx_group_administrators_user_id ON group_administrators(user_id);
CREATE INDEX idx_tenant_administrators_tenant_id ON tenant_administrators(tenant_id);
CREATE INDEX idx_tenant_administrators_user_id ON tenant_administrators(user_id);

-- Table descriptions
COMMENT ON TABLE group_administrators IS 'Assigns users as administrators of groups with management privileges';
COMMENT ON TABLE tenant_administrators IS 'Assigns users as administrators of tenants with management privileges';

-- Indexes for tenant membership tables
CREATE INDEX idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX idx_tenant_users_user_id ON tenant_users(user_id);
CREATE INDEX idx_tenant_groups_tenant_id ON tenant_groups(tenant_id);
CREATE INDEX idx_tenant_groups_group_id ON tenant_groups(group_id);

-- Table descriptions
COMMENT ON TABLE tenant_users IS 'Assigns users to tenants for multi-tenant access control';
COMMENT ON TABLE tenant_groups IS 'Assigns groups to tenants, allowing group-based tenant membership';

-- Indexes for join tables
CREATE INDEX idx_user_groups_user_id ON user_groups(user_id);
CREATE INDEX idx_user_groups_group_id ON user_groups(group_id);
CREATE INDEX idx_group_hierarchies_parent ON group_hierarchies(parent_group_id);
CREATE INDEX idx_group_hierarchies_child ON group_hierarchies(child_group_id);

-- Table descriptions
COMMENT ON TABLE user_groups IS 'Assigns users to groups for membership and access control';
COMMENT ON TABLE group_hierarchies IS 'Defines parent-child relationships between groups, allowing nested group structures';
COMMENT ON COLUMN group_hierarchies.parent_group_id IS 'The parent group that contains the child group';
COMMENT ON COLUMN group_hierarchies.child_group_id IS 'The child group that belongs to the parent group';

        -- Indexes for common queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_verified ON users(verified);
CREATE INDEX idx_groups_slug ON groups(slug);
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_permissions_name ON permissions(name);
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX idx_user_roles_tenant_id ON user_roles(tenant_id);
CREATE INDEX idx_user_roles_group_id ON user_roles(group_id);
CREATE INDEX idx_verification_codes_user_id ON user_verification_codes(user_id);
CREATE INDEX idx_verification_codes_code ON user_verification_codes(code);
CREATE INDEX idx_verification_codes_expires_at ON user_verification_codes(expires_at);

-- Trigger function to automatically clean up expired codes
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes_trigger()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM user_verification_codes
    WHERE expires_at < CURRENT_TIMESTAMP AND used_at IS NULL;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to clean up on INSERT (when new verification codes are created)
CREATE TRIGGER trigger_cleanup_on_insert
BEFORE INSERT ON user_verification_codes
FOR EACH STATEMENT
EXECUTE FUNCTION cleanup_expired_verification_codes_trigger();

-- Trigger to clean up on UPDATE (when verification codes are checked/used)
CREATE TRIGGER trigger_cleanup_on_update
BEFORE UPDATE ON user_verification_codes
FOR EACH STATEMENT
EXECUTE FUNCTION cleanup_expired_verification_codes_trigger();

