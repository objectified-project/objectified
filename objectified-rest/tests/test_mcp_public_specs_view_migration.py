"""Guardrails for MCP public specs view migration and dev fixture (#3004)."""

from pathlib import Path

_MIGRATION_FRAGMENTS = (
    "CREATE OR REPLACE VIEW odb.mcp_v_public_specs",
    "p.name AS title",
    "v.version_id AS version",
    "AS tags",
    "FROM odb.versions v",
    "INNER JOIN odb.projects p",
    "version_tags",
    "v.published IS TRUE",
    "v.visibility = 'public'::odb.visibility_type",
    "COMMENT ON VIEW odb.mcp_v_public_specs",
    "COMMENT ON COLUMN odb.mcp_v_public_specs.tags",
)

_FIXTURE_FRAGMENTS = (
    "Dev fixture for odb.mcp_v_public_specs",
    "SELECT count(*) FROM odb.mcp_v_public_specs",
    "00000000-0000-4000-8000-000000000004",
    "INSERT INTO odb.version_tags",
)


def test_migration_defines_mcp_v_public_specs(repo_root: Path) -> None:
    migration = repo_root / "objectified-db" / "scripts" / "20260502-130000.sql"
    text = migration.read_text()
    missing = [frag for frag in _MIGRATION_FRAGMENTS if frag not in text]
    assert not missing, f"Migration missing expected fragments: {missing}"


def test_dev_fixture_documents_public_specs_view(repo_root: Path) -> None:
    fixture = repo_root / "objectified-db" / "fixtures" / "mcp_public_specs_dev.sql"
    text = fixture.read_text()
    missing = [frag for frag in _FIXTURE_FRAGMENTS if frag not in text]
    assert not missing, f"Fixture missing expected fragments: {missing}"
