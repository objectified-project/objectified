# Repository Mapping Rules

Repository scan classification resolves `repository_file.project_slug` and
`repository_file.version_strategy` using this precedence order.

## 1) Manifest mapping takes priority

When `.objectified/repo.yaml` includes a matching `specs[].path`, mapping is
resolved from that spec first:

- `specs[].project` -> `repository_file.project_slug`
- `specs[].versionStrategy` -> `repository_file.version_strategy`

Manifest values are authoritative for matched paths.

## 2) Auto mapping fallback

When a path is not explicitly mapped in the manifest:

- `project_slug` is derived from the first path segment
  - Example: `billing/openapi.yaml` -> `billing`
- `version_strategy` defaults to `commit-sha`

## 3) Unmapped files

If no project slug can be derived (for example root-level files like
`openapi.yaml`), the row is persisted with:

- `tracked=false`
- `project_slug=NULL`
- `version_strategy='commit-sha'`
- `settings_json.mappingRequired=true`

This gives the UI a deterministic affordance to prompt manual mapping.
