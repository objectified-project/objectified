"""MCP ``spec.list_tags`` tool: distinct tag usage counts across public specs (#3008)."""

from __future__ import annotations

import asyncio
import time
from typing import Any

from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

LIST_TAGS_CACHE_TTL_SEC = 60

_tags_cache_monotonic_until: float = 0.0
_tags_cache_payload: list[dict[str, Any]] | None = None
_tags_cache_lock = asyncio.Lock()

_TAGS_QUERY = """
SELECT tags.tag AS tag, COUNT(*)::bigint AS cnt
FROM odb.mcp_v_public_specs AS s
CROSS JOIN LATERAL unnest(s.tags) AS tags(tag)
GROUP BY tags.tag
ORDER BY cnt DESC, tags.tag ASC
"""


def reset_spec_list_tags_cache_for_tests() -> None:
    """Clear in-memory cache (tests only)."""
    global _tags_cache_monotonic_until, _tags_cache_payload
    _tags_cache_payload = None
    _tags_cache_monotonic_until = 0.0


async def _fetch_tag_counts(pool: AsyncConnectionPool) -> list[dict[str, Any]]:
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(_TAGS_QUERY)
            rows = await cur.fetchall()
    return [{"tag": str(r["tag"]), "count": int(r["cnt"])} for r in rows]


async def build_spec_list_tags_response(pool: AsyncConnectionPool) -> list[dict[str, Any]]:
    """Return ``[{tag, count}, ...]`` sorted by count descending; cached 60s (process-local)."""
    global _tags_cache_monotonic_until, _tags_cache_payload
    async with _tags_cache_lock:
        now = time.monotonic()
        if _tags_cache_payload is not None and now < _tags_cache_monotonic_until:
            return list(_tags_cache_payload)

        payload = await _fetch_tag_counts(pool)
        _tags_cache_payload = payload
        _tags_cache_monotonic_until = now + LIST_TAGS_CACHE_TTL_SEC
        return list(payload)
