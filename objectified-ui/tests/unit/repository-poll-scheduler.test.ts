import { describe, expect, it, jest } from '@jest/globals';

import { createRepositoryPollScheduler } from '../../lib/repositories/poll-scheduler';

type QueryResult = { rowCount: number; rows: Record<string, unknown>[] };

function makeQueryStub(handlers: Array<(sql: string, params: unknown[]) => QueryResult>): jest.MockedFunction<
  (sql: string, params: unknown[]) => Promise<QueryResult>
> {
  let index = 0;
  return jest.fn(async (sql: string, params: unknown[]) => {
    const handler = handlers[index];
    if (!handler) {
      throw new Error(`Unexpected query #${index + 1}: ${sql}`);
    }
    index += 1;
    return handler(sql, params);
  });
}

describe('repository poll scheduler', () => {
  it('dispatches only changed branches and records skipped_unchanged scans', async () => {
    const query = makeQueryStub([
      (sql, params) => {
        expect(sql).toContain('FROM odb.repository_branch rb');
        expect(sql).toContain('rb.is_tracked = TRUE');
        expect(sql).toContain("r.status <> 'paused'");
        expect(sql).toContain("ue.plan_code ILIKE 'enterprise%'");
        expect(sql).toContain('GREATEST(');
        expect(sql).toContain('MIN(rcr.linked_account_id)');
        expect(sql).toContain('rb.last_known_sha');
        expect(params).toEqual(['2026-04-24T20:00:00.000Z', 500, 60, 300]);
        return {
          rowCount: 2,
          rows: [
            {
              branch_id: 'branch-1',
              repository_id: 'repo-1',
              tenant_id: 'tenant-1',
              project_id: 'project-1',
              provider: 'github',
              owner: 'acme',
              name: 'catalog',
              branch: 'main',
              linked_account_id: 'linked-1',
              last_known_sha: 'old-sha-1',
              is_enterprise: false,
              effective_poll_interval_sec: 300,
            },
            {
              branch_id: 'branch-2',
              repository_id: 'repo-2',
              tenant_id: 'tenant-2',
              project_id: null,
              provider: 'github',
              owner: 'acme',
              name: 'payments',
              branch: 'develop',
              linked_account_id: 'linked-2',
              last_known_sha: 'old-sha-2',
              is_enterprise: true,
              effective_poll_interval_sec: 60,
            },
          ],
        };
      },
      (sql, params) => {
        expect(sql).toContain('SELECT access_token');
        expect(params).toEqual(['linked-1']);
        return { rowCount: 1, rows: [{ access_token: 'token-1' }] };
      },
      (sql, params) => {
        expect(sql).toContain('INSERT INTO odb.repository_scan');
        expect(params[2]).toBe('main');
        expect(params[3]).toBe('new-sha-1');
        expect(params[4]).toBe('pending');
        return { rowCount: 1, rows: [] };
      },
      (sql, params) => {
        expect(sql).toContain('INSERT INTO odb.workflow_audit');
        const detail = JSON.parse(String(params[5]));
        expect(detail).toMatchObject({
          repository_id: 'repo-1',
          branch: 'main',
          stream: 'repo.poll.normal',
          poll_interval_sec: 300,
        });
        return { rowCount: 1, rows: [] };
      },
      (sql, params) => {
        expect(sql).toContain('SELECT access_token');
        expect(params).toEqual(['linked-2']);
        return { rowCount: 1, rows: [{ access_token: 'token-2' }] };
      },
      (sql, params) => {
        expect(sql).toContain('INSERT INTO odb.repository_scan');
        expect(params[2]).toBe('develop');
        expect(params[3]).toBe('old-sha-2');
        expect(params[4]).toBe('skipped_unchanged');
        return { rowCount: 1, rows: [] };
      },
      (sql, params) => {
        expect(sql).toContain('INSERT INTO odb.workflow_audit');
        const detail = JSON.parse(String(params[5]));
        expect(detail).toMatchObject({
          repository_id: 'repo-2',
          branch: 'develop',
          stream: 'repo.poll.skipped_unchanged',
          poll_interval_sec: 60,
        });
        return { rowCount: 1, rows: [] };
      },
      (sql, params) => {
        expect(sql).toContain('UPDATE odb.repository_branch rb');
        expect(params[0]).toEqual(['branch-1', 'branch-2']);
        expect(params[1]).toEqual([300, 60]);
        expect(params[2]).toBe('2026-04-24T20:00:00.000Z');
        return { rowCount: 2, rows: [] };
      },
      (sql, params) => {
        expect(sql).toContain('SET last_known_sha = upd.sha');
        expect(params[0]).toEqual(['branch-1', 'branch-2']);
        expect(params[1]).toEqual(['new-sha-1', 'old-sha-2']);
        return { rowCount: 2, rows: [] };
      },
    ]);
    const enqueue = jest.fn(async () => undefined);
    const fetchImpl = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ sha: 'new-sha-1' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 304,
        json: async () => ({}),
      } as Response);
    const scheduler = createRepositoryPollScheduler({
      query,
      enqueue,
      fetchImpl,
      now: () => new Date('2026-04-24T20:00:00.000Z'),
    });

    const result = await scheduler();

    expect(result.dispatched).toBe(1);
    expect(result.jobs.map((job) => [job.branchId, job.stream, job.effectivePollIntervalSec])).toEqual([
      ['branch-1', 'repo.poll.normal', 300],
    ]);
    expect(result.jobs[0]?.headCommitSha).toBe('new-sha-1');
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({
        Authorization: 'Bearer token-1',
        'If-None-Match': '"old-sha-1"',
      }),
    });
    expect(fetchImpl.mock.calls[1]?.[1]).toMatchObject({
      headers: expect.objectContaining({
        Authorization: 'Bearer token-2',
        'If-None-Match': '"old-sha-2"',
      }),
    });
  });

  it('is idempotent across adjacent ticks when no rows remain due', async () => {
    const query = makeQueryStub([
      () => ({
        rowCount: 1,
        rows: [
          {
            branch_id: 'branch-1',
            repository_id: 'repo-1',
            tenant_id: 'tenant-1',
            project_id: null,
            provider: 'github',
            owner: 'acme',
            name: 'catalog',
            branch: 'main',
            linked_account_id: 'linked-1',
            last_known_sha: 'old-sha-1',
            is_enterprise: false,
            effective_poll_interval_sec: 300,
          },
        ],
      }),
      () => ({ rowCount: 1, rows: [{ access_token: 'token-1' }] }),
      () => ({ rowCount: 1, rows: [] }),
      () => ({ rowCount: 1, rows: [] }),
      () => ({ rowCount: 1, rows: [] }),
      () => ({ rowCount: 1, rows: [] }),
      () => ({ rowCount: 0, rows: [] }),
    ]);
    const enqueue = jest.fn(async () => undefined);
    const fetchImpl = jest.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ sha: 'new-sha-1' }),
    } as Response);
    const scheduler = createRepositoryPollScheduler({
      query,
      enqueue,
      fetchImpl,
      now: () => new Date('2026-04-24T20:01:00.000Z'),
    });

    const first = await scheduler();
    const second = await scheduler();

    expect(first.dispatched).toBe(1);
    expect(second.dispatched).toBe(0);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
