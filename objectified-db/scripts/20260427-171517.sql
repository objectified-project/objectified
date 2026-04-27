-- REPO-12.1 / #2935: dispatch branch statuses for selection vs ready-to-promote gating.
SET search_path TO odb, public;

DO $$
BEGIN
  ALTER TYPE odb.repository_file_status ADD VALUE 'discovered';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TYPE odb.repository_file_status ADD VALUE 'ready_to_promote';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
