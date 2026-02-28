"""
Unit tests for Database Data Storage implementation.

Tests version_has_data_records, unpublish guard (409 when version has data),
and Pydantic models for class_schema / data_record / data_snapshot.
"""

import pytest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.app.main import app
from src.app.database import Database
from src.app.models import FrozenClassSchemaModel, DataRecordModel, DataSnapshotModel


client = TestClient(app)


# ---------------------------------------------------------------------------
# Database.version_has_data_records
# ---------------------------------------------------------------------------

class TestVersionHasDataRecords:
    """Unit tests for Database.version_has_data_records."""

    def test_returns_false_when_no_data_records(self):
        """When no data_record exists for the version's class_schema, returns False."""
        db = Database()
        with patch.object(db, 'execute_query', return_value=[]) as mock_execute:
            result = db.version_has_data_records('version-uuid-123')
            mock_execute.assert_called_once()
            assert mock_execute.call_args[0][1] == ('version-uuid-123',)
            assert result is False

    def test_returns_true_when_data_records_exist(self):
        """When at least one data_record exists for the version's class_schema, returns True."""
        db = Database()
        with patch.object(db, 'execute_query', return_value=[{'1': 1}]) as mock_execute:
            result = db.version_has_data_records('version-uuid-456')
            mock_execute.assert_called_once()
            assert result is True


# ---------------------------------------------------------------------------
# Unpublish endpoint: 409 when version has data records
# ---------------------------------------------------------------------------

def _fake_validate_authentication(*args, **kwargs):
    """Fake auth that returns tenant and user for testing."""
    return {'tenant_id': 'tenant-1', 'user_id': 'user-1'}


class TestUnpublishVersionHasDataGuard:
    """Test that unpublish returns 409 with VERSION_HAS_DATA when version has data records."""

    def teardown_method(self):
        """Clear dependency overrides after each test."""
        if hasattr(app, 'dependency_overrides') and app.dependency_overrides:
            from src.app.auth import validate_authentication
            if validate_authentication in app.dependency_overrides:
                del app.dependency_overrides[validate_authentication]

    @patch('src.app.versions_routes.db')
    def test_unpublish_returns_409_when_version_has_data_records(self, mock_db):
        """Unpublish returns 409 and detail.code VERSION_HAS_DATA when version has data records."""
        from src.app.auth import validate_authentication

        mock_db.get_version_by_id.return_value = {
            'id': 'ver-1',
            'project_id': 'proj-1',
            'published': True,
            'version_id': '1.0.0',
        }
        mock_db.version_has_data_records.return_value = True
        mock_db.unpublish_version.return_value = None

        app.dependency_overrides[validate_authentication] = _fake_validate_authentication
        try:
            response = client.post(
                '/v1/versions/tenant-slug/proj-1/ver-1/unpublish',
                headers={'Authorization': 'Bearer fake-token'},
            )
        finally:
            if validate_authentication in app.dependency_overrides:
                del app.dependency_overrides[validate_authentication]

        assert response.status_code == 409
        data = response.json()
        assert 'detail' in data
        detail = data['detail']
        if isinstance(detail, dict):
            assert detail.get('code') == 'VERSION_HAS_DATA'
            assert 'data records' in detail.get('message', '')
        else:
            assert 'VERSION_HAS_DATA' in str(detail) or 'data records' in str(detail).lower()
        mock_db.unpublish_version.assert_not_called()

    @patch('src.app.versions_routes.db')
    def test_unpublish_succeeds_when_no_data_records(self, mock_db):
        """Unpublish returns 200 and calls unpublish_version when version has no data records."""
        from src.app.auth import validate_authentication

        mock_db.get_version_by_id.return_value = {
            'id': 'ver-1',
            'project_id': 'proj-1',
            'published': True,
            'version_id': '1.0.0',
        }
        mock_db.version_has_data_records.return_value = False
        mock_db.unpublish_version.return_value = {
            'id': 'ver-1',
            'project_id': 'proj-1',
            'published': False,
            'version_id': '1.0.0',
        }

        app.dependency_overrides[validate_authentication] = _fake_validate_authentication
        try:
            response = client.post(
                '/v1/versions/tenant-slug/proj-1/ver-1/unpublish',
                headers={'Authorization': 'Bearer fake-token'},
            )
        finally:
            if validate_authentication in app.dependency_overrides:
                del app.dependency_overrides[validate_authentication]

        assert response.status_code == 200
        mock_db.version_has_data_records.assert_called_once_with('ver-1')
        mock_db.unpublish_version.assert_called_once()


# ---------------------------------------------------------------------------
# Pydantic models for data storage
# ---------------------------------------------------------------------------

class TestDataStorageModels:
    """Unit tests for FrozenClassSchemaModel, DataRecordModel, DataSnapshotModel."""

    def test_frozen_class_schema_model(self):
        """FrozenClassSchemaModel accepts valid fields."""
        m = FrozenClassSchemaModel(
            id='cs-1',
            version_id='ver-1',
            class_id='cls-1',
            schema={'type': 'object', 'properties': {'name': {'type': 'string'}}},
        )
        assert m.id == 'cs-1'
        assert m.version_id == 'ver-1'
        assert m.class_id == 'cls-1'
        assert m.schema['type'] == 'object'

    def test_data_record_model(self):
        """DataRecordModel accepts valid action enum and fields."""
        m = DataRecordModel(
            id='dr-1',
            record_id='rec-1',
            class_schema_id='cs-1',
            action='created',
            record_sequence=1,
            data={'name': 'Test'},
            tenant_id='tenant-1',
        )
        assert m.action == 'created'
        assert m.record_sequence == 1

    def test_data_record_model_actions(self):
        """DataRecordModel accepts all action values."""
        for action in ('created', 'updated', 'deleted', 'restored'):
            m = DataRecordModel(
                id='dr-1',
                record_id='rec-1',
                class_schema_id='cs-1',
                action=action,
                record_sequence=1,
                tenant_id='t1',
            )
            assert m.action == action

    def test_data_record_model_accepts_restored_action(self):
        """DataRecordModel accepts action='restored' (undelete)."""
        m = DataRecordModel(
            id='dr-1',
            record_id='rec-1',
            class_schema_id='cs-1',
            action='restored',
            record_sequence=2,
            data={'name': 'Restored'},
            tenant_id='t1',
        )
        assert m.action == 'restored'
        assert m.record_sequence == 2
        assert m.data == {'name': 'Restored'}

    def test_data_record_model_rejects_invalid_action(self):
        """DataRecordModel raises ValidationError for invalid action values."""
        with pytest.raises(ValidationError) as exc_info:
            DataRecordModel(
                id='dr-1',
                record_id='rec-1',
                class_schema_id='cs-1',
                action='invalid',
                record_sequence=1,
                tenant_id='t1',
            )
        err = exc_info.value
        assert 'action' in str(err).lower() or any(
            'action' in e.get('loc', ()) for e in err.errors()
        )

    def test_data_snapshot_model(self):
        """DataSnapshotModel accepts valid fields."""
        m = DataSnapshotModel(
            record_id='rec-1',
            class_schema_id='cs-1',
            data={'name': 'Current'},
            tenant_id='tenant-1',
        )
        assert m.record_id == 'rec-1'
        assert m.data['name'] == 'Current'


# ---------------------------------------------------------------------------
# Migration script content (data_record_action enum)
# ---------------------------------------------------------------------------

def _scripts_dir() -> Path:
    """Path to objectified-db/scripts (repo root is parent of objectified-rest)."""
    this_file = Path(__file__).resolve()
    repo_root = this_file.parent.parent  # objectified-rest -> objectified-commercial
    return repo_root / 'objectified-db' / 'scripts'


class TestDataRecordActionMigrationScripts:
    """Unit tests that migration scripts contain expected data_record_action enum changes."""

    def test_initial_script_includes_restored_in_enum(self):
        """20260227-120000.sql creates data_record_action with 'restored'."""
        path = _scripts_dir() / '20260227-120000.sql'
        if not path.exists():
            pytest.skip(f"Migration script not found: {path}")
        content = path.read_text()
        assert "data_record_action" in content
        assert "'restored'" in content
        assert "ENUM ('created', 'updated', 'deleted', 'restored')" in content

    def test_alter_script_adds_restored_value(self):
        """20260227-160000.sql alters enum to add 'restored'."""
        path = _scripts_dir() / '20260227-160000.sql'
        if not path.exists():
            pytest.skip(f"Migration script not found: {path}")
        content = path.read_text()
        assert "data_record_action" in content
        assert "ADD VALUE 'restored'" in content
        assert "restored (undeleted)" in content or "restored" in content
        assert "COMMENT ON COLUMN data_record.action" in content
