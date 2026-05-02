"""Internal MCP API key resolve routes (#2824)."""

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

client = TestClient(app)


def test_resolve_403_without_secret_header():
    with patch.object(settings, "internal_api_secret", "only-trusted"):
        r = client.post("/v1/internal/api_keys/resolve", json={"token": "sk_abcdefghijkl", "purpose": "mcp"})
        assert r.status_code == 403


def test_resolve_403_wrong_secret():
    with patch.object(settings, "internal_api_secret", "expected"):
        r = client.post(
            "/v1/internal/api_keys/resolve",
            json={"token": "sk_abcdefghijkl", "purpose": "mcp"},
            headers={"X-Objectified-Internal-Secret": "wrong"},
        )
        assert r.status_code == 403


def test_resolve_503_when_secret_not_configured():
    with patch.object(settings, "internal_api_secret", None):
        r = client.post(
            "/v1/internal/api_keys/resolve",
            json={"token": "sk_abcdefghijkl", "purpose": "mcp"},
            headers={"X-Objectified-Internal-Secret": "x"},
        )
        assert r.status_code == 503


def test_resolve_delegates_to_database():
    with patch.object(settings, "internal_api_secret", "ok-secret"):
        with patch("app.internal_api_keys_routes.db") as mdb:
            mdb.resolve_api_key_token.return_value = {
                "valid": True,
                "user_id": None,
                "tenant_id": "11111111-1111-1111-1111-111111111111",
                "scopes": [],
                "expires_at": None,
                "revoked": False,
                "key_id": "22222222-2222-2222-2222-222222222222",
            }
            r = client.post(
                "/v1/internal/api_keys/resolve",
                json={"token": "sk_abcdefghijklfffffffffff", "purpose": "mcp"},
                headers={"X-Objectified-Internal-Secret": "ok-secret"},
            )
            assert r.status_code == 200
            body = r.json()
            assert body["valid"] is True
            assert body["key_id"] == "22222222-2222-2222-2222-222222222222"
            mdb.resolve_api_key_token.assert_called_once()


def test_revoked_broadcast_requires_secret():
    with patch.object(settings, "internal_api_secret", "sec"):
        with patch("app.internal_api_keys_routes.publish_mcp_key_revoked") as pub:
            r = client.post(
                "/v1/internal/api_keys/revoked-broadcast",
                json={"key_id": "33333333-3333-3333-3333-333333333333"},
                headers={"X-Objectified-Internal-Secret": "sec"},
            )
            assert r.status_code == 200
            assert r.json()["ok"] is True
            pub.assert_called_once_with("33333333-3333-3333-3333-333333333333")
