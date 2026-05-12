"""Tests for Developer Mode entitlement and user preferences APIs (#3343)."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.auth import validate_session_credentials
from app.main import app

client = TestClient(app)

_USER_ID = "660e8400-e29b-41d4-a716-446655440001"


@pytest.fixture
def jwt_session():
    app.dependency_overrides[validate_session_credentials] = lambda: {
        "auth_method": "jwt",
        "user_id": _USER_ID,
    }
    yield
    app.dependency_overrides.pop(validate_session_credentials, None)


def test_get_developer_mode_entitlement_allowed(jwt_session):
    with patch("app.entitlements_routes.db") as m:
        m.get_user_entitlements_row.return_value = {"plan_code": "paid", "license_id": None}
        m.is_developer_mode_entitled.return_value = True
        r = client.get("/v1/entitlements/developer-mode")
    assert r.status_code == 200
    body = r.json()
    assert body["allowed"] is True
    assert body["planCode"] == "paid"


def test_get_developer_mode_entitlement_free_tier(jwt_session):
    with patch("app.entitlements_routes.db") as m:
        m.get_user_entitlements_row.return_value = {"plan_code": "free", "license_id": None}
        m.is_developer_mode_entitled.return_value = False
        r = client.get("/v1/entitlements/developer-mode")
    assert r.status_code == 200
    assert r.json() == {"allowed": False, "planCode": "free"}


def test_put_preferences_blocks_dev_mode_without_entitlement(jwt_session):
    with patch("app.users_preferences_routes.db") as m:
        m.is_developer_mode_entitled.return_value = False
        r = client.put(
            "/v1/users/me/preferences",
            json={"developerModeEnabled": True},
        )
        assert r.status_code == 403
        m.merge_user_preferences.assert_not_called()


def test_put_preferences_allows_dev_mode_when_entitled(jwt_session):
    with patch("app.users_preferences_routes.db") as m:
        m.is_developer_mode_entitled.return_value = True
        m.merge_user_preferences.return_value = {"developerModeEnabled": True, "theme": "dark"}
        r = client.put(
            "/v1/users/me/preferences",
            json={"developerModeEnabled": True},
        )
    assert r.status_code == 200
    assert r.json()["preferences"]["developerModeEnabled"] is True
    m.merge_user_preferences.assert_called_once()


def test_put_preferences_can_disable_without_entitlement(jwt_session):
    with patch("app.users_preferences_routes.db") as m:
        m.is_developer_mode_entitled.return_value = False
        m.merge_user_preferences.return_value = {"developerModeEnabled": False}
        r = client.put(
            "/v1/users/me/preferences",
            json={"developerModeEnabled": False},
        )
    assert r.status_code == 200
    m.merge_user_preferences.assert_called_once()


def test_get_preferences_reads_db(jwt_session):
    with patch("app.users_preferences_routes.db") as m:
        m.get_user_preferences.return_value = {"developerModeEnabled": True}
        r = client.get("/v1/users/me/preferences")
    assert r.status_code == 200
    assert r.json() == {"preferences": {"developerModeEnabled": True}}
