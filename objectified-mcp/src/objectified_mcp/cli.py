"""CLI entrypoint for the objectified-mcp console script and ``python -m`` runs."""

from __future__ import annotations

import argparse
import asyncio
import sys

from objectified_mcp import __version__


async def _run_stdio_transport() -> None:
    from objectified_mcp.server import mcp

    await mcp.run_stdio_async()


async def _run_http_transport(host: str, port: int, *, log_level: str) -> None:
    """Streamable HTTP via FastMCP (``http_app`` → ``create_streamable_http_app``); serves MCP at ``/mcp``."""
    from objectified_mcp.server import mcp

    await mcp.run_http_async(
        transport="streamable-http",
        host=host,
        port=port,
        path="/mcp",
        log_level=log_level.lower(),
    )


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
        choices=("stdio", "http"),
        default=None,
        metavar="NAME",
        help=(
            "Run with this transport (omit to validate env and exit). "
            "Use stdio for Claude Desktop; use http for streamable HTTP (MCP at /mcp)."
        ),
    )
    serve_parser.add_argument(
        "--host",
        default=None,
        metavar="ADDR",
        help="Bind address for HTTP transport (default: OBJECTIFIED_MCP_HTTP_HOST).",
    )
    serve_parser.add_argument(
        "--port",
        type=int,
        default=None,
        metavar="PORT",
        help="TCP port for HTTP transport (default: OBJECTIFIED_MCP_HTTP_PORT).",
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
        if args.transport == "http":
            if args.port is not None and not (1 <= args.port <= 65535):
                print("--port must be between 1 and 65535", file=sys.stderr)
                raise SystemExit(2)
            host = (args.host.strip() if args.host else None) or settings.http_host
            if not host:
                print("Bind host must be non-empty.", file=sys.stderr)
                raise SystemExit(2)
            port = args.port if args.port is not None else settings.http_port
            with bound_contextvars(request_id="cli-serve-http", tool_name=None):
                log.info("mcp_http_starting", host=host, port=port, path="/mcp")
            asyncio.run(_run_http_transport(host, port, log_level=settings.log_level))
            return
        with bound_contextvars(request_id="cli-serve", tool_name=None):
            log.info(
                "mcp_configuration_validated",
                detail="Pass --transport stdio or --transport http to run the server.",
            )
        raise SystemExit(0)

    parser.print_help()
