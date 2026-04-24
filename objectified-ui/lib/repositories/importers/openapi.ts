import { parseOpenAPISpec, OpenAPIParseResult } from '../../../src/app/utils/openapi-import';

export type RepositoryOpenApiFormat = 'openapi_3_0' | 'openapi_3_1';

export interface RepositoryOpenApiRef {
  path: string;
  content: string;
}

export interface RepositoryOpenApiImportInput {
  source: string;
  format: RepositoryOpenApiFormat;
  content: string;
  refs?: RepositoryOpenApiRef[];
}

export interface ResolveRepositoryOpenApiRefsInput {
  source: string;
  format: RepositoryOpenApiFormat;
  content: string;
  refs: RepositoryOpenApiRef[];
}

export type ResolveRepositoryOpenApiRefs = (
  input: ResolveRepositoryOpenApiRefsInput
) => Promise<string> | string;

export interface RepositoryOpenApiImportDeps {
  /**
   * REPO-3.8 delegate: caller-provided cross-file $ref resolution.
   * When omitted, the primary content is parsed as-is.
   */
  resolveRefs?: ResolveRepositoryOpenApiRefs;
}

export interface RepositoryOpenApiImportResult {
  success: boolean;
  source: string;
  format: RepositoryOpenApiFormat;
  parseResult?: OpenAPIParseResult;
  resolvedContent?: string;
  warnings: string[];
  error?: string;
}

export async function importOpenApiFromRepository(
  input: RepositoryOpenApiImportInput,
  deps: RepositoryOpenApiImportDeps = {}
): Promise<RepositoryOpenApiImportResult> {
  if (!input.content || !input.content.trim()) {
    return {
      success: false,
      source: input.source,
      format: input.format,
      warnings: [],
      error: 'Repository OpenAPI import content is empty.',
    };
  }

  let resolvedContent = input.content;
  const refs = input.refs ?? [];

  try {
    if (refs.length > 0 && deps.resolveRefs) {
      resolvedContent = await deps.resolveRefs({
        source: input.source,
        format: input.format,
        content: input.content,
        refs,
      });
    }
  } catch (error: any) {
    return {
      success: false,
      source: input.source,
      format: input.format,
      warnings: [],
      error: error?.message || 'Failed to resolve cross-file OpenAPI references.',
    };
  }

  const parseResult = parseOpenAPISpec(resolvedContent);
  if (!parseResult.success) {
    return {
      success: false,
      source: input.source,
      format: input.format,
      warnings: parseResult.warnings ?? [],
      error: parseResult.error || 'Failed to parse OpenAPI specification.',
    };
  }

  return {
    success: true,
    source: input.source,
    format: input.format,
    parseResult,
    resolvedContent,
    warnings: parseResult.warnings ?? [],
  };
}
