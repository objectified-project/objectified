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
        from pydantic import ValidationError

        from objectified_mcp.settings import get_settings

        try:
            get_settings()
        except ValidationError as exc:
            print(f"Configuration error:\n{exc}", file=sys.stderr)
            raise SystemExit(2)
        print(
            "Configuration loaded. MCP transports are wired in roadmap tickets 1.5 (stdio) and 1.6 (HTTP).",
            file=sys.stderr,
        )
        raise SystemExit(0)

    parser.print_help()
