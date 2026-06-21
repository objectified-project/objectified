"""Poll specification import jobs until a terminal REST state is returned."""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import Any

import typer

from objectified_cli.client import api_paths
from objectified_cli.client.http import RestClient
from objectified_cli.exit_codes import EXIT_ERROR
from objectified_cli.cli_context import DEFAULT_IMPORT_TIMEOUT
from objectified_cli.progress import import_progress

DEFAULT_POLL_INTERVAL = 1.0

_TERMINAL_STATES = frozenset({"completed", "failed", "canceled", "rolled-back"})


def format_import_progress(state: str, *, elapsed_seconds: float) -> str:
    """Build a single-line stderr status message for the import poll loop."""
    elapsed = max(0, int(elapsed_seconds))
    return f"Import {state}… ({elapsed}s)"


def wait_for_import_job(
    client: RestClient,
    tenant_slug: str,
    job_id: str,
    *,
    poll_interval: float = DEFAULT_POLL_INTERVAL,
    timeout: float = DEFAULT_IMPORT_TIMEOUT,
    no_progress: bool = False,
    sleep: Callable[[float], None] = time.sleep,
    monotonic: Callable[[], float] = time.monotonic,
) -> dict[str, Any]:
    """Poll ``GET /v1/tenants/{tenant_slug}/imports/{job_id}`` until terminal."""
    deadline = monotonic() + timeout
    path = api_paths.tenant_import(tenant_slug, job_id)

    with import_progress(enabled=not no_progress) as status:
        while True:
            if monotonic() >= deadline:
                timeout_seconds = int(timeout)
                unit = "second" if timeout_seconds == 1 else "seconds"
                typer.echo(
                    f"Import timed out after {timeout_seconds} {unit}.",
                    err=True,
                )
                raise typer.Exit(EXIT_ERROR)

            response = client.get(path)
            payload = response.json()
            if not isinstance(payload, dict):
                typer.echo("Import status response was not a JSON object.", err=True)
                raise typer.Exit(EXIT_ERROR)

            job_state = payload.get("state")
            if not isinstance(job_state, str) or not job_state:
                typer.echo("Import status response missing state field.", err=True)
                raise typer.Exit(EXIT_ERROR)

            elapsed = timeout - (deadline - monotonic())
            if status is not None:
                status.update(
                    format_import_progress(job_state, elapsed_seconds=elapsed),
                )

            if job_state in _TERMINAL_STATES:
                if job_state == "completed":
                    return payload
                summary = payload.get("summary")
                if isinstance(summary, dict):
                    message = summary.get("message")
                    if isinstance(message, str) and message.strip():
                        typer.echo(f"Import {job_state}: {message.strip()}", err=True)
                        raise typer.Exit(EXIT_ERROR)
                typer.echo(f"Import {job_state}.", err=True)
                raise typer.Exit(EXIT_ERROR)

            remaining = deadline - monotonic()
            if remaining <= 0:
                continue
            sleep(min(poll_interval, remaining))
