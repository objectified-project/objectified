from __future__ import annotations

import importlib.resources as pkg_resources
import json
import re
from dataclasses import dataclass
from typing import Any, Literal, Sequence

import yaml
from jsonschema import Draft202012Validator, ValidationError

DetectedRepositorySpecFormat = Literal[
    "openapi_3_0",
    "openapi_3_1",
    "swagger_2_0",
    "asyncapi_2",
    "asyncapi_3",
    "arazzo_1",
    "json_schema",
    "graphql_sdl",
    "protobuf",
    "avro",
    "unknown_spec",
]

_MANIFEST_RELATIVE_PATH = ".objectified/repo.yaml"


@dataclass(frozen=True)
class RepoManifestDefaults:
    poll_interval_sec: int | None
    branches: tuple[str, ...]


@dataclass(frozen=True)
class RepoManifestSpec:
    path: str
    format: DetectedRepositorySpecFormat | None
    project_slug: str | None
    version_strategy: str | None
    poll_interval_sec: int | None


@dataclass(frozen=True)
class RepoManifest:
    version: int
    defaults: RepoManifestDefaults
    specs: tuple[RepoManifestSpec, ...]
    ignore: tuple[str, ...]


@dataclass(frozen=True)
class RepositoryFileRow:
    path: str
    format: DetectedRepositorySpecFormat | None
    tracked: bool
    project_slug: str | None
    version_strategy: str | None
    poll_interval_sec: int | None
    status: str
    metadata: dict[str, Any] | None = None
    settings_json: dict[str, Any] | None = None


@dataclass(frozen=True)
class RepositoryDiscoveryCandidate:
    path: str
    detected_format: DetectedRepositorySpecFormat


@dataclass(frozen=True)
class RepoManifestParseOutcome:
    manifest: RepoManifest | None
    manifest_error_row: RepositoryFileRow | None


@dataclass(frozen=True)
class RepositoryMappingDecision:
    tracked: bool
    project_slug: str | None
    version_strategy: str
    settings_json: dict[str, Any] | None = None


_DEFAULT_VERSION_STRATEGY = "commit-sha"
_SLUG_SANITIZER = re.compile(r"[^a-z0-9]+")


def parse_repo_manifest(raw_manifest: str | None) -> RepoManifestParseOutcome:
    if raw_manifest is None or not raw_manifest.strip():
        return RepoManifestParseOutcome(manifest=None, manifest_error_row=None)

    try:
        parsed: Any = yaml.safe_load(raw_manifest)
    except yaml.YAMLError as exc:
        return RepoManifestParseOutcome(
            manifest=None,
            manifest_error_row=_manifest_error_row(f"invalid YAML: {exc}"),
        )

    if parsed is None:
        parsed = {}

    try:
        schema = _load_manifest_schema()
    except (FileNotFoundError, json.JSONDecodeError, OSError) as exc:
        return RepoManifestParseOutcome(
            manifest=None,
            manifest_error_row=_manifest_error_row(f"unable to load manifest schema: {exc}"),
        )

    validator = Draft202012Validator(schema)
    try:
        validator.validate(parsed)
    except ValidationError as exc:
        return RepoManifestParseOutcome(
            manifest=None,
            manifest_error_row=_manifest_error_row(_format_schema_error(exc)),
        )

    manifest = _to_repo_manifest(parsed)
    return RepoManifestParseOutcome(manifest=manifest, manifest_error_row=None)


def resolve_repository_file_mapping(path: str, spec: RepoManifestSpec | None) -> RepositoryMappingDecision:
    manifest_project_slug = _normalize_project_slug(spec.project_slug) if spec is not None else None
    auto_project_slug = _derive_project_slug_from_path(path)
    project_slug = manifest_project_slug or auto_project_slug
    version_strategy = (
        spec.version_strategy.strip()
        if spec is not None and isinstance(spec.version_strategy, str) and spec.version_strategy.strip()
        else _DEFAULT_VERSION_STRATEGY
    )
    tracked = project_slug is not None
    settings_json = None
    if not tracked:
        settings_json = {
            "mappingRequired": True,
            "mappingReason": "project_slug_not_resolved",
        }
    return RepositoryMappingDecision(
        tracked=tracked,
        project_slug=project_slug,
        version_strategy=version_strategy,
        settings_json=settings_json,
    )


def build_repository_file_rows(
    *,
    discoveries: Sequence[RepositoryDiscoveryCandidate],
    manifest: RepoManifest | None,
    branch_poll_interval_sec: int | None,
    manifest_error_row: RepositoryFileRow | None = None,
) -> list[RepositoryFileRow]:
    rows: list[RepositoryFileRow] = []
    if manifest_error_row is not None:
        rows.append(manifest_error_row)

    spec_by_path = {spec.path: spec for spec in (manifest.specs if manifest is not None else ())}
    default_poll_interval = manifest.defaults.poll_interval_sec if manifest is not None else None
    effective_branch_poll_interval = (
        branch_poll_interval_sec if branch_poll_interval_sec is not None else default_poll_interval
    )

    for discovery in discoveries:
        spec = spec_by_path.get(discovery.path)
        manifest_spec_poll = spec.poll_interval_sec if spec is not None else None
        mapping = resolve_repository_file_mapping(discovery.path, spec)
        rows.append(
            RepositoryFileRow(
                path=discovery.path,
                format=spec.format if spec is not None and spec.format is not None else discovery.detected_format,
                tracked=mapping.tracked,
                project_slug=mapping.project_slug,
                version_strategy=mapping.version_strategy,
                poll_interval_sec=manifest_spec_poll
                if manifest_spec_poll is not None
                else effective_branch_poll_interval,
                status="discovered",
                settings_json=mapping.settings_json,
            )
        )
    return rows


def _load_manifest_schema() -> dict[str, Any]:
    ref = pkg_resources.files("app.repositories.schemas") / "repo-manifest.v1.json"
    with ref.open("r", encoding="utf-8") as schema_file:
        return json.load(schema_file)


def _to_repo_manifest(parsed: dict[str, Any]) -> RepoManifest:
    defaults = parsed.get("defaults") or {}
    specs = parsed.get("specs") or []
    ignore = parsed.get("ignore") or []

    return RepoManifest(
        version=int(parsed["version"]),
        defaults=RepoManifestDefaults(
            poll_interval_sec=defaults.get("pollIntervalSec"),
            branches=tuple(defaults.get("branches") or ()),
        ),
        specs=tuple(
            RepoManifestSpec(
                path=str(spec["path"]),
                format=spec.get("format"),
                project_slug=spec.get("project"),
                version_strategy=spec.get("versionStrategy"),
                poll_interval_sec=spec.get("pollIntervalSec"),
            )
            for spec in specs
        ),
        ignore=tuple(str(item) for item in ignore),
    )


def _manifest_error_row(message: str) -> RepositoryFileRow:
    return RepositoryFileRow(
        path=_MANIFEST_RELATIVE_PATH,
        format=None,
        tracked=True,
        project_slug=None,
        version_strategy=None,
        poll_interval_sec=None,
        status="manifest_error",
        metadata={"error": message},
    )


def _format_schema_error(error: ValidationError) -> str:
    if error.path:
        pointer = ".".join(str(part) for part in error.path)
        return f"schema validation failed at '{pointer}': {error.message}"
    return f"schema validation failed: {error.message}"


def _derive_project_slug_from_path(path: str) -> str | None:
    parts = [segment.strip() for segment in path.strip().split("/") if segment.strip()]
    if len(parts) < 2:
        return None
    return _normalize_project_slug(parts[0])


def _normalize_project_slug(raw: str | None) -> str | None:
    if raw is None:
        return None
    lowered = raw.strip().lower()
    if not lowered:
        return None
    normalized = _SLUG_SANITIZER.sub("-", lowered).strip("-")
    return normalized or None
