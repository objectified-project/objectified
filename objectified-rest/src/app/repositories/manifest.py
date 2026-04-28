from __future__ import annotations

import importlib.resources as pkg_resources
import json
import re
from dataclasses import dataclass
from typing import Any, Dict, Literal, Sequence

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
    project: str | None
    version_strategy: str | None
    promote: Literal["auto", "manual"] | None
    on_breaking_change: Literal["warn", "block", "autoCreateNewMajor"] | None
    poll_interval_sec: int | None
    # True when the key is omitted (legacy listed specs). Explicit false for new spec entries.
    import_enabled: bool


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
    import_enabled: bool
    auto_import_enabled: bool
    status: str
    promote: Literal["auto", "manual"] | None = None
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
    promote: Literal["auto", "manual"]
    on_breaking_change: Literal["warn", "block", "autoCreateNewMajor"] | None
    settings_json: dict[str, Any] | None = None


_DEFAULT_VERSION_STRATEGY = "commit-sha"
_SLUG_SANITIZER = re.compile(r"[^a-z0-9]+")


def spec_import_enabled_from_dict(spec: dict[str, Any]) -> bool:
    """True when the key is absent (legacy / pre-rollout listed specs), else the explicit boolean."""
    if "importEnabled" in spec:
        return bool(spec["importEnabled"])
    return True


def initial_import_enabled_for_path(
    *,
    manifest: RepoManifest | None,
    spec: RepoManifestSpec | None,
) -> bool:
    if manifest is None or spec is None:
        return False
    return spec.import_enabled


def initial_auto_import_enabled_for_path(
    *,
    manifest: RepoManifest | None,
    spec: RepoManifestSpec | None,
) -> bool:
    # REPO-9.2: auto import is always explicit opt-in outside of manifest parsing.
    _ = manifest
    _ = spec
    return False


def manifest_duplicate_spec_paths(manifest: RepoManifest | None) -> bool:
    """True when the manifest lists the same ``specs[].path`` more than once (ambiguous)."""
    if manifest is None:
        return False
    paths = [spec.path for spec in manifest.specs]
    return len(paths) != len(set(paths))


def manifest_project_slug_map_from_manifest(manifest: RepoManifest | None) -> Dict[str, str]:
    """``path`` → normalized manifest ``project`` slug for REPO-12.2 conflict evaluation."""
    if manifest is None:
        return {}
    manifest_map: Dict[str, str] = {}
    for spec in manifest.specs:
        normalized_slug = _normalize_project_slug(spec.project)
        if normalized_slug is None:
            continue
        manifest_map[spec.path] = normalized_slug
    return manifest_map


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
    manifest_project_slug = _normalize_project_slug(spec.project) if spec is not None else None
    auto_project_slug = _derive_project_slug_from_path(path)
    project_slug = manifest_project_slug or auto_project_slug
    version_strategy = (
        spec.version_strategy.strip()
        if spec is not None and isinstance(spec.version_strategy, str) and spec.version_strategy.strip()
        else _DEFAULT_VERSION_STRATEGY
    )
    promote: Literal["auto", "manual"] = (
        spec.promote if spec is not None and spec.promote in {"auto", "manual"} else "manual"
    )
    on_breaking_change: Literal["warn", "block", "autoCreateNewMajor"] | None = (
        spec.on_breaking_change
        if spec is not None and spec.on_breaking_change in {"warn", "block", "autoCreateNewMajor"}
        else None
    )
    tracked = project_slug is not None
    settings_json: dict[str, Any] = {}
    if on_breaking_change is not None:
        settings_json["onBreakingChange"] = on_breaking_change
    if not tracked:
        settings_json["mappingRequired"] = True
        settings_json["mappingReason"] = "project_slug_not_resolved"
    settings_json_or_none = settings_json or None
    return RepositoryMappingDecision(
        tracked=tracked,
        project_slug=project_slug,
        version_strategy=version_strategy,
        promote=promote,
        on_breaking_change=on_breaking_change,
        settings_json=settings_json_or_none,
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
        i_enabled = initial_import_enabled_for_path(manifest=manifest, spec=spec)
        ai_enabled = initial_auto_import_enabled_for_path(manifest=manifest, spec=spec)
        rows.append(
            RepositoryFileRow(
                path=discovery.path,
                format=spec.format if spec is not None and spec.format is not None else discovery.detected_format,
                tracked=mapping.tracked,
                project_slug=mapping.project_slug,
                version_strategy=mapping.version_strategy,
                promote=mapping.promote,
                poll_interval_sec=manifest_spec_poll
                if manifest_spec_poll is not None
                else effective_branch_poll_interval,
                import_enabled=i_enabled,
                auto_import_enabled=ai_enabled,
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
                project=spec.get("project"),
                version_strategy=spec.get("versionStrategy"),
                promote=spec.get("promote"),
                on_breaking_change=spec.get("onBreakingChange"),
                poll_interval_sec=spec.get("pollIntervalSec"),
                import_enabled=spec_import_enabled_from_dict(spec),
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
        promote=None,
        poll_interval_sec=None,
        import_enabled=False,
        auto_import_enabled=False,
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
