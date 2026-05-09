/**
 * Tests for REST-backed import API client (`/api/imports` proxies).
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  postImportJob,
  getImportJobStatus,
  postImportCancel,
  postImportCommit,
  postImportRollback,
} from '../lib/import-api-client';

describe('import-api-client', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('postImportJob parses jobId from JSON body', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ jobId: 'job-1', state: 'queued' }),
    });

    const out = await postImportJob({ sourceKind: 'openapi', document: {}, project: {}, version: {}, options: {} });
    expect(out.jobId).toBe('job-1');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/imports',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }) as Record<string, string>,
      })
    );
  });

  test('postImportJob forwards Idempotency-Key when provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ jobId: 'job-2' }),
    });

    await postImportJob({}, { idempotencyKey: 'ik-1' });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/imports',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Idempotency-Key': 'ik-1',
        }) as Record<string, string>,
      })
    );
  });

  test('getImportJobStatus throws on HTTP error with detail string', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ detail: 'missing' }),
    });

    await expect(getImportJobStatus('abc')).rejects.toThrow('missing');
  });

  test('postImportCancel returns parsed body', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ jobId: 'j', state: 'canceled', percent: 0 }),
    });

    const s = await postImportCancel('j');
    expect(s.state).toBe('canceled');
  });

  test('postImportCommit returns ok false with message from structured detail', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 409,
      text: async () =>
        JSON.stringify({
          detail: { code: 'IMPORT_JOB_INVALID_STATE', message: 'Cannot commit', hint: 'wait' },
        }),
    });

    const r = await postImportCommit('j');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('Cannot commit');
  });

  test('postImportRollback success', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ jobId: 'j', state: 'rolled-back' }),
    });

    const r = await postImportRollback('j');
    expect(r.success).toBe(true);
  });
});
