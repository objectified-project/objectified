import type { ImportJobInput } from 'objectified-importer/server';

/** Body for POST /v1/imports/{tenant_slug} (tenant/user come from the JWT). */
export function importJobInputToRestBody(input: ImportJobInput): Record<string, unknown> {
  return {
    sourceKind: input.sourceKind,
    document: input.document,
    project: input.project,
    version: input.version,
    options: input.options,
    ...(input.existingProjectId != null ? { existingProjectId: input.existingProjectId } : {}),
    ...(input.repositorySource != null ? { repositorySource: input.repositorySource } : {}),
  };
}
