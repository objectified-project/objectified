"""Client-side Model Context Protocol (MCP) plumbing for the catalog (V2-MCP-EPIC-16).

This package implements the *client* half of MCP — the code Objectified uses to
reach out to external MCP servers, discover their capabilities, and normalize
them for the catalog. The first building block is the network transport.

Modules:
    transport_http: JSON-RPC 2.0 over the MCP "Streamable HTTP" transport.
"""

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
    "DEFAULT_PROTOCOL_VERSION",
    "JsonRpcError",
    "JsonRpcResponse",
    "McpHttpStatusError",
    "McpProtocolError",
    "McpSessionExpiredError",
    "McpTransportError",
    "StreamableHttpTransport",
]
