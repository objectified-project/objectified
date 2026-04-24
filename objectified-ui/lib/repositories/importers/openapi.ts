import { parseOpenAPISpec, OpenAPIParseResult } from '../../../src/app/utils/openapi-import';
import type { DetectedRepositorySpecFormat } from '../scanner/detect';
import { resolveRepositoryCrossFileRefs } from './cross-file-ref-resolver';

export type RepositoryOpenApiFormat = Extract<
  DetectedRepositorySpecFormat,
  'openapi_3_0' | 'openapi_3_1' | 'swagger_2_0'
>;

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
   * Optional override for REPO-3.8 cross-file $ref resolution.
   * When omitted, the built-in repository virtual filesystem resolver is used.
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
  const resolver: ResolveRepositoryOpenApiRefs =
    deps.resolveRefs ??
    ((resolveInput) =>
      resolveRepositoryCrossFileRefs({
        source: resolveInput.source,
        content: resolveInput.content,
        refs: resolveInput.refs,
      }));

  try {
    if (refs.length > 0) {
      resolvedContent = await resolver({
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
      resolvedContent,
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
