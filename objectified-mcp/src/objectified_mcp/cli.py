"""CLI entrypoint for the objectified-mcp console script and ``python -m`` runs."""

from __future__ import annotations

import argparse
import sys

from objectified_mcp import __version__


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
    subparsers.add_parser(
        "serve",
        help="Validate environment configuration (stdio / HTTP transports ship in later tickets).",
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
        with bound_contextvars(request_id="cli-serve", tool_name=None):
            log.info(
                "mcp_configuration_validated",
                detail="MCP transports are wired in roadmap tickets 1.5 (stdio) and 1.6 (HTTP).",
            )
        raise SystemExit(0)

    parser.print_help()
