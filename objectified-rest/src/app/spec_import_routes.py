"""
Specification file import — REST contract for CLI (#3329).

Content negotiation
-------------------
* ``POST …/imports`` accepts ``application/json`` with base64-encoded bytes
  (:class:`SpecImportStartJsonRequest`). Prefer this for automation and smaller specs.
* ``POST …/imports/upload`` accepts ``multipart/form-data`` with a binary ``file`` part plus a
  ``metadata`` string field containing JSON for :class:`SpecImportStartMetadata`. Prefer this for
  large documents.

Deployment note
---------------
The dashboard still runs imports through Next.js server actions
(``objectified-ui/lib/db/import-helper.ts``), not these URLs. These routes are the canonical
``/v1/tenants/{{tenant_slug}}/imports/…`` contract for ``objectified-cli`` and future REST-backed
import. Until implemented, handlers return HTTP 501 with a JSON ``detail`` string.
"""

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from .auth import validate_authentication
from .models import (
    SpecImportCommitResponse,
    SpecImportJobAccepted,
    SpecImportJobStatus,
    SpecImportRollbackResponse,
    SpecImportStartJsonRequest,
)

router = APIRouter(prefix="/v1/tenants", tags=["spec-import"])

SPEC_IMPORT_NOT_IMPLEMENTED = (
    "Specification import jobs are not implemented on this server yet; "
    "this route documents the REST contract only (#3329)."
)

_501_RESPONSE: dict = {
    501: {
        "description": "Not Implemented — backend importer is not yet available.",
        "content": {
            "application/json": {
                "schema": {
                    "type": "object",
                    "properties": {"detail": {"type": "string"}},
                }
            }
        },
    }
}


def _not_implemented() -> None:
    raise HTTPException(status_code=501, detail=SPEC_IMPORT_NOT_IMPLEMENTED)


@router.post(
    "/{tenant_slug}/imports",
    status_code=202,
    response_model=SpecImportJobAccepted,
    responses=_501_RESPONSE,
    summary="Start specification import (JSON + base64)",
    description=(
        "Create an asynchronous import job using a JSON body. "
        "The document is sent as standard base64 in ``document_base64``."
    ),
)
async def start_spec_import_json(
    tenant_slug: str,
    body: SpecImportStartJsonRequest,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> SpecImportJobAccepted:
    _ = (tenant_slug, body, auth_data)
    _not_implemented()


@router.post(
    "/{tenant_slug}/imports/upload",
    status_code=202,
    response_model=SpecImportJobAccepted,
    responses=_501_RESPONSE,
    summary="Start specification import (multipart file)",
    description=(
        "Create an asynchronous import job using multipart upload. "
        "The ``metadata`` field must be a JSON string matching "
        "``SpecImportStartMetadata`` (same structure as the ``metadata`` object in the JSON "
        "endpoint). The ``file`` part carries raw spec bytes."
    ),
)
async def start_spec_import_multipart(
    tenant_slug: str,
    file: UploadFile = File(..., description="Raw specification file bytes."),
    metadata: str = Form(
        ...,
        description="JSON string matching SpecImportStartMetadata (project, version, source_kind, options).",
    ),
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> SpecImportJobAccepted:
    _ = (tenant_slug, file, metadata, auth_data)
    _not_implemented()


@router.get(
    "/{tenant_slug}/imports/{job_id}",
    response_model=SpecImportJobStatus,
    responses=_501_RESPONSE,
    summary="Get specification import job status",
)
async def get_spec_import_status(
    tenant_slug: str,
    job_id: str,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> SpecImportJobStatus:
    _ = (tenant_slug, job_id, auth_data)
    _not_implemented()


@router.delete(
    "/{tenant_slug}/imports/{job_id}",
    status_code=204,
    responses=_501_RESPONSE,
    summary="Cancel specification import job",
)
async def cancel_spec_import_job(
    tenant_slug: str,
    job_id: str,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> None:
    _ = (tenant_slug, job_id, auth_data)
    _not_implemented()


@router.post(
    "/{tenant_slug}/imports/{job_id}/commit",
    response_model=SpecImportCommitResponse,
    responses=_501_RESPONSE,
    summary="Commit a previewed specification import",
)
async def commit_spec_import_job(
    tenant_slug: str,
    job_id: str,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> SpecImportCommitResponse:
    _ = (tenant_slug, job_id, auth_data)
    _not_implemented()


@router.post(
    "/{tenant_slug}/imports/{job_id}/rollback",
    response_model=SpecImportRollbackResponse,
    responses=_501_RESPONSE,
    summary="Rollback a committed specification import",
)
async def rollback_spec_import_job(
    tenant_slug: str,
    job_id: str,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> SpecImportRollbackResponse:
    _ = (tenant_slug, job_id, auth_data)
    _not_implemented()
