"""Tests for auth whoami, status, and tenants commands."""

from __future__ import annotations

import pytest
from typer.testing import CliRunner

from objectified_cli.exit_codes import EXIT_SUCCESS, EXIT_USAGE
from objectified_cli.main import app

from helpers import strip_ansi

runner = CliRunner()

_ME_PAYLOAD = {
    "user": {
        "id": "11111111-1111-4111-8111-111111111111",
        "username": "operator",
        "email_address": "operator@example.com",
    },
    "role": "admin",
    "active_tenant_id": "22222222-2222-4222-8222-222222222222",
    "tenants": [
        {
            "tenant_id": "22222222-2222-4222-8222-222222222222",
            "tenant_name": "Acme",
            "tenant_slug": "acme",
            "membership_id": "33333333-3333-4333-8333-333333333333",
            "roles": ["admin"],
            "is_active": True,
        },
    ],
    "session": {
        "id": "44444444-4444-4444-8444-444444444444",
        "expires_on": "2026-12-31T00:00:00Z",
        "last_seen_on": "2026-05-21T12:00:00Z",
        "created_on": "2026-05-01T00:00:00Z",
        "is_current": True,
    },
}

_TENANTS_PAYLOAD = [
    {
        "tenant_id": "22222222-2222-4222-8222-222222222222",
        "tenant_name": "Acme",
        "tenant_slug": "acme",
        "membership_id": "33333333-3333-4333-8333-333333333333",
        "roles": ["admin"],
        "is_active": True,
    },
]


@pytest.fixture
def session_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OBJECTIFIED_SESSION_TOKEN", "obj_sess_test_token")


def test_auth_whoami_requires_session_token() -> None:
    result = runner.invoke(app, ["auth", "whoami"])
    assert result.exit_code == EXIT_USAGE
    assert "Session token required" in strip_ansi(result.stderr)


def test_auth_whoami_human_output(httpx_mock: object, session_env: None) -> None:
    httpx_mock.add_response(
        url="http://localhost:8000/auth/me",
        json=_ME_PAYLOAD,
        match_headers={"Authorization": "Bearer obj_sess_test_token"},
    )
    result = runner.invoke(app, ["auth", "whoami"])
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "operator@example.com" in output
    assert "admin" in output
    assert "22222222-2222-4222-8222-222222222222" in output


def test_auth_whoami_json_output(httpx_mock: object, session_env: None) -> None:
    httpx_mock.add_response(
        url="http://localhost:8000/auth/me",
        json=_ME_PAYLOAD,
    )
    result = runner.invoke(app, ["--json", "auth", "whoami"])
    assert result.exit_code == EXIT_SUCCESS
    assert '"email_address":"operator@example.com"' in result.stdout.replace(" ", "")


def test_auth_status_human_output(httpx_mock: object, session_env: None) -> None:
    httpx_mock.add_response(
        url="http://localhost:8000/auth/me",
        json=_ME_PAYLOAD,
    )
    result = runner.invoke(app, ["auth", "status"])
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "44444444-4444-4444-8444-444444444444" in output
    assert "2026-12-31" in output
    assert "Active tenant:" in output


def test_auth_status_json_output(httpx_mock: object, session_env: None) -> None:
    httpx_mock.add_response(
        url="http://localhost:8000/auth/me",
        json=_ME_PAYLOAD,
    )
    result = runner.invoke(app, ["--json", "auth", "status"])
    assert result.exit_code == EXIT_SUCCESS
    assert '"session":' in result.stdout
    assert '"active_tenant_id":' in result.stdout


def test_auth_tenants_human_output(httpx_mock: object, session_env: None) -> None:
    httpx_mock.add_response(
        url="http://localhost:8000/auth/tenants",
        json=_TENANTS_PAYLOAD,
    )
    result = runner.invoke(app, ["auth", "tenants"])
    assert result.exit_code == EXIT_SUCCESS
    output = strip_ansi(result.stdout)
    assert "Acme" in output
    assert "acme" in output


def test_auth_tenants_json_output(httpx_mock: object, session_env: None) -> None:
    httpx_mock.add_response(
        url="http://localhost:8000/auth/tenants",
        json=_TENANTS_PAYLOAD,
    )
    result = runner.invoke(app, ["--json", "auth", "tenants"])
    assert result.exit_code == EXIT_SUCCESS
    assert '"tenant_slug":"acme"' in result.stdout.replace(" ", "")


def test_auth_session_token_flag_override(httpx_mock: object) -> None:
    httpx_mock.add_response(
        url="http://localhost:8000/auth/me",
        json=_ME_PAYLOAD,
        match_headers={"Authorization": "Bearer flag-token"},
    )
    result = runner.invoke(
        app,
        ["--session-token", "flag-token", "auth", "whoami"],
    )
    assert result.exit_code == EXIT_SUCCESS


def test_auth_help_lists_subcommands() -> None:
    result = runner.invoke(app, ["auth", "--help"])
    assert result.exit_code == EXIT_SUCCESS
    help_text = strip_ansi(result.stdout)
    assert "whoami" in help_text
    assert "status" in help_text
    assert "tenants" in help_text
