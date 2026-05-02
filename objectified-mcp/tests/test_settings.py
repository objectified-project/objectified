from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

_ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(autouse=True)
def clear_settings_cache() -> None:
    from objectified_mcp.settings import get_settings

    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_settings_loads_required_and_optional_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OBJECTIFIED_MCP_DATABASE_URL", "postgresql://localhost/db")
    monkeypatch.setenv("OBJECTIFIED_MCP_INTERNAL_SECRET", "x" * 16)
    monkeypatch.setenv("OBJECTIFIED_MCP_LOG_LEVEL", "debug")

    from objectified_mcp.settings import Settings

    s = Settings()
    assert s.database_url == "postgresql://localhost/db"
    assert s.internal_secret.get_secret_value() == "x" * 16
    assert s.log_level == "DEBUG"
    assert s.transport == "stdio"
    assert s.http_host == "127.0.0.1"
    assert s.http_port == 8765


def test_settings_http_transport_overrides(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OBJECTIFIED_MCP_DATABASE_URL", "postgresql://localhost/db")
    monkeypatch.setenv("OBJECTIFIED_MCP_INTERNAL_SECRET", "y" * 16)
    monkeypatch.setenv("OBJECTIFIED_MCP_TRANSPORT", "http")
    monkeypatch.setenv("OBJECTIFIED_MCP_HTTP_HOST", "0.0.0.0")
    monkeypatch.setenv("OBJECTIFIED_MCP_HTTP_PORT", "9000")

    from objectified_mcp.settings import Settings

    s = Settings()
    assert s.transport == "http"
    assert s.http_host == "0.0.0.0"
    assert s.http_port == 9000


def test_settings_missing_database_url_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    from pydantic import ValidationError

    from objectified_mcp.settings import Settings

    monkeypatch.delenv("OBJECTIFIED_MCP_DATABASE_URL", raising=False)
    monkeypatch.setenv("OBJECTIFIED_MCP_INTERNAL_SECRET", "z" * 16)

    with pytest.raises(ValidationError) as exc:
        Settings()
    errs = exc.value.errors()
    assert any(e["loc"] == ("database_url",) for e in errs)


def test_settings_short_internal_secret_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    from pydantic import ValidationError

    from objectified_mcp.settings import Settings

    monkeypatch.setenv("OBJECTIFIED_MCP_DATABASE_URL", "postgresql://localhost/db")
    monkeypatch.setenv("OBJECTIFIED_MCP_INTERNAL_SECRET", "short")

    with pytest.raises(ValidationError) as exc:
        Settings()
    assert any(e["loc"] == ("internal_secret",) for e in exc.value.errors())


def test_cli_serve_exits_zero_with_valid_env(monkeypatch: pytest.MonkeyPatch) -> None:
    env = {
        **os.environ,
        "PYTHONPATH": str(_ROOT / "src"),
        "OBJECTIFIED_MCP_DATABASE_URL": "postgresql://localhost/db",
        "OBJECTIFIED_MCP_INTERNAL_SECRET": "s" * 16,
    }
    monkeypatch.delenv("OBJECTIFIED_MCP_TRANSPORT", raising=False)
    result = subprocess.run(
        [sys.executable, "-m", "objectified_mcp", "serve"],
        capture_output=True,
        text=True,
        check=False,
        cwd=_ROOT,
        env=env,
    )
    assert result.returncode == 0
    assert "Configuration loaded" in result.stderr


def test_cli_serve_fails_fast_without_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    env = {k: v for k, v in os.environ.items() if not k.startswith("OBJECTIFIED_MCP_")}
    env["PYTHONPATH"] = str(_ROOT / "src")
    env["OBJECTIFIED_MCP_INTERNAL_SECRET"] = "t" * 16

    result = subprocess.run(
        [sys.executable, "-m", "objectified_mcp", "serve"],
        capture_output=True,
        text=True,
        check=False,
        cwd=_ROOT,
        env=env,
    )
    assert result.returncode != 0
    combined = result.stderr + result.stdout
    assert "database_url" in combined.lower() or "DATABASE_URL" in combined
