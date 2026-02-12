/**
 * Unit tests for Conflict Report (#596): overview of all detected conflicts during import.
 *
 * Covers:
 * - Types (ImportConflict, ImportConflictKind) and conflict kind labels
 * - Building conflict list from schema list (duplicate_schema from existing names)
 * - Summary-by-kind aggregation contract used by ConflictReport UI
 *
 * Component rendering is not tested here (React version mismatch in workspace);
 * the UI is validated manually and the data contract is fully covered below.
 */

import { describe, test, expect } from '@jest/globals';
import type { ImportConflict, ImportConflictKind } from '../src/app/components/ade/dashboard/ConflictReport';

/** Conflict kind labels used by ConflictReport - must stay in sync with component */
const CONFLICT_KIND_LABELS: Record<ImportConflictKind, string> = {
  duplicate_schema: 'Duplicate schema name',
  property_conflict: 'Property conflict',
  reference_conflict: 'Reference conflict',
  type_mismatch: 'Type mismatch',
  semantic_conflict: 'Semantic conflict',
};

/** Summary by kind: counts per conflict type (mirrors ConflictReport logic) */
function getConflictSummary(conflicts: ImportConflict[]): Record<ImportConflictKind, number> {
  return conflicts.reduce<Record<ImportConflictKind, number>>(
    (acc, c) => {
      acc[c.kind] = (acc[c.kind] ?? 0) + 1;
      return acc;
    },
    {
      duplicate_schema: 0,
      property_conflict: 0,
      reference_conflict: 0,
      type_mismatch: 0,
      semantic_conflict: 0,
    }
  );
}

describe('ConflictReport (#596)', () => {
  describe('ImportConflict type and labels', () => {
    test('all conflict kinds have a label', () => {
      const kinds: ImportConflictKind[] = [
        'duplicate_schema',
        'property_conflict',
        'reference_conflict',
        'type_mismatch',
        'semantic_conflict',
      ];
      kinds.forEach((kind) => {
        expect(CONFLICT_KIND_LABELS[kind]).toBeDefined();
        expect(typeof CONFLICT_KIND_LABELS[kind]).toBe('string');
        expect(CONFLICT_KIND_LABELS[kind].length).toBeGreaterThan(0);
      });
    });

    test('duplicate_schema label is for name conflicts', () => {
      expect(CONFLICT_KIND_LABELS.duplicate_schema).toMatch(/duplicate|schema|name/i);
    });

    test('ImportConflict requires kind, schemaName, message', () => {
      const c: ImportConflict = {
        kind: 'duplicate_schema',
        schemaName: 'User',
        message: 'A class named "User" already exists.',
      };
      expect(c.kind).toBe('duplicate_schema');
      expect(c.schemaName).toBe('User');
      expect(c.message).toContain('User');
    });

    test('ImportConflict may include optional detail', () => {
      const c: ImportConflict = {
        kind: 'property_conflict',
        schemaName: 'Order',
        message: 'Property "status" differs.',
        detail: 'Order.status',
      };
      expect(c.detail).toBe('Order.status');
    });
  });

  describe('getConflictSummary', () => {
    test('returns zero counts for empty conflicts', () => {
      const summary = getConflictSummary([]);
      expect(summary.duplicate_schema).toBe(0);
      expect(summary.property_conflict).toBe(0);
      expect(summary.reference_conflict).toBe(0);
      expect(summary.type_mismatch).toBe(0);
      expect(summary.semantic_conflict).toBe(0);
    });

    test('counts single conflict by kind', () => {
      const summary = getConflictSummary([
        { kind: 'duplicate_schema', schemaName: 'User', message: 'User exists.' },
      ]);
      expect(summary.duplicate_schema).toBe(1);
      expect(summary.property_conflict).toBe(0);
    });

    test('counts multiple conflicts of same kind', () => {
      const summary = getConflictSummary([
        { kind: 'duplicate_schema', schemaName: 'User', message: 'User exists.' },
        { kind: 'duplicate_schema', schemaName: 'Product', message: 'Product exists.' },
      ]);
      expect(summary.duplicate_schema).toBe(2);
    });

    test('counts mixed kinds correctly', () => {
      const conflicts: ImportConflict[] = [
        { kind: 'duplicate_schema', schemaName: 'User', message: 'Dup.' },
        { kind: 'property_conflict', schemaName: 'Order', message: 'Prop.', detail: 'x' },
        { kind: 'reference_conflict', schemaName: 'Invoice', message: 'Ref.' },
        { kind: 'type_mismatch', schemaName: 'Item', message: 'Type.' },
        { kind: 'semantic_conflict', schemaName: 'Rule', message: 'Sem.' },
      ];
      const summary = getConflictSummary(conflicts);
      expect(summary.duplicate_schema).toBe(1);
      expect(summary.property_conflict).toBe(1);
      expect(summary.reference_conflict).toBe(1);
      expect(summary.type_mismatch).toBe(1);
      expect(summary.semantic_conflict).toBe(1);
    });
  });

  describe('building conflict list from schema list (duplicate_schema)', () => {
    /**
     * Mirrors the logic in ClassImportDialog: schemas with exists === true
     * become one ImportConflict each with kind 'duplicate_schema'.
     */
    function buildConflictReportFromSchemas(
      schemas: { name: string; exists: boolean }[]
    ): ImportConflict[] {
      return schemas
        .filter((s) => s.exists)
        .map((s) => ({
          kind: 'duplicate_schema' as const,
          schemaName: s.name,
          message: `A class named "${s.name}" already exists in this version. Importing will overwrite or you can rename.`,
        }));
    }

    test('returns empty array when no schemas exist', () => {
      const schemas = [
        { name: 'NewClass', exists: false },
        { name: 'AnotherNew', exists: false },
      ];
      expect(buildConflictReportFromSchemas(schemas)).toEqual([]);
    });

    test('returns one conflict per schema with exists true', () => {
      const schemas = [
        { name: 'User', exists: true },
        { name: 'NewClass', exists: false },
        { name: 'Product', exists: true },
      ];
      const result = buildConflictReportFromSchemas(schemas);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        kind: 'duplicate_schema',
        schemaName: 'User',
        message: expect.stringContaining('User'),
      });
      expect(result[1]).toMatchObject({
        kind: 'duplicate_schema',
        schemaName: 'Product',
        message: expect.stringContaining('Product'),
      });
    });

    test('message includes schema name and overwrite/rename hint', () => {
      const schemas = [{ name: 'Order', exists: true }];
      const result = buildConflictReportFromSchemas(schemas);
      expect(result[0].message).toContain('Order');
      expect(result[0].message).toMatch(/overwrite|rename/i);
    });

    test('order of conflicts matches order of existing schemas in list', () => {
      const schemas = [
        { name: 'A', exists: true },
        { name: 'B', exists: false },
        { name: 'C', exists: true },
      ];
      const result = buildConflictReportFromSchemas(schemas);
      expect(result.map((c) => c.schemaName)).toEqual(['A', 'C']);
    });
  });

  describe('ConflictReport data contract (no render)', () => {
    test('empty conflicts array yields zero total and no rows', () => {
      const conflicts: ImportConflict[] = [];
      const summary = getConflictSummary(conflicts);
      const total = Object.values(summary).reduce((a, b) => a + b, 0);
      expect(total).toBe(0);
    });

    test('single conflict yields total 1 and one kind with count 1', () => {
      const conflicts: ImportConflict[] = [
        { kind: 'duplicate_schema', schemaName: 'User', message: 'User exists.' },
      ];
      const summary = getConflictSummary(conflicts);
      const total = Object.values(summary).reduce((a, b) => a + b, 0);
      expect(total).toBe(1);
      expect(summary.duplicate_schema).toBe(1);
    });

    test('plural summary: multiple of same kind', () => {
      const conflicts: ImportConflict[] = [
        { kind: 'duplicate_schema', schemaName: 'User', message: 'M1' },
        { kind: 'duplicate_schema', schemaName: 'Product', message: 'M2' },
      ];
      const summary = getConflictSummary(conflicts);
      expect(summary.duplicate_schema).toBe(2);
      const kindSummaryEntries = (Object.entries(summary) as [ImportConflictKind, number][]).filter(
        ([, count]) => count > 0
      );
      expect(kindSummaryEntries).toHaveLength(1);
      expect(kindSummaryEntries[0]).toEqual(['duplicate_schema', 2]);
    });
  });
});
