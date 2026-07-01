/**
 * Unit tests for the catalog store-raw format→adapter mapping (MFI-23.7).
 */
import { describe, test, expect } from '@jest/globals';
import {
  catalogAdapterForFormat,
  isCatalogStorableFormat,
  CATALOG_STORABLE_SOURCES,
} from '../src/app/utils/catalog-import-formats';

describe('catalog-import-formats', () => {
  test('maps adapter-backed detected formats to their REST source_kind', () => {
    expect(catalogAdapterForFormat('protobuf')?.sourceKind).toBe('grpc');
    expect(catalogAdapterForFormat('grpc')?.sourceKind).toBe('grpc');
    expect(catalogAdapterForFormat('graphql')?.sourceKind).toBe('graphql');
    expect(catalogAdapterForFormat('asyncapi')?.sourceKind).toBe('asyncapi');
  });

  test('is case/space-insensitive', () => {
    expect(catalogAdapterForFormat(' Protobuf ')?.sourceKind).toBe('grpc');
    expect(catalogAdapterForFormat('GraphQL')?.sourceKind).toBe('graphql');
  });

  test('returns null for formats with no catalog importer (Thrift/Avro/RAML/…)', () => {
    for (const f of ['thrift', 'avro', 'raml', 'postman', 'jsonschema', 'arazzo', 'openapi', 'swagger', 'unknown', '', null, undefined]) {
      expect(catalogAdapterForFormat(f)).toBeNull();
      expect(isCatalogStorableFormat(f)).toBe(false);
    }
  });

  test('exposes the distinct storable sources (deduped by source_kind)', () => {
    const kinds = CATALOG_STORABLE_SOURCES.map((s) => s.sourceKind).sort();
    expect(kinds).toEqual(['asyncapi', 'graphql', 'grpc']);
  });
});
