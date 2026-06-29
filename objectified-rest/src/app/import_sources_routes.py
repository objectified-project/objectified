"""
Import-source enumeration — REST contract for the registry (MFI-1.3).

Exposes the import-source registry (MFI-1.1) as a read-only list so the UI's
``ImportDialog`` can render its source cards from data instead of hard-coded JSX,
and the CLI (MFI-1.4) can list available formats. Each entry is the registry's
public :class:`~app.import_source.ImportSourceDescriptor` — key, label,
description, Lucide ``icon`` name, paradigm, accepted ``input_kinds``
(file/url/paste/discovery), live-discovery capability, and emitted ``formats``.

Adding an adapter server-side (a new ``ImportSource`` subclass with
``register=True``) makes it appear here automatically, so a new source card shows
up in the UI with no UI code change.
"""

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from .auth import validate_authentication
from .import_source import ImportSourceDescriptor, describe_import_sources

router = APIRouter(prefix="/v1/import", tags=["import-sources"])


class ImportSourceListResponse(BaseModel):
    """The list of registered import sources, for source-card / CLI enumeration."""

    sources: List[ImportSourceDescriptor] = Field(
        default_factory=list,
        description="Every registered adapter's descriptor, sorted by key.",
    )


@router.get(
    "/sources",
    response_model=ImportSourceListResponse,
    summary="List import sources",
    description=(
        "Enumerate every registered import-source adapter (MFI-1.1 registry). "
        "Drives the ImportDialog source cards (MFI-1.3) and the CLI format list "
        "(MFI-1.4): each descriptor carries the Lucide icon, label, description, "
        "and the input kinds (file/url/paste/discovery) its card/verb should use."
    ),
)
async def list_import_sources(
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> ImportSourceListResponse:
    # The source list is non-tenant registry metadata; authentication is required
    # (consistent with the rest of the API) but no per-tenant scoping applies.
    _ = auth_data
    return ImportSourceListResponse(sources=describe_import_sources())
