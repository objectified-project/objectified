-- Fixture: one import_jobs row per terminal state for REST/UI harnesses (#3305).
-- Apply after migrations including 20260508-120000.sql. Idempotent for these UUIDs.
--
-- Expect:
--   SELECT state, count(*) FROM odb.import_jobs
--   WHERE tenant_id = 'a3305305-0001-4000-8000-000000000001'::uuid
--   GROUP BY state ORDER BY state;
--   → four rows: canceled, completed, failed, rolled-back
--
SET search_path TO odb, public;

BEGIN;

DELETE FROM odb.import_jobs
WHERE tenant_id = 'a3305305-0001-4000-8000-000000000001'::uuid;

DELETE FROM odb.tenant_users
WHERE tenant_id = 'a3305305-0001-4000-8000-000000000001'::uuid
  AND user_id = 'a3305305-0002-4000-8000-000000000002'::uuid;

DELETE FROM odb.tenants WHERE id = 'a3305305-0001-4000-8000-000000000001'::uuid;
DELETE FROM odb.users WHERE id = 'a3305305-0002-4000-8000-000000000002'::uuid;

INSERT INTO odb.users (id, name, email, password)
VALUES (
    'a3305305-0002-4000-8000-000000000002',
    'Import Jobs Fixture User',
    'import-jobs-fixture-3305@objectified.local',
    '$2b$04$fixture-not-a-real-hash-used-for-dev-only'
);

INSERT INTO odb.tenants (id, name, slug)
VALUES (
    'a3305305-0001-4000-8000-000000000001',
    'Import Jobs Fixture Tenant',
    'import-jobs-fixture-tenant-3305'
);

INSERT INTO odb.tenant_users (tenant_id, user_id)
VALUES (
    'a3305305-0001-4000-8000-000000000001',
    'a3305305-0002-4000-8000-000000000002'
);

INSERT INTO odb.import_jobs (
    job_id,
    tenant_id,
    project_id,
    state,
    source_kind,
    input,
    events,
    percent,
    result,
    error,
    created_by,
    finished_at,
    expires_at
)
VALUES (
    'a3305305-1001-4000-8000-000000000001',
    'a3305305-0001-4000-8000-000000000001',
    NULL,
    'completed',
    'openapi',
    '{"fixture": true, "kind": "terminal-completed"}'::jsonb,
    '[{"type": "completed", "at": "fixture"}]'::jsonb,
    100,
    '{"projectId": "b3305305-0001-4000-8000-000000000001", "versionId": "b3305305-0002-4000-8000-000000000002"}'::jsonb,
    NULL,
    'a3305305-0002-4000-8000-000000000002',
    now() - INTERVAL '1 hour',
    now() + INTERVAL '7 days'
),
(
    'a3305305-1002-4000-8000-000000000002',
    'a3305305-0001-4000-8000-000000000001',
    NULL,
    'failed',
    'swagger',
    '{"fixture": true, "kind": "terminal-failed"}'::jsonb,
    '[{"type": "failed", "at": "fixture"}]'::jsonb,
    40,
    NULL,
    '{"code": "fixture_error", "message": "Harness terminal failed state"}'::jsonb,
    'a3305305-0002-4000-8000-000000000002',
    now() - INTERVAL '2 hours',
    now() + INTERVAL '7 days'
),
(
    'a3305305-1003-4000-8000-000000000003',
    'a3305305-0001-4000-8000-000000000001',
    NULL,
    'canceled',
    'arazzo',
    '{"fixture": true, "kind": "terminal-canceled"}'::jsonb,
    '[{"type": "canceled", "at": "fixture"}]'::jsonb,
    10,
    NULL,
    NULL,
    'a3305305-0002-4000-8000-000000000002',
    now() - INTERVAL '3 hours',
    now() + INTERVAL '7 days'
),
(
    'a3305305-1004-4000-8000-000000000004',
    'a3305305-0001-4000-8000-000000000001',
    NULL,
    'rolled-back',
    'openapi',
    '{"fixture": true, "kind": "terminal-rolled-back"}'::jsonb,
    '[{"type": "rolled-back", "at": "fixture"}]'::jsonb,
    0,
    NULL,
    NULL,
    'a3305305-0002-4000-8000-000000000002',
    now() - INTERVAL '4 hours',
    now() + INTERVAL '7 days'
);

COMMIT;
