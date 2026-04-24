import { parseOpenAPISpec, OpenAPIParseResult } from '../../../src/app/utils/openapi-import';
import type { DetectedRepositorySpecFormat } from '../scanner/detect';

export type RepositoryJsonSchemaFormat = Extract<DetectedRepositorySpecFormat, 'json_schema'>;

export interface RepositoryJsonSchemaRef {
  path: string;
  content: string;
}

export interface RepositoryJsonSchemaImportInput {
  source: string;
  format: RepositoryJsonSchemaFormat;
  content: string;
  refs?: RepositoryJsonSchemaRef[];
}

export interface ResolveRepositoryJsonSchemaRefsInput {
  source: string;
  format: RepositoryJsonSchemaFormat;
  content: string;
  refs: RepositoryJsonSchemaRef[];
}

export type ResolveRepositoryJsonSchemaRefs = (
  input: ResolveRepositoryJsonSchemaRefsInput
) => Promise<string> | string;

export interface RepositoryJsonSchemaImportDeps {
  /**
   * REPO-3.8 delegate: caller-provided cross-file $ref resolution.
   * When omitted, the primary content is parsed as-is.
   */
  resolveRefs?: ResolveRepositoryJsonSchemaRefs;
}

export interface RepositoryJsonSchemaImportResult {
  success: boolean;
  source: string;
  format: RepositoryJsonSchemaFormat;
  parseResult?: OpenAPIParseResult;
  resolvedContent?: string;
  warnings: string[];
  error?: string;
}

export async function importJsonSchemaFromRepository(
  input: RepositoryJsonSchemaImportInput,
  deps: RepositoryJsonSchemaImportDeps = {}
): Promise<RepositoryJsonSchemaImportResult> {
  if (!input.content || !input.content.trim()) {
    return {
      success: false,
      source: input.source,
      format: input.format,
      warnings: [],
      error: 'Repository JSON Schema import content is empty.',
    };
  }

  let resolvedContent = input.content;
  const refs = input.refs ?? [];

  if (refs.length > 0 && !deps.resolveRefs) {
    return {
      success: false,
      source: input.source,
      format: input.format,
      warnings: [],
      error: 'Cross-file $ref entries are present but no resolver is configured (REPO-3.8).',
    };
  }

  try {
    if (refs.length > 0 && deps.resolveRefs) {
      resolvedContent = await deps.resolveRefs({
        source: input.source,
        format: input.format,
        content: input.content,
        refs,
      });
    }
  } catch (error: unknown) {
    return {
      success: false,
      source: input.source,
      format: input.format,
      warnings: [],
      error: error instanceof Error ? error.message : 'Failed to resolve cross-file JSON Schema references.',
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
      error: parseResult.error || 'Failed to parse JSON Schema.',
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
