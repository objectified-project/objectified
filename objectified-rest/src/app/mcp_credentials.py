"""Load an MCP endpoint's auth headers for a discovery run (Epic-6 seam).

V2-MCP-17.2 (#3664) needs the discovery client to authenticate to an endpoint that requires
credentials. Credentials live in ``odb.mcp_endpoint_credentials`` (V129) as ciphertext keyed
by ``auth_type``; this module turns a stored credential into the HTTP headers the
:class:`StreamableHttpTransport` attaches to every request.

The encrypting/decrypting half of the credential vault (Epic-6.x) is not yet wired into REST,
so today only ``auth_type='none'`` (or no credential row at all) is fully supported — that
yields no auth headers, which is correct for public/anonymous MCP servers. For an endpoint that
stores ciphertext, this returns no headers and logs a warning rather than guessing at a secret
it cannot decrypt; discovery then proceeds unauthenticated and surfaces the server's
``AUTH_REQUIRED`` response through the normal error taxonomy. This keeps the call site stable:
when decryption lands, only :func:`_headers_for_credential` changes.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from .database import db

logger = logging.getLogger(__name__)

# Auth types whose headers we can produce without a decrypting key. ``none`` means the
# endpoint is anonymous; everything else needs ciphertext we cannot yet read.
_NO_SECRET_AUTH_TYPES = frozenset({"none"})


def _headers_for_credential(credential: Optional[Dict[str, Any]]) -> Dict[str, str]:
    """Map a stored credential row onto request headers (no decryption available yet).

    Args:
        credential: An ``mcp_endpoint_credentials`` row, or ``None`` when the endpoint has
            no credential configured.

    Returns:
        The auth headers to attach to discovery requests — empty for anonymous endpoints or
        when a secret cannot be decrypted.
    """
    if credential is None:
        return {}
    auth_type = str(credential.get("auth_type") or "none")
    if auth_type in _NO_SECRET_AUTH_TYPES:
        return {}
    # A secret is configured but the decrypting key path is not wired into REST yet; proceed
    # unauthenticated rather than fabricate a header. (Epic-6 decryption hook goes here.)
    logger.warning(
        "MCP endpoint credential auth_type=%s cannot be decrypted yet; "
        "running discovery without auth headers",
        auth_type,
    )
    return {}


def load_endpoint_auth_headers(endpoint_id: str) -> Dict[str, str]:
    """Return the auth headers for an endpoint's discovery run (synchronous DB read).

    Best-effort: any failure reading the credential is swallowed (logged) and treated as
    "no credential", so a credential-store hiccup degrades to an unauthenticated run instead
    of failing the whole discovery before it starts.

    Args:
        endpoint_id: The endpoint whose credentials to load.

    Returns:
        A possibly-empty header dict suitable for :class:`StreamableHttpTransport`.
    """
    try:
        credential = db.get_mcp_endpoint_credentials(endpoint_id)
    except Exception:  # noqa: BLE001 - credential lookup is best-effort
        logger.warning(
            "failed to load credentials for MCP endpoint %s; running discovery "
            "without auth headers",
            endpoint_id,
            exc_info=True,
        )
        return {}
    return _headers_for_credential(credential)
