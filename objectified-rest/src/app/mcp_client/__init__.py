"""Client-side Model Context Protocol (MCP) plumbing for the catalog (V2-MCP-EPIC-16).

This package implements the *client* half of MCP — the code Objectified uses to
reach out to external MCP servers, discover their capabilities, and normalize
them for the catalog. The first building block is the network transport; the
lifecycle handshake (``initialize`` + version negotiation) sits on top of it.

Modules:
    transport_http: JSON-RPC 2.0 over the MCP "Streamable HTTP" transport.
    handshake: The ``initialize`` opening handshake and protocol-version negotiation.
"""

from .handshake import (
    DEFAULT_CLIENT_CAPABILITIES,
    DEFAULT_CLIENT_INFO,
    INVALID_PARAMS_CODE,
    SUPPORTED_PROTOCOL_VERSIONS,
    InitializeResult,
    McpVersionNegotiationError,
    ServerInfo,
    initialize_session,
)
from .transport_http import (
    DEFAULT_PROTOCOL_VERSION,
    JsonRpcError,
    JsonRpcResponse,
    McpHttpStatusError,
    McpProtocolError,
    McpSessionExpiredError,
    McpTransportError,
    StreamableHttpTransport,
)

__all__ = [
    "DEFAULT_CLIENT_CAPABILITIES",
    "DEFAULT_CLIENT_INFO",
    "DEFAULT_PROTOCOL_VERSION",
    "INVALID_PARAMS_CODE",
    "SUPPORTED_PROTOCOL_VERSIONS",
    "InitializeResult",
    "JsonRpcError",
    "JsonRpcResponse",
    "McpHttpStatusError",
    "McpProtocolError",
    "McpSessionExpiredError",
    "McpTransportError",
    "McpVersionNegotiationError",
    "ServerInfo",
    "StreamableHttpTransport",
    "initialize_session",
]
