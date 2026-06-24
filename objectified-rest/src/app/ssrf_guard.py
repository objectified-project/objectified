"""SSRF protection for outbound fetches of user-supplied URLs (#3612).

Import-from-URL (``import_ingestion``) and public repository registration
(``repository_validation``) both fetch URLs that a tenant controls. Without a
guard, a caller could point those at internal-only addresses — the cloud
metadata endpoint (``169.254.169.254``), ``localhost`` services, or RFC1918
hosts — and use the server as a confused deputy (SSRF).

This module centralizes the vetting:

* only ``http`` / ``https`` schemes are accepted;
* a URL may not embed credentials (``user:pass@host``);
* the hostname is resolved and **every** resolved IP must be a public, global
  address — private, loopback, link-local (incl. the metadata IP), multicast,
  reserved, and unspecified ranges are rejected, for both IPv4 and IPv6
  (including IPv4-mapped IPv6).

The guard is installed as an httpx *request* event hook so it fires immediately
before each request is sent — including every hop of a redirect chain — which
closes redirect-based bypasses (a public URL that 302s to ``169.254.169.254``).

Residual risk: a DNS-rebinding attacker could return a public IP at validation
time and a private IP at connect time (TOCTOU). The hook minimizes the window
by validating right before connect; pinning the resolved IP into the socket
would close it fully and is tracked as a hardening follow-up. Set
``OBJECTIFIED_SSRF_ALLOW_PRIVATE=true`` to disable IP filtering for local
development (the scheme/credential checks always apply).
"""

from __future__ import annotations

import ipaddress
import socket
from typing import List

import httpx

from .config import settings

# Schemes we are willing to fetch. Everything else (file://, gopher://, ftp://,
# data:, etc.) is rejected outright.
_ALLOWED_SCHEMES = ("http", "https")


class SSRFError(ValueError):
    """A user-supplied URL was rejected as unsafe to fetch.

    Subclasses ``ValueError`` so existing call sites that already translate
    ``ValueError`` into a user-facing 4xx keep working unchanged.
    """


def _ip_is_disallowed(ip: ipaddress._BaseAddress) -> bool:
    """Return True when ``ip`` is anything other than a public, global address.

    IPv4-mapped IPv6 addresses (``::ffff:10.0.0.1``) are unwrapped so an internal
    IPv4 target cannot be smuggled through an IPv6 literal.
    """
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    # ``is_global`` is False for private, loopback, link-local, shared (CGNAT),
    # and unspecified ranges; the extra flags make the intent explicit and guard
    # against any edge the single property misses.
    return (
        not ip.is_global
        or ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def _resolve_host_ips(host: str) -> List[str]:
    """Resolve ``host`` to all of its A/AAAA records.

    A bare IP literal resolves to itself. Raises :class:`SSRFError` when the host
    cannot be resolved (an unresolvable host is treated as unsafe rather than
    silently allowed).
    """
    try:
        infos = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise SSRFError(f"could not resolve host '{host}'") from exc
    ips: List[str] = []
    for info in infos:
        sockaddr = info[4]
        if sockaddr and sockaddr[0]:
            ips.append(sockaddr[0])
    if not ips:
        raise SSRFError(f"could not resolve host '{host}'")
    return ips


def validate_url(url: str) -> None:
    """Validate a single URL against the SSRF policy.

    Always enforces the scheme and credential rules. When IP filtering is
    enabled (the default), resolves the host and rejects the URL if *any*
    resolved address is non-public.

    Raises:
        SSRFError: if the URL is malformed, uses a disallowed scheme, embeds
            credentials, or resolves to a non-public address.
    """
    try:
        parsed = httpx.URL(url)
    except Exception as exc:  # malformed URL
        raise SSRFError(f"malformed URL: {url}") from exc

    scheme = (parsed.scheme or "").lower()
    if scheme not in _ALLOWED_SCHEMES:
        raise SSRFError(f"URL scheme '{scheme or '(none)'}' is not allowed; use http or https")

    # Credentials in the authority (user:pass@host) are a common SSRF/redirect
    # smuggling trick and never legitimate for these fetches.
    if parsed.username or parsed.password:
        raise SSRFError("credentials in URL are not allowed")

    host = parsed.host
    if not host:
        raise SSRFError("URL is missing a host")

    if settings.ssrf_allow_private:
        return

    for ip in _resolve_host_ips(host):
        try:
            addr = ipaddress.ip_address(ip)
        except ValueError:
            raise SSRFError(f"host '{host}' resolved to an unparseable address")
        if _ip_is_disallowed(addr):
            raise SSRFError(
                f"host '{host}' resolves to non-public address {ip}; refusing to fetch"
            )


def _request_guard_hook(request: httpx.Request) -> None:
    """httpx request event hook: validate every outbound request URL.

    Fires before the request is sent, for the initial request and for each
    redirect hop, so a redirect to an internal address is blocked.
    """
    validate_url(str(request.url))


def build_guarded_client(**kwargs) -> httpx.Client:
    """Build an :class:`httpx.Client` whose every request is SSRF-validated.

    Drop-in replacement for ``httpx.Client(...)`` at the user-URL fetch sites.
    Any caller-supplied ``request`` event hooks are preserved and the guard is
    appended so it runs last.
    """
    event_hooks = dict(kwargs.pop("event_hooks", {}) or {})
    request_hooks = list(event_hooks.get("request", []))
    request_hooks.append(_request_guard_hook)
    event_hooks["request"] = request_hooks
    return httpx.Client(event_hooks=event_hooks, **kwargs)
