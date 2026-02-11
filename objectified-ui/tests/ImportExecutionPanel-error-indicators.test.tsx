/**
 * Unit tests for Import Execution Panel error indicators (#731)
 *
 * Tests the error-indicator helpers used by ImportExecutionPanel:
 * - Red for failures with details (Failures section, Live Progress, Import Log)
 * - getErrorEvents, formatEventContext, row/log class names, shouldShowFailuresSection
 */

import { describe, test, expect } from '@jest/globals';
import {
  getErrorEvents,
  formatEventContext,
  getLiveProgressRowClasses,
  getImportLogLineClasses,
  shouldShowFailuresSection,
  type ImportEventLike,
  type LogLevel,
} from '../lib/import-execution-error-indicators';

describe('Import Execution Panel - Error Indicators (#731)', () => {
  describe('getErrorEvents', () => {
    test('returns only events with level "error"', () => {
      const events: ImportEventLike[] = [
        { id: '1', ts: 1, level: 'info', code: 'START', message: 'Started' },
        { id: '2', ts: 2, level: 'error', code: 'ERR', message: 'Failed' },
        { id: '3', ts: 3, level: 'warn', code: 'WARN', message: 'Warning' },
        { id: '4', ts: 4, level: 'error', code: 'ERR2', message: 'Failed again' },
      ];
      const result = getErrorEvents(events);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('2');
      expect(result[1].id).toBe('4');
    });

    test('returns empty array when no error events', () => {
      const events: ImportEventLike[] = [
        { id: '1', ts: 1, level: 'info', code: 'A', message: 'A' },
        { id: '2', ts: 2, level: 'warn', code: 'B', message: 'B' },
      ];
      expect(getErrorEvents(events)).toEqual([]);
    });

    test('returns empty array for empty input', () => {
      expect(getErrorEvents([])).toEqual([]);
    });
  });

  describe('formatEventContext', () => {
    test('returns string context as-is', () => {
      expect(formatEventContext('Unexpected token at line 5')).toBe('Unexpected token at line 5');
    });

    test('formats object context as pretty-printed JSON', () => {
      const ctx = { schemaName: 'Foo', reason: 'Duplicate' };
      const out = formatEventContext(ctx);
      expect(out).toContain('"schemaName": "Foo"');
      expect(out).toContain('"reason": "Duplicate"');
    });

    test('returns empty string for null/undefined', () => {
      expect(formatEventContext(null)).toBe('');
      expect(formatEventContext(undefined)).toBe('');
    });
  });

  describe('getLiveProgressRowClasses', () => {
    test('returns red border and background for error', () => {
      const classes = getLiveProgressRowClasses('error');
      expect(classes).toContain('border-red-300');
      expect(classes).toContain('bg-red-50');
      expect(classes).toContain('dark:border-red-700');
      expect(classes).toContain('dark:bg-red-950/30');
    });

    test('returns amber/yellow for warn', () => {
      const classes = getLiveProgressRowClasses('warn');
      expect(classes).toContain('border-yellow-200');
      expect(classes).toContain('bg-amber-50');
    });

    test('returns gray for info', () => {
      const classes = getLiveProgressRowClasses('info');
      expect(classes).toContain('border-gray-100');
      expect(classes).toContain('bg-gray-50');
    });
  });

  describe('getImportLogLineClasses', () => {
    test('returns red background and left border for error', () => {
      const classes = getImportLogLineClasses('error');
      expect(classes).toContain('bg-red-100');
      expect(classes).toContain('border-l-2');
      expect(classes).toContain('border-red-500');
    });

    test('returns amber for warn', () => {
      const classes = getImportLogLineClasses('warn');
      expect(classes).toContain('bg-amber-50');
    });

    test('returns minimal classes for info (no highlight)', () => {
      const classes = getImportLogLineClasses('info');
      expect(classes).not.toContain('border-red');
      expect(classes).not.toContain('bg-red');
    });
  });

  describe('shouldShowFailuresSection', () => {
    test('returns true when there is at least one error event', () => {
      expect(
        shouldShowFailuresSection([
          { id: '1', ts: 1, level: 'info', code: 'A', message: 'A' },
          { id: '2', ts: 2, level: 'error', code: 'ERR', message: 'Fail' },
        ])
      ).toBe(true);
    });

    test('returns false when there are no error events', () => {
      expect(
        shouldShowFailuresSection([
          { id: '1', ts: 1, level: 'info', code: 'A', message: 'A' },
          { id: '2', ts: 2, level: 'warn', code: 'W', message: 'W' },
        ])
      ).toBe(false);
    });

    test('returns false for empty events', () => {
      expect(shouldShowFailuresSection([])).toBe(false);
    });
  });

  describe('Failures section contract (red + details)', () => {
    test('error events include code, message, and optional context for details', () => {
      const errorEvent: ImportEventLike = {
        id: 'ev-1',
        ts: 12345,
        level: 'error',
        code: 'IMPORT_ERROR',
        message: 'Failed to create class Foo',
        context: { schemaName: 'Foo', reason: 'Duplicate' },
      };
      const filtered = getErrorEvents([errorEvent]);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].code).toBe('IMPORT_ERROR');
      expect(filtered[0].message).toBe('Failed to create class Foo');
      expect(formatEventContext(filtered[0].context)).toContain('Foo');
      expect(formatEventContext(filtered[0].context)).toContain('Duplicate');
    });
  });
});
