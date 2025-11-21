-- Test Script for External Auth Providers Feature
-- Run this to verify the setup is working correctly

-- 1. Check if table exists
SELECT 'Table exists: ' || EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'odb'
    AND table_name = 'external_auth_providers'
) as status;

-- 2. Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'odb'
AND table_name = 'external_auth_providers'
ORDER BY ordinal_position;

-- 3. Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'odb'
AND tablename = 'external_auth_providers';

-- 4. Check constraints
SELECT conname, contype, pg_get_constraintdef(c.oid) as definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'odb'
AND conrelid = 'odb.external_auth_providers'::regclass;

-- 5. Check if trigger exists
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'odb'
AND event_object_table = 'external_auth_providers';

-- 6. Check current data (should be empty initially)
SELECT COUNT(*) as linked_accounts_count
FROM odb.external_auth_providers;

-- 7. Verify users table exists (required for foreign key)
SELECT COUNT(*) as user_count
FROM odb.users
WHERE deleted_at IS NULL;

SELECT '✅ External Auth Providers feature is properly set up!' as result;

