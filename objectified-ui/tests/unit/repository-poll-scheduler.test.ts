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
  it('reserves only due tracked branches, skips paused repositories, and enforces poll interval floors', async () => {
    const query = makeQueryStub([
      (sql, params) => {
        expect(sql).toContain('FROM odb.repository_branch rb');
        expect(sql).toContain('rb.is_tracked = TRUE');
        expect(sql).toContain("r.status <> 'paused'");
        expect(sql).toContain("ue.plan_code ILIKE 'enterprise%'");
        expect(sql).toContain('GREATEST(');
        expect(sql).toContain('next_poll_at = $1 + make_interval');
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
              linked_account_id: null,
              is_enterprise: true,
              effective_poll_interval_sec: 60,
            },
          ],
        };
      },
      (sql, params) => {
        expect(sql).toContain('INSERT INTO odb.workflow_audit');
        expect(params[2]).toBe('repository.polled');
        expect(params[3]).toBe('success');
        const detail = JSON.parse(String(params[5]));
        expect(detail).toMatchObject({
          repository_id: 'repo-1',
          branch: 'main',
          priority: 'normal',
          stream: 'repo.poll.normal',
          poll_interval_sec: 300,
        });
        return { rowCount: 1, rows: [] };
      },
      (sql, params) => {
        expect(sql).toContain('INSERT INTO odb.workflow_audit');
        expect(params[2]).toBe('repository.polled');
        expect(params[3]).toBe('success');
        const detail = JSON.parse(String(params[5]));
        expect(detail).toMatchObject({
          repository_id: 'repo-2',
          branch: 'develop',
          priority: 'high',
          stream: 'repo.poll.high',
          poll_interval_sec: 60,
        });
        return { rowCount: 1, rows: [] };
      },
    ]);
    const enqueue = jest.fn(async () => undefined);
    const scheduler = createRepositoryPollScheduler({
      query,
      enqueue,
      now: () => new Date('2026-04-24T20:00:00.000Z'),
    });

    const result = await scheduler();

    expect(result.dispatched).toBe(2);
    expect(result.jobs.map((job) => [job.branchId, job.stream, job.effectivePollIntervalSec])).toEqual([
      ['branch-1', 'repo.poll.normal', 300],
      ['branch-2', 'repo.poll.high', 60],
    ]);
    expect(enqueue).toHaveBeenCalledTimes(2);
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
            is_enterprise: false,
            effective_poll_interval_sec: 300,
          },
        ],
      }),
      () => ({ rowCount: 1, rows: [] }),
      () => ({ rowCount: 0, rows: [] }),
    ]);
    const enqueue = jest.fn(async () => undefined);
    const scheduler = createRepositoryPollScheduler({
      query,
      enqueue,
      now: () => new Date('2026-04-24T20:01:00.000Z'),
    });

    const first = await scheduler();
    const second = await scheduler();

    expect(first.dispatched).toBe(1);
    expect(second.dispatched).toBe(0);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });
});
