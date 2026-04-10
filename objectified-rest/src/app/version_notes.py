"""Revision note + changelog validation (git-like commit / annotated tag analog).

Size limits are tenant-scoped in the API contract; defaults apply until per-tenant
policy is stored on tenants (future).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple


@dataclass(frozen=True)
class VersionNotesLimits:
    max_short_message_chars: int
    max_changelog_chars: int
    require_short_message: bool


DEFAULT_VERSION_NOTES_LIMITS = VersionNotesLimits(
    max_short_message_chars=2000,
    max_changelog_chars=65535,
    require_short_message=True,
)


def limits_for_tenant(_tenant_id: str) -> VersionNotesLimits:
    """Return effective limits for a tenant (defaults until DB-backed policy exists)."""
    return DEFAULT_VERSION_NOTES_LIMITS


def validate_version_notes(
    short_message: Optional[str],
    changelog: Optional[str],
    limits: VersionNotesLimits,
    *,
    require_short_message: Optional[bool] = None,
) -> Tuple[Optional[str], Optional[str]]:
    """
    Strip and validate revision note + changelog.

    Returns (short_message, changelog) with None for empty optional strings.
    Raises ValueError with a human-readable message on violation.
    """
    req = limits.require_short_message if require_short_message is None else require_short_message
    sm = short_message.strip() if short_message else None
    cl = changelog.strip() if changelog else None
    if req and not sm:
        raise ValueError("Revision note (shortMessage) is required")
    if sm and len(sm) > limits.max_short_message_chars:
        raise ValueError(
            f"Revision note exceeds maximum length ({limits.max_short_message_chars} characters)"
        )
    if cl and len(cl) > limits.max_changelog_chars:
        raise ValueError(
            f"Changelog exceeds maximum length ({limits.max_changelog_chars} characters)"
        )
    return sm, cl


def extract_breaking_hints_from_changelog(changelog: Optional[str]) -> list[str]:
    """
    Lines in markdown changelog that look like breaking-change bullets, for downstream
    docs (#746 / migration guides). Best-effort; does not parse full Markdown.
    """
    if not changelog:
        return []
    out: list[str] = []
    for raw in changelog.splitlines():
        line = raw.strip()
        if not line:
            continue
        lower = line.lower().lstrip("-*•").strip()
        if lower.startswith("breaking:") or lower.startswith("breaking "):
            out.append(raw.strip())
    return out
