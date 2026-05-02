-- Dev fixture for odb.mcp_v_public_specs (#3004).
-- Apply after all migrations. Idempotent for these UUIDs: deletes the fixture project (cascades versions/tags), then reinserts.
--
-- Expect after load:
--   SELECT count(*) FROM odb.mcp_v_public_specs WHERE project_id = '00000000-0000-4000-8000-000000000003'::uuid;
--   → 1 (only the 1.0.0 public published revision).
--
SET search_path TO odb, public;

BEGIN;

DELETE FROM odb.projects WHERE id = '00000000-0000-4000-8000-000000000003'::uuid;
DELETE FROM odb.tenant_users
WHERE tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
  AND user_id = '00000000-0000-4000-8000-000000000002'::uuid;
DELETE FROM odb.tenants WHERE id = '00000000-0000-4000-8000-000000000001'::uuid;
DELETE FROM odb.users WHERE id = '00000000-0000-4000-8000-000000000002'::uuid;

INSERT INTO odb.users (id, name, email, password)
VALUES (
  '00000000-0000-4000-8000-000000000002',
  'MCP Fixture User',
  'mcp-fixture-3004@objectified.local',
  '$2b$04$fixture-not-a-real-hash-used-for-dev-only'
);

INSERT INTO odb.tenants (id, name, slug)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'MCP Fixture Tenant',
  'mcp-fixture-tenant-3004'
);

INSERT INTO odb.tenant_users (tenant_id, user_id)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002'
);

INSERT INTO odb.projects (id, tenant_id, creator_id, name, slug)
VALUES (
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'MCP Fixture Project',
  'mcp-fixture-project-3004'
);

INSERT INTO odb.versions (
  id,
  project_id,
  creator_id,
  version_id,
  description,
  published,
  visibility,
  enabled
)
VALUES (
  '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000002',
  '1.0.0',
  'Published public revision for MCP view tests',
  TRUE,
  'public',
  TRUE
),
(
  '00000000-0000-4000-8000-000000000005',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000002',
  '0.9.0',
  'Published but private — excluded from mcp_v_public_specs',
  TRUE,
  'private',
  TRUE
),
(
  '00000000-0000-4000-8000-000000000006',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000002',
  '0.8.0',
  'Public visibility but unpublished — excluded from mcp_v_public_specs',
  FALSE,
  'public',
  TRUE
);

INSERT INTO odb.version_tags (project_id, version_id, name)
VALUES (
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004',
  'release'
);

COMMIT;
