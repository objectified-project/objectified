import { describe, it, expect } from '@jest/globals';
import {
  _internal,
  type RepositorySpecRecord,
} from '@/app/components/ade/dashboard/RepositorySpecsTab';

const { BULK_MAX, matchesListFilter, mergeBulkResponseIntoList, applyOptimisticBulk, chunkIds, minImportableConfidence } = _internal;

const base: RepositorySpecRecord = {
  fileId: 'a',
  repositoryId: 'r',
  scanId: 's',
  branch: 'main',
  path: 'a.yaml',
  format: 'openapi_3_1',
  confidence: 0.9,
  discriminator: null,
  status: 'imported',
  importEnabled: true,
  autoImportEnabled: false,
  lastImportedVersionId: 'v1',
  lastImportedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('REPO-9.7 — RepositorySpecsTab bulk helpers', () => {
  it('uses REST bulk cap 500', () => {
    expect(BULK_MAX).toBe(500);
  });

  it('matchesListFilter: importable requires min confidence', () => {
    expect(
      matchesListFilter(
        { status: 'not_imported', confidence: 0.4, importEnabled: false },
        'importable',
        minImportableConfidence,
      ),
    ).toBe(false);
    expect(
      matchesListFilter(
        { status: 'not_imported', confidence: 0.5, importEnabled: false },
        'importable',
        minImportableConfidence,
      ),
    ).toBe(true);
  });

  it('matchesListFilter: failing is parse or manifest error', () => {
    expect(
      matchesListFilter(
        { status: 'parse_error', confidence: 1, importEnabled: false },
        'failing',
        minImportableConfidence,
      ),
    ).toBe(true);
    expect(
      matchesListFilter(
        { status: 'imported', confidence: 1, importEnabled: true },
        'failing',
        minImportableConfidence,
      ),
    ).toBe(false);
  });

  it('mergeBulkResponseIntoList appends new rows and updates in place', () => {
    const a = { ...base, fileId: '1', path: '1.yaml' };
    const b = { ...base, fileId: '2', path: '2.yaml' };
    const u2 = { ...b, importEnabled: false, autoImportEnabled: false };
    const u3 = { ...base, fileId: '3', path: '3.yaml' };
    const next = mergeBulkResponseIntoList([a, b], [u2, u3]);
    expect(next).toHaveLength(3);
    expect(next[0].fileId).toBe('1');
    expect(next[1].importEnabled).toBe(false);
    expect(next[2].fileId).toBe('3');
  });

  it('applyOptimisticBulk mirrors single-row import-disable rules', () => {
    const rows = [base];
    const next = applyOptimisticBulk(
      rows,
      new Set([base.fileId]),
      { importEnabled: false },
    );
    expect(next[0].importEnabled).toBe(false);
    expect(next[0].autoImportEnabled).toBe(false);
  });

  it('chunkIds splits at cap', () => {
    const ids = Array.from({ length: 501 }, (_, i) => String(i));
    const c = chunkIds(ids, 500);
    expect(c).toHaveLength(2);
    expect(c[0]).toHaveLength(500);
    expect(c[1]).toHaveLength(1);
  });
});
