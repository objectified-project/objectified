"""Endpoint tests for the import-source enumeration API (MFI-1.3, #3735)."""

import pytest
from fastapi.testclient import TestClient

from app.auth import validate_authentication
from app.import_source import (
    ApiParadigm,
    ImportSource,
    InputKind,
    _REGISTRY,
)
from app.main import app

client = TestClient(app)

_MOCK_AUTH = {"tenant_id": "t1", "user_id": "u1", "auth_method": "jwt"}


def _override_auth():
    return _MOCK_AUTH


@pytest.fixture(autouse=True)
def _auth():
    app.dependency_overrides[validate_authentication] = _override_auth
    yield
    app.dependency_overrides.clear()


def test_list_import_sources_returns_registered_adapters():
    r = client.get("/v1/import/sources")
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body["sources"], list)
    by_key = {s["key"]: s for s in body["sources"]}

    # The reference OpenAPI adapter (MFI-1.1) is always present and self-describes.
    assert "openapi" in by_key
    openapi = by_key["openapi"]
    assert openapi["label"] == "OpenAPI / Swagger"
    assert openapi["icon"] == "file-json"
    assert openapi["paradigm"] == "rest"
    assert openapi["input_kinds"] == ["file", "url", "paste"]
    assert openapi["supports_live_discovery"] is False
    assert "openapi-3.1" in openapi["formats"]


def test_list_import_sources_is_sorted_by_key():
    r = client.get("/v1/import/sources")
    keys = [s["key"] for s in r.json()["sources"]]
    assert keys == sorted(keys)


def test_list_import_sources_requires_authentication():
    # Drop the override so the real dependency runs and rejects the anonymous call.
    # Missing credentials surface as 422 (required auth inputs absent); an invalid
    # credential would be 401/403. Any of these proves the endpoint is not open.
    app.dependency_overrides.clear()
    r = client.get("/v1/import/sources")
    assert r.status_code in (401, 403, 422)


def test_new_adapter_appears_without_route_changes():
    """Registering an adapter server-side surfaces a new entry — the contract that
    lets a new source card appear in the UI with no UI/route code change."""

    class _ProbeImportSource(ImportSource):  # not auto-registered
        key = "probe-format"
        label = "Probe Format"
        description = "A throwaway adapter used only by this test."
        icon = "boxes"
        paradigm = ApiParadigm.REST
        input_kinds = (InputKind.FILE, InputKind.PASTE)
        supports_live_discovery = False
        formats = ("probe-1.0",)

        def detect(self, payload):  # pragma: no cover - not exercised here
            from app.import_source import NO_MATCH

            return NO_MATCH

        def parse(self, raw, *, source_label=None):  # pragma: no cover
            return raw

        def normalize(self, native_ast, *, include_raw=True):  # pragma: no cover
            raise NotImplementedError

    _REGISTRY["probe-format"] = _ProbeImportSource
    try:
        r = client.get("/v1/import/sources")
        by_key = {s["key"]: s for s in r.json()["sources"]}
        assert "probe-format" in by_key
        probe = by_key["probe-format"]
        assert probe["label"] == "Probe Format"
        assert probe["icon"] == "boxes"
        assert probe["input_kinds"] == ["file", "paste"]
    finally:
        _REGISTRY.pop("probe-format", None)
