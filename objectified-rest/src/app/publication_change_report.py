"""Generate and persist publication change reports after successful publish (CR-04, #2702)."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import HTTPException

from .change_report_render import (
    build_render_metadata,
    bundled_system_template_row,
    render_from_template_row,
)
from .change_report_template_resolve import resolve_effective_change_report_template
from .compatibility_engine import openapi_for_revision
from .database import db
from .openapi_change_report import build_change_report

logger = logging.getLogger(__name__)

# Minimal OpenAPI baseline when there is no prior published revision on the lineage.
EMPTY_BASELINE_OPENAPI: Dict[str, Any] = {
    "openapi": "3.1.0",
    "info": {"title": "(empty baseline)", "version": "0.0.0"},
    "paths": {},
    "components": {"schemas": {}},
}


def _iso_published_at(version_row: Dict[str, Any]) -> str:
    ts = version_row.get("published_at")
    if ts is None:
        return "—"
    if hasattr(ts, "isoformat"):
        return ts.isoformat()
    return str(ts)


def _resolve_template_row(tenant_id: str, project_id: str) -> Dict[str, Any]:
    try:
        return resolve_effective_change_report_template(db, tenant_id, project_id, None)
    except HTTPException:
        return bundled_system_template_row()


def generate_change_report_on_publish(
    *,
    tenant_slug: str,
    tenant_id: str,
    project_id: str,
    published_revision_id: str,
    actor_id: Optional[str],
) -> None:
    """
    Best-effort CR-01 → CR-03 → CR-02 after publish.

    Does not raise: failures are logged and recorded in ``workflow_audit`` with outcome ``failure``.
    """
    try:
        _generate_change_report_on_publish_impl(
            tenant_slug=tenant_slug,
            tenant_id=tenant_id,
            project_id=project_id,
            published_revision_id=published_revision_id,
            actor_id=actor_id,
        )
    except Exception as e:
        logger.warning(
            "change report generation failed after publish (revision=%s): %s",
            published_revision_id,
            e,
            exc_info=True,
        )
        db.insert_workflow_audit(
            tenant_id,
            project_id,
            published_revision_id,
            "schema.change_report.generated",
            "failure",
            actor_id,
            {"error": str(e), "phase": "unexpected"},
        )


def _generate_change_report_on_publish_impl(
    *,
    tenant_slug: str,
    tenant_id: str,
    project_id: str,
    published_revision_id: str,
    actor_id: Optional[str],
) -> None:
    version = db.get_version_by_id(published_revision_id, tenant_id)
    if not version or not version.get("published"):
        return

    proj = db.get_project_by_id(project_id, tenant_id)
    project_name = (proj or {}).get("name") or "API"

    baseline_revision_id = db.get_prior_published_baseline_revision_id(
        project_id, tenant_id, published_revision_id
    )

    candidate_openapi = openapi_for_revision(version, tenant_slug, tenant_id)

    baseline_ver: Optional[Dict[str, Any]] = None
    if baseline_revision_id:
        baseline_ver = db.get_version_by_id(baseline_revision_id, tenant_id)
        if not baseline_ver:
            logger.warning(
                "baseline revision %s not found; using empty baseline for change report",
                baseline_revision_id,
            )

    stored_baseline_id: Optional[str] = None
    if baseline_ver:
        baseline_openapi = openapi_for_revision(baseline_ver, tenant_slug, tenant_id)
        change_model = build_change_report(baseline_openapi, candidate_openapi)
        stored_baseline_id = str(baseline_revision_id)
    else:
        change_model = build_change_report(EMPTY_BASELINE_OPENAPI, candidate_openapi)
        if not baseline_revision_id:
            change_model["initialPublication"] = True
        stored_baseline_id = None

    template_row = _resolve_template_row(tenant_id, project_id)
    tpl_id = str(template_row["id"]) if template_row.get("id") else None

    if baseline_ver:
        from_label = str(baseline_ver.get("version_id") or "—")
    else:
        from_label = "Initial publication"

    metadata = build_render_metadata(
        product_name=project_name,
        from_version_label=from_label,
        to_version_label=str(version.get("version_id") or "—"),
        publish_timestamp=_iso_published_at(version),
        static_footnote="",
    )

    header, body, footnote = render_from_template_row(
        change_model, template_row, metadata=metadata
    )

    db.insert_change_report_if_absent(
        tenant_id,
        project_id,
        published_revision_id,
        stored_baseline_id,
        change_model,
        rendered_body=body,
        header_snapshot=header,
        footnote_snapshot=footnote,
        template_version_id=tpl_id,
    )

    db.insert_workflow_audit(
        tenant_id,
        project_id,
        published_revision_id,
        "schema.change_report.generated",
        "success",
        actor_id,
        {
            "baselineRevisionId": stored_baseline_id,
            "publishedRevisionId": published_revision_id,
            "templateVersionId": tpl_id,
            "initialPublication": bool(change_model.get("initialPublication")),
        },
    )
