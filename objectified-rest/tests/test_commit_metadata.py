"""Commit metadata on revisions: author, message, externalRef (#2563)."""

from pathlib import Path

from app.models import VersionCreateRequest, VersionSchema


def test_migration_adds_commit_metadata_columns():
    repo_root = Path(__file__).resolve().parents[2]
    migration = repo_root / "objectified-db" / "scripts" / "20260411-120000.sql"
    text = migration.read_text()
    assert "commit_author" in text
    assert "commit_message" in text
    assert "external_ref" in text
    assert "ADD COLUMN" in text


def test_version_create_request_accepts_camel_case_commit_fields():
    body = VersionCreateRequest.model_validate(
        {
            "version_id": "1.0.0",
            "shortMessage": "subject",
            "author": "CI Bot",
            "message": "Full body",
            "externalRef": "LINEAR-42",
        }
    )
    assert body.author == "CI Bot"
    assert body.message == "Full body"
    assert body.external_ref == "LINEAR-42"


def test_version_schema_serializes_commit_metadata_with_api_aliases():
    row = {
        "id": "rev-1",
        "project_id": "p1",
        "creator_id": None,
        "version_id": "1.0.0",
        "description": "subject",
        "change_log": None,
        "visibility": "private",
        "published": False,
        "published_at": None,
        "enabled": True,
        "parent_version_id": None,
        "merge_parent_version_id": None,
        "revision_locked": False,
        "metadata": {},
        "commit_author": "alice",
        "commit_message": "details",
        "external_ref": "JIRA-1",
        "creator_name": None,
        "creator_email": None,
        "project_name": None,
        "project_slug": None,
        "created_at": None,
        "updated_at": None,
    }
    out = VersionSchema(**row).model_dump(by_alias=True, exclude_none=False)
    assert out["author"] == "alice"
    assert out["message"] == "details"
    assert out["externalRef"] == "JIRA-1"


def test_version_schema_null_commit_metadata_renders():
    row = {
        "id": "rev-1",
        "project_id": "p1",
        "creator_id": None,
        "version_id": "1.0.0",
        "description": None,
        "change_log": None,
        "visibility": "private",
        "published": False,
        "published_at": None,
        "enabled": True,
        "parent_version_id": None,
        "merge_parent_version_id": None,
        "revision_locked": False,
        "metadata": {},
        "commit_author": None,
        "commit_message": None,
        "external_ref": None,
        "creator_name": None,
        "creator_email": None,
        "project_name": None,
        "project_slug": None,
        "created_at": None,
        "updated_at": None,
    }
    schema = VersionSchema(**row)
    assert schema.author is None
    assert schema.message is None
    assert schema.external_ref is None
    dumped = schema.model_dump(by_alias=True)
    assert dumped.get("author") is None
    assert dumped.get("message") is None
    assert dumped.get("externalRef") is None
