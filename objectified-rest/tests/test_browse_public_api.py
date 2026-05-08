"""Tests for unauthenticated GET /v1/browse/tenants."""

from datetime import datetime
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_browse_tenants_ok_no_auth():
    stats = {"tenant_count": 2, "project_count": 5, "version_count": 12}
    rows = [
        {
            "slug": "acme-corp",
            "name": "Acme Corporation",
            "project_count": 7,
            "published_versions": 18,
            "latest_version": "2.1.0",
            "latest_activity_at": datetime(2026, 5, 6, 12, 0, 0),
        },
        {
            "slug": "demo",
            "name": "Objectified Demo",
            "project_count": 12,
            "published_versions": 45,
            "latest_version": "0.9.7",
            "latest_activity_at": None,
        },
    ]
    with patch("app.browse_public_routes.db") as m:
        m.get_public_browse_directory_stats.return_value = stats
        m.list_public_browse_tenants.return_value = rows
        r = client.get("/v1/browse/tenants")
    assert r.status_code == 200
    body = r.json()
    assert body["directory_stats"]["tenant_count"] == 2
    assert body["filtered_count"] == 2
    assert len(body["tenants"]) == 2
    assert body["tenants"][0]["slug"] == "acme-corp"
    assert body["tenants"][0]["published_versions"] == 18
    assert body["tenants"][0]["latest_version"] == "2.1.0"


def test_browse_tenants_passes_search_and_sort():
    with patch("app.browse_public_routes.db") as m:
        m.get_public_browse_directory_stats.return_value = {
            "tenant_count": 0,
            "project_count": 0,
            "version_count": 0,
        }
        m.list_public_browse_tenants.return_value = []
        r = client.get("/v1/browse/tenants?search=acme&sort=latest")
    assert r.status_code == 200
    m.list_public_browse_tenants.assert_called_once()
    ca = m.list_public_browse_tenants.call_args
    assert ca.kwargs["search"] == "acme"
    assert ca.kwargs["sort"] == "latest"
