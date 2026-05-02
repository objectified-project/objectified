"""Redis helpers for MCP server coordination (#2824)."""

from __future__ import annotations

import json
import logging

from .config import settings

_logger = logging.getLogger(__name__)

MCP_KEY_REVOKED_CHANNEL = "mcp.key.revoked"


def publish_mcp_key_revoked(key_id: str) -> None:
    """Publish a revocation notice so MCP servers can drop cached SessionCtx."""
    url = settings.redis_url
    if not url:
        return
    try:
        import redis  # type: ignore[import-untyped]
    except ImportError:
        _logger.warning("redis package not installed; skipping mcp.key.revoked publish")
        return

    payload = json.dumps({"key_id": key_id})
    client = redis.Redis.from_url(url, socket_connect_timeout=2, socket_timeout=2)
    try:
        client.publish(MCP_KEY_REVOKED_CHANNEL, payload)
    except Exception as exc:
        _logger.warning("redis publish failed for mcp.key.revoked: %s", exc)
    finally:
        try:
            client.close()
        except Exception:
            pass
