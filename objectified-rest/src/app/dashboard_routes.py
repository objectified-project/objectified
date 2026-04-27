"""Dashboard API routes (REPO-10.3 / #2949: tenant-level repository corpus roll-up)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from .auth import validate_authentication
from .database import db
from .repositories.attention import attention_detail_query_tab, top_reason_for_chips
from .repositories_routes import (
    _REPOSITORY_SCOPE_READ,
    _require_repository_scope,
    get_repository_corpus_rollup,
)

router = APIRouter(prefix="/v1/dashboard", tags=["dashboard"])


class RepositoryCorpusStatsResponse(BaseModel):
    """Cross-repository aggregate spec counts for the scanned report dashboard."""

    repositoriesTracked: int
    importableSpecs: int
    awaitingSelection: int
    parseErrors: int
    manifestErrors: int
    refreshedAt: str


@router.get(
    "/{tenant_slug}/repository_corpus_stats",
    response_model=RepositoryCorpusStatsResponse,
    summary="Tenant corpus stats for scan reports (rolled up server-side).",
)
async def read_repository_corpus_stats(
    tenant_slug: str,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> RepositoryCorpusStatsResponse:
    _ = tenant_slug
    _require_repository_scope(auth_data, _REPOSITORY_SCOPE_READ)
    tenant_id = str(auth_data["tenant_id"])
    data = get_repository_corpus_rollup(tenant_id)
    return RepositoryCorpusStatsResponse(**data)


class RepositoryAttentionItem(BaseModel):
    """Per-row projection for the dashboard attention widget (REPO-11.2 / #2942)."""

    repositoryId: str
    fullName: str
    reasons: List[str]
    topReason: str
    detailTab: str
    openCount: int
    attentionScore: int
    lastChangeAt: str


class RepositoryAttentionResponse(BaseModel):
    items: List[RepositoryAttentionItem] = Field(default_factory=list)
    repositoriesTracked: int
    needingAttentionCount: int
    otherHealthyCount: int
    refreshedAt: str


@router.get(
    "/{tenant_slug}/repository_attention",
    response_model=RepositoryAttentionResponse,
    summary="Top repositories by attention roll-up (tenant, repository.read).",
)
async def read_repository_attention(
    tenant_slug: str,
    limit: int = Query(default=5, ge=1, le=50),
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> RepositoryAttentionResponse:
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    _ = tenant_slug
    _require_repository_scope(auth_data, _REPOSITORY_SCOPE_READ)
    tenant_id = str(auth_data["tenant_id"])
    rows, total_tracked, needing = db.list_repository_attention_for_tenant(tenant_id, limit)
    other_healthy = max(0, int(total_tracked) - int(needing))
    items: List[RepositoryAttentionItem] = []
    for row in rows:
        rid = str(row.get("repository_id", "") or row.get("repositoryId", ""))
        owner = str(row.get("owner", "") or "")
        name = str(row.get("name", "") or "")
        full = f"{owner}/{name}" if owner or name else rid
        raw_reasons = row.get("reasons") or []
        if isinstance(raw_reasons, (list, tuple)):
            reasons = [str(x) for x in raw_reasons]
        else:
            reasons = [str(raw_reasons)]
        top = top_reason_for_chips(reasons)
        tab = attention_detail_query_tab(reasons)
        items.append(
            RepositoryAttentionItem(
                repositoryId=rid,
                fullName=full,
                reasons=reasons,
                topReason=top,
                detailTab=tab,
                openCount=int(row.get("open_count") or row.get("openCount") or 0),
                attentionScore=int(row.get("attention_score") or row.get("attentionScore") or 0),
                lastChangeAt=str(
                    row.get("last_change_at")
                    or row.get("lastChangeAt")
                    or _now_iso()
                ),
            )
        )
    return RepositoryAttentionResponse(
        items=items,
        repositoriesTracked=int(total_tracked),
        needingAttentionCount=int(needing),
        otherHealthyCount=other_healthy,
        refreshedAt=_now_iso(),
    )
