"""Client-side Model Context Protocol (MCP) plumbing for the catalog (V2-MCP-EPIC-16).

This package implements the *client* half of MCP — the code Objectified uses to
reach out to external MCP servers, discover their capabilities, and normalize
them for the catalog. The first building block is the network transport; the
lifecycle handshake (``initialize`` + version negotiation) sits on top of it.

Modules:
    transport_http: JSON-RPC 2.0 over the MCP "Streamable HTTP" transport.
    handshake: The ``initialize`` opening handshake and protocol-version negotiation.
    discovery: Paginated ``*/list`` discovery of the declared capability surface.
    normalize: Canonical, version-tolerant ``DiscoverySurface`` + DB row mapping.
"""

from .discovery import (
    DEFAULT_PAGE_LIMIT,
    LIST_METHODS,
    DiscoveryListings,
    ListMethod,
    McpDiscoveryError,
    McpPaginationError,
    discover_listings,
    paginate,
)
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
from .normalize import (
    ITEM_TYPE_PROMPT,
    ITEM_TYPE_RESOURCE,
    ITEM_TYPE_RESOURCE_TEMPLATE,
    ITEM_TYPE_TOOL,
    ITEM_TYPES,
    CapabilityItem,
    DiscoverySurface,
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
    "DEFAULT_PAGE_LIMIT",
    "DEFAULT_PROTOCOL_VERSION",
    "INVALID_PARAMS_CODE",
    "ITEM_TYPES",
    "ITEM_TYPE_PROMPT",
    "ITEM_TYPE_RESOURCE",
    "ITEM_TYPE_RESOURCE_TEMPLATE",
    "ITEM_TYPE_TOOL",
    "LIST_METHODS",
    "SUPPORTED_PROTOCOL_VERSIONS",
    "CapabilityItem",
    "DiscoveryListings",
    "DiscoverySurface",
    "InitializeResult",
    "JsonRpcError",
    "JsonRpcResponse",
    "ListMethod",
    "McpDiscoveryError",
    "McpHttpStatusError",
    "McpPaginationError",
    "McpProtocolError",
    "McpSessionExpiredError",
    "McpTransportError",
    "McpVersionNegotiationError",
    "ServerInfo",
    "StreamableHttpTransport",
    "discover_listings",
    "initialize_session",
    "paginate",
]
