"""Tests for import job polling and stderr progress feedback."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
import typer
from typer.testing import CliRunner

from objectified_cli.cli_context import (
    DEFAULT_IMPORT_TIMEOUT,
    import_timeout_from_context,
    no_progress_from_context,
    timeout_from_context,
)
from objectified_cli.client.http import DEFAULT_TIMEOUT, RestClient
from objectified_cli.config import CliSettings
from objectified_cli.exit_codes import EXIT_ERROR
from objectified_cli.import_.jobs import (
    DEFAULT_POLL_INTERVAL,
    format_import_progress,
    wait_for_import_job,
)
from objectified_cli.main import app
from objectified_cli.progress import import_progress

from helpers import strip_ansi

runner = CliRunner()
_context_app = typer.Typer()


@_context_app.callback()
def _context_callback(
    ctx: typer.Context,
    timeout: float | None = typer.Option(None, "--timeout"),
    no_progress: bool = typer.Option(False, "--no-progress"),
) -> None:
    ctx.ensure_object(dict)
    ctx.obj["timeout"] = timeout
    ctx.obj["no_progress"] = no_progress


@_context_app.command("timeout-probe")
def _timeout_probe(ctx: typer.Context) -> None:
    typer.echo(str(timeout_from_context(ctx)))


@_context_app.command("import-timeout-probe")
def _import_timeout_probe(ctx: typer.Context) -> None:
    typer.echo(str(import_timeout_from_context(ctx)))


@_context_app.command("no-progress-probe")
def _no_progress_probe(ctx: typer.Context) -> None:
    typer.echo(str(no_progress_from_context(ctx)))


def test_format_import_progress_message() -> None:
    """Progress lines include status and elapsed seconds."""
    assert format_import_progress("running", elapsed_seconds=12.7) == "Import running… (12s)"


def test_import_progress_disabled_yields_none() -> None:
    """Disabled progress does not attach a Rich status object."""
    with import_progress(enabled=False) as status:
        assert status is None


def test_import_progress_enabled_yields_status() -> None:
    """Enabled progress exposes an updatable Rich status."""
    with import_progress(enabled=True, initial_message="Waiting…") as status:
        assert status is not None
        status.update("Import running… (1s)")


def test_wait_for_import_job_returns_completed_payload(httpx_mock: object) -> None:
    """Poll loop stops on completed status and returns the final JSON body."""
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/job-1",
        json={"status": "running", "job_id": "job-1"},
    )
    httpx_mock.add_response(
        url="http://localhost:8000/v1/tenants/acme-corp/imports/job-1",
        json={"status": "completed", "job_id": "job-1", "project_id": "p1"},
    )
    client = RestClient(CliSettings(), timeout=30.0)
    result = wait_for_import_job(
        client,
        "job-1",
        poll_interval=0.01,
        timeout=5.0,
        no_progress=True,
        sleep=lambda _seconds: None,
    )
    assert result["status"] == "completed"
    assert result["project_id"] == "p1"


def test_wait_for_import_job_failed_exits_error(httpx_mock: object) -> None:
    """Failed terminal status prints to stderr and exits 1."""
    httpx_mock.add_response(
        url="http://localhost:8000/imports/job-2",
        json={"status": "failed", "message": "parse error"},
    )
    client = RestClient(CliSettings(), timeout=30.0)
    with pytest.raises(typer.Exit) as exc_info:
        wait_for_import_job(
            client,
            "job-2",
            no_progress=True,
            sleep=lambda _seconds: None,
        )
    assert exc_info.value.exit_code == EXIT_ERROR


def test_wait_for_import_job_timeout_exits_error() -> None:
    """Wall-clock timeout exits before the deadline is exceeded."""
    clock = {"now": 0.0}

    def monotonic() -> float:
        return clock["now"]

    def advance_sleep(_seconds: float) -> None:
        clock["now"] += 2.0

    client = MagicMock(spec=RestClient)
    client.get.return_value.json.return_value = {"status": "running"}

    with pytest.raises(typer.Exit) as exc_info:
        wait_for_import_job(
            client,
            "job-3",
            timeout=1.0,
            poll_interval=0.5,
            no_progress=True,
            sleep=advance_sleep,
            monotonic=monotonic,
        )
    assert exc_info.value.exit_code == EXIT_ERROR
    client.get.assert_called()


def test_wait_for_import_job_enables_progress_unless_disabled(
    httpx_mock: object,
) -> None:
    """Poll loop enables the stderr spinner unless --no-progress is set."""
    httpx_mock.add_response(
        url="http://localhost:8000/imports/job-4",
        json={"status": "completed"},
    )
    client = RestClient(CliSettings(), timeout=30.0)
    with patch("objectified_cli.import_.jobs.import_progress") as mock_progress:
        mock_progress.return_value.__enter__.return_value = None
        mock_progress.return_value.__exit__.return_value = None
        wait_for_import_job(
            client,
            "job-4",
            no_progress=False,
            sleep=lambda _seconds: None,
        )
        mock_progress.assert_called_once_with(enabled=True)

    httpx_mock.add_response(
        url="http://localhost:8000/imports/job-5",
        json={"status": "completed"},
    )
    with patch("objectified_cli.import_.jobs.import_progress") as mock_progress:
        mock_progress.return_value.__enter__.return_value = None
        mock_progress.return_value.__exit__.return_value = None
        wait_for_import_job(
            client,
            "job-5",
            no_progress=True,
            sleep=lambda _seconds: None,
        )
        mock_progress.assert_called_once_with(enabled=False)


def test_root_help_lists_timeout_and_no_progress() -> None:
    """Global UX flags appear on root --help."""
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    help_text = strip_ansi(result.stdout)
    assert "--timeout" in help_text
    assert "--no-progress" in help_text


def test_timeout_from_context_defaults() -> None:
    """Commands use 30s unless --timeout is provided."""
    probe = runner.invoke(_context_app, ["timeout-probe"])
    assert probe.exit_code == 0
    assert probe.stdout.strip() == str(DEFAULT_TIMEOUT)

    probe = runner.invoke(_context_app, ["--timeout", "45", "timeout-probe"])
    assert probe.exit_code == 0
    assert probe.stdout.strip() == "45.0"


def test_import_timeout_from_context_default() -> None:
    """Import wait uses 120s when --timeout is omitted."""
    probe = runner.invoke(_context_app, ["import-timeout-probe"])
    assert probe.stdout.strip() == str(DEFAULT_IMPORT_TIMEOUT)

    probe = runner.invoke(_context_app, ["--timeout", "90", "import-timeout-probe"])
    assert probe.stdout.strip() == "90.0"


def test_no_progress_from_context() -> None:
    """--no-progress is visible to nested commands via context."""
    probe = runner.invoke(_context_app, ["no-progress-probe"])
    assert probe.stdout.strip() == "False"

    probe = runner.invoke(_context_app, ["--no-progress", "no-progress-probe"])
    assert probe.stdout.strip() == "True"


def test_import_subcommand_help_exits_zero() -> None:
    """import group is registered and documents itself."""
    result = runner.invoke(app, ["import", "--help"])
    assert result.exit_code == 0
    assert "Import OpenAPI" in result.stdout
    assert "Arazzo" in result.stdout


def test_default_poll_interval_is_one_second() -> None:
    """Poll interval default matches roadmap."""
    assert DEFAULT_POLL_INTERVAL == 1.0
