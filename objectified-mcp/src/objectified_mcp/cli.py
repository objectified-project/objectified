"""CLI entrypoint for the objectified-mcp console script and ``python -m`` runs."""

from __future__ import annotations

import argparse
import asyncio
import sys

from objectified_mcp import __version__


async def _run_stdio_transport() -> None:
    from objectified_mcp.server import mcp

    await mcp.run_stdio_async()


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="objectified-mcp",
        description="Objectified Model Context Protocol server (FastMCP).",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {__version__}",
    )
    subparsers = parser.add_subparsers(dest="command")
    serve_parser = subparsers.add_parser(
        "serve",
        help="Validate configuration and optionally run the MCP server.",
    )
    serve_parser.add_argument(
        "--transport",
        choices=("stdio",),
        default=None,
        metavar="NAME",
        help="Run with this transport (omit to validate env and exit). Use stdio for Claude Desktop.",
    )

    args = parser.parse_args()

    if args.command == "serve":
        import structlog
        from pydantic import ValidationError
        from structlog.contextvars import bound_contextvars

        from objectified_mcp.logging_config import configure_logging
        from objectified_mcp.settings import get_settings

        try:
            settings = get_settings()
        except ValidationError as exc:
            print(f"Configuration error:\n{exc}", file=sys.stderr)
            raise SystemExit(2)
        configure_logging(settings)
        log = structlog.get_logger(__name__)
        if args.transport == "stdio":
            with bound_contextvars(request_id="cli-serve-stdio", tool_name=None):
                log.info("mcp_stdio_starting")
            asyncio.run(_run_stdio_transport())
            return
        with bound_contextvars(request_id="cli-serve", tool_name=None):
            log.info(
                "mcp_configuration_validated",
                detail="Pass --transport stdio to run locally; HTTP transport is roadmap ticket 1.6.",
            )
        raise SystemExit(0)

    parser.print_help()
