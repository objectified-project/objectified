/**
 * Spec-faithful auto-refresh re-import tests (RAR-4.1, #3527).
 *
 * The REST spec-import worker builds its importer input from
 * `lib/repository-auto-refresh-import.ts`. These tests pin the RAR-4.1 contract:
 * a repository auto-refresh (`source_kind === 'repository_auto_import'`) replays
 * the user's ORIGINAL import — options, importer kind, and document parsing all
 * come from the stored import spec, not importer defaults.
 *
 * The headline test is the golden fixture: a file first imported with non-default
 * options (camelCase naming + class prefix + a type mapping) must re-import with
 * byte-identical option application versus the original run.
 */

import { describe, test, expect } from '@jest/globals';

import {
  AUTO_REFRESH_SOURCE_KIND,
  buildImportJobInput,
  resolveImport,
  type StoredImportSpec,
  type WorkerImportPayload,
} from '../lib/repository-auto-refresh-import';

/** A Swagger 2.0 document the original import resolved as `swagger` + JSON. */
const SWAGGER_DOC = {
  swagger: '2.0',
  info: { title: 'Petstore', version: '1.0.0' },
  definitions: { Pet: { type: 'object', properties: { id: { type: 'string' } } } },
};

const SWAGGER_DOC_B64 = Buffer.from(JSON.stringify(SWAGGER_DOC), 'utf8').toString('base64');

/**
 * Non-default options the user submitted at first import, in the verbatim
 * camelCase shape persisted to `repository_import_spec.options_json`. Includes a
 * naming convention, a class prefix, and a type mapping — exactly the advanced
 * options the acceptance criteria call out.
 */
const ORIGINAL_OPTIONS = {
  selectedSchemas: ['Pet'],
  dryRun: false,
  incrementalMode: false,
  applyNamingConvention: true,
  classNamingConvention: 'camelCase',
  propertyNamingConvention: 'snake_case',
  autoLayout: true,
  createRelationships: true,
  classPrefix: 'Api',
  typeMapping: { string: { type: 'string', format: 'text' } },
  generateExamples: true,
  skipDuplicateVersions: false,
};

/** The worker payload the ORIGINAL (manual) import would have run. */
function originalImportPayload(): WorkerImportPayload {
  return {
    tenant_id: 'tenant-1',
    user_id: 'user-1',
    rest_job_id: 'job-original',
    metadata: {
      source_kind: 'openapi-3',
      project: { name: 'Petstore', slug: 'petstore', description: null },
      version: { version_id: '1.0.0', description: null },
      options: ORIGINAL_OPTIONS,
    },
    document_base64: SWAGGER_DOC_B64,
    filename: 'petstore.json',
    content_type: 'application/json',
  };
}

/** The stored spec captured for that import (options + source descriptor). */
function storedSpec(): StoredImportSpec {
  return {
    source_kind: 'openapi-3',
    format_override: 'swagger',
    content_type: 'application/json',
    options: ORIGINAL_OPTIONS,
    spec_schema_version: 1,
  };
}

/** The auto-refresh payload the REST layer enqueues, carrying the stored spec. */
function autoRefreshPayload(overrides: Partial<StoredImportSpec> = {}): WorkerImportPayload {
  return {
    tenant_id: 'tenant-1',
    user_id: 'user-1',
    rest_job_id: 'job-refresh',
    metadata: {
      source_kind: AUTO_REFRESH_SOURCE_KIND,
      project: { name: 'Petstore', slug: 'petstore', description: null },
      version: { version_id: '1.0.1', description: null },
      existing_project_id: 'proj-1',
      // Auto path supplies no per-request options — the stored spec drives everything.
      repository_import_spec: { ...storedSpec(), ...overrides },
    },
    document_base64: SWAGGER_DOC_B64,
    filename: null,
    content_type: null,
  };
}

describe('Repository auto-refresh spec-faithful re-import (RAR-4.1, #3527)', () => {
  test('golden fixture: refresh applies the SAME options as the original import', () => {
    const original = buildImportJobInput(originalImportPayload());
    const refreshed = buildImportJobInput(autoRefreshPayload());

    // Identical option application — the acceptance criterion.
    expect(refreshed.options).toEqual(original.options);
    // Same importer kind and parsed document, too.
    expect(refreshed.sourceKind).toBe(original.sourceKind);
    expect(refreshed.document).toEqual(original.document);
    // Advanced options specifically survived (not defaults).
    expect(refreshed.options.classPrefix).toBe('Api');
    expect(refreshed.options.classNamingConvention).toBe('camelCase');
    expect(refreshed.options.typeMapping).toEqual({ string: { type: 'string', format: 'text' } });
  });

  test('without the stored spec a refresh would fall back to defaults (regression guard)', () => {
    // Build the importer input from an EMPTY options blob — what the worker did
    // before RAR-4.1 (the auto path supplied no options).
    const defaulted = buildImportJobInput({
      ...autoRefreshPayload(),
      metadata: {
        ...autoRefreshPayload().metadata,
        repository_import_spec: { source_kind: 'openapi-3', options: {} },
      },
    });
    expect(defaulted.options.classPrefix).toBeUndefined();
    expect(defaulted.options.applyNamingConvention).toBe(false);
    // Proving the golden fixture is meaningful: defaults differ from the original.
    expect(defaulted.options).not.toEqual(buildImportJobInput(originalImportPayload()).options);
  });

  test('the stored source descriptor drives importer routing (swagger -> openapi)', () => {
    const resolved = resolveImport(autoRefreshPayload({ format_override: 'swagger' }).metadata);
    expect(resolved.sourceKind).toBe('openapi');
    expect(resolved.formatOverride).toBe('swagger');
    expect(resolved.contentType).toBe('application/json');
  });

  test('routing falls back to the stored source_kind when no format override', () => {
    const resolved = resolveImport(
      autoRefreshPayload({ format_override: null, source_kind: 'arazzo' }).metadata,
    );
    expect(resolved.sourceKind).toBe('arazzo');
  });

  test('the stored content type drives document parsing (YAML on refresh)', () => {
    const yamlDoc = 'swagger: "2.0"\ninfo:\n  title: Petstore\n  version: 1.0.0\n';
    const payload = autoRefreshPayload({ content_type: 'application/yaml' });
    payload.document_base64 = Buffer.from(yamlDoc, 'utf8').toString('base64');
    const built = buildImportJobInput(payload);
    expect((built.document as { info: { title: string } }).info.title).toBe('Petstore');
  });

  test('a refresh job missing its stored spec is a clear error, not a silent default', () => {
    const payload = autoRefreshPayload();
    payload.metadata.repository_import_spec = null;
    expect(() => buildImportJobInput(payload)).toThrow(/missing its stored import spec/i);
  });

  test('a non-refresh import is unaffected: options come from request metadata', () => {
    const built = buildImportJobInput(originalImportPayload());
    expect(built.sourceKind).toBe('openapi');
    expect(built.options.classPrefix).toBe('Api');
    expect(built.existingProjectId).toBeUndefined();
  });

  test('existing_project_id is carried through for a refresh', () => {
    const built = buildImportJobInput(autoRefreshPayload());
    expect(built.existingProjectId).toBe('proj-1');
    expect(built.version.versionId).toBe('1.0.1');
  });
});
