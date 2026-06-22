"""/health reporting for the separate type-registry database (#3446).

Verifies the acceptance criterion "health reports Connected" for the registry, and
that the registry connection is independent of the core database: a registry failure
does not make the service unhealthy, and a core failure does not hide registry status.
"""

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_reports_both_databases_connected():
    with patch("app.main.db") as core, patch("app.main.registry_db") as reg:
        core.connect.return_value = object()
        reg.ping.return_value = True
        r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "healthy"
    assert body["database"] == "connected"
    assert body["registry_database"] == "connected"


def test_registry_failure_does_not_make_service_unhealthy():
    with patch("app.main.db") as core, patch("app.main.registry_db") as reg:
        core.connect.return_value = object()
        reg.ping.side_effect = Exception("registry db does not exist")
        r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    # Core is healthy, so overall stays healthy even though the registry is down.
    assert body["status"] == "healthy"
    assert body["database"] == "connected"
    assert body["registry_database"] == "disconnected"
    assert "registry_error" in body


def test_core_failure_is_unhealthy_but_registry_still_reported():
    with patch("app.main.db") as core, patch("app.main.registry_db") as reg:
        core.connect.side_effect = Exception("core down")
        reg.ping.return_value = True
        r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "unhealthy"
    assert body["database"] == "disconnected"
    # Registry health is independent of the core failure.
    assert body["registry_database"] == "connected"
