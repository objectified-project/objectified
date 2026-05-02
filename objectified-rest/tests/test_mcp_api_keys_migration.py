"""Guardrails for MCP API keys table migration (#2997)."""

from pathlib import Path


def test_migration_creates_mcp_api_keys_table():
    repo_root = Path(__file__).resolve().parents[2]
    migration = repo_root / "objectified-db" / "scripts" / "20260502-120000.sql"
    text = migration.read_text()
    assert "CREATE TABLE IF NOT EXISTS mcp_api_keys" in text
    assert "key_hash" in text
    assert "prefix" in text
    assert "label" in text
    assert "tenant_id" in text
    assert "scope_json" in text
    assert "created_by" in text
    assert "created_at" in text
    assert "expires_at" in text
    assert "revoked_at" in text
    assert "last_used_at" in text
    assert "idx_mcp_api_keys_prefix" in text
    assert "REFERENCES odb.tenants(id)" in text
    assert "chk_mcp_api_keys_expires_after_created" in text
    assert "chk_mcp_api_keys_revoked_after_created" in text
