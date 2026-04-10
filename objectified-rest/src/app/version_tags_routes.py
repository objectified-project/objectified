"""
Version tags API — named pointers to schema revisions (git tag analog).
"""

import re
from typing import Any, Dict, List

import psycopg2
from fastapi import APIRouter, Depends, HTTPException

from .auth import validate_authentication, get_authenticated_user_id
from .database import db
from .models import VersionTagSchema, VersionTagCreateRequest, VersionTagUpdateRequest

router = APIRouter(prefix="/v1/version-tags", tags=["version-tags"])

_TAG_NAME_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._\-/]{0,254}$")


def _valid_tag_name(name: str) -> bool:
    return bool(name and _TAG_NAME_RE.match(name.strip()))


def _tenant_id(auth_data: Dict[str, Any]) -> str:
    tid = auth_data.get("tenant_id")
    if not tid:
        raise HTTPException(status_code=500, detail="Missing tenant context")
    return str(tid)


@router.get("/{tenant_slug}/{project_id}", response_model=List[VersionTagSchema])
async def list_version_tags(
    tenant_slug: str,
    project_id: str,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> List[VersionTagSchema]:
    """List all tags for a project."""
    tenant_id = _tenant_id(auth_data)
    project = db.get_project_by_id(project_id, tenant_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    rows = db.list_version_tags_for_project(project_id, tenant_id)
    return [VersionTagSchema(**dict(r)) for r in rows]


@router.post("/{tenant_slug}/{project_id}", response_model=VersionTagSchema)
async def create_version_tag(
    tenant_slug: str,
    project_id: str,
    body: VersionTagCreateRequest,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> VersionTagSchema:
    """Create a tag pointing at an existing schema revision."""
    tenant_id = _tenant_id(auth_data)
    project = db.get_project_by_id(project_id, tenant_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not _valid_tag_name(body.name):
        raise HTTPException(
            status_code=400,
            detail="Invalid tag name: use 1–255 chars, start with letter or digit, [a-zA-Z0-9._\\-/]",
        )
    uid = get_authenticated_user_id(auth_data)
    ch = (body.channel or "").strip()[:64] if body.channel else None
    msg = body.message.strip() if body.message else None
    if msg == "":
        msg = None
    try:
        row = db.create_version_tag(
            project_id,
            tenant_id,
            body.version_id.strip(),
            body.name,
            msg,
            ch,
            bool(body.immutable),
            uid,
        )
        return VersionTagSchema(**dict(row))
    except psycopg2.IntegrityError:
        raise HTTPException(
            status_code=409,
            detail={"code": "TAG_NAME_CONFLICT", "message": "A tag with this name already exists for this project"},
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{tenant_slug}/{project_id}/{tag_id}", response_model=VersionTagSchema)
async def patch_version_tag(
    tenant_slug: str,
    project_id: str,
    tag_id: str,
    body: VersionTagUpdateRequest,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> VersionTagSchema:
    """Move a tag to another revision and/or set immutable lock."""
    tenant_id = _tenant_id(auth_data)
    project = db.get_project_by_id(project_id, tenant_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    uid = get_authenticated_user_id(auth_data)
    auth_method = auth_data.get("auth_method")
    tag = db.get_version_tag_by_id(tag_id, project_id, tenant_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    if auth_method == "jwt":
        if not uid:
            raise HTTPException(status_code=403, detail="JWT must include a user id to modify tags")
        if not db.user_may_manage_version_tag(tenant_id, uid, tag.get("created_by")):
            raise HTTPException(status_code=403, detail="Not allowed to modify this tag")

    new_vid = body.version_id.strip() if body.version_id else None
    set_immutable = body.immutable is True
    try:
        row = db.update_version_tag(tag_id, project_id, tenant_id, new_vid, set_immutable)
    except PermissionError as e:
        if str(e) == "TAG_IMMUTABLE":
            raise HTTPException(
                status_code=409,
                detail={"code": "TAG_IMMUTABLE", "message": "This tag is immutable and cannot be changed"},
            )
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not row:
        raise HTTPException(status_code=404, detail="Tag not found")
    return VersionTagSchema(**dict(row))


@router.delete("/{tenant_slug}/{project_id}/{tag_id}")
async def delete_version_tag(
    tenant_slug: str,
    project_id: str,
    tag_id: str,
    auth_data: Dict[str, Any] = Depends(validate_authentication),
) -> Dict[str, str]:
    """Delete a tag (not allowed when immutable)."""
    tenant_id = _tenant_id(auth_data)
    project = db.get_project_by_id(project_id, tenant_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    uid = get_authenticated_user_id(auth_data)
    auth_method = auth_data.get("auth_method")
    tag = db.get_version_tag_by_id(tag_id, project_id, tenant_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    if auth_method == "jwt":
        if not uid:
            raise HTTPException(status_code=403, detail="JWT must include a user id to delete tags")
        if not db.user_may_manage_version_tag(tenant_id, uid, tag.get("created_by")):
            raise HTTPException(status_code=403, detail="Not allowed to delete this tag")

    try:
        ok = db.delete_version_tag(tag_id, project_id, tenant_id)
    except PermissionError as e:
        if str(e) == "TAG_IMMUTABLE":
            raise HTTPException(
                status_code=409,
                detail={"code": "TAG_IMMUTABLE", "message": "This tag is immutable and cannot be deleted"},
            )
        raise
    if not ok:
        raise HTTPException(status_code=404, detail="Tag not found")
    return {"status": "deleted", "id": tag_id}
