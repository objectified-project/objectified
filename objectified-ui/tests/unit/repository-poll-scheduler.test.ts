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
        expect(sql).toContain('rb.last_known_etag');
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
              subpath_glob: '**/*',
              configured_poll_interval_sec: 300,
              linked_account_id: 'linked-1',
              last_known_sha: 'old-sha-1',
              last_known_etag: null,
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
              subpath_glob: '**/*',
              configured_poll_interval_sec: 60,
              linked_account_id: 'linked-2',
              last_known_sha: 'old-sha-2',
              last_known_etag: '"etag-old-2"',
              is_enterprise: true,
              effective_poll_interval_sec: 60,
            },
          ],
        };
      },
      (sql, params) => {
        expect(sql).toContain('SELECT id, access_token, token_expires_at');
        expect(sql).toContain('WHERE id = ANY($1::uuid[])');
        expect(params[0]).toEqual(['linked-1', 'linked-2']);
        return {
          rowCount: 2,
          rows: [
            { id: 'linked-1', access_token: 'token-1', token_expires_at: null },
            { id: 'linked-2', access_token: 'token-2', token_expires_at: null },
          ],
        };
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
      (sql, params) => {
        expect(sql).toContain('SET last_known_etag = upd.etag');
        expect(params[0]).toEqual(['branch-1']);
        expect(params[1]).toEqual(['"etag-new-1"']);
        return { rowCount: 1, rows: [] };
      },
    ]);
    const enqueue = jest.fn(async () => undefined);
    const fetchImpl = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ sha: 'new-sha-1' }),
        headers: { get: (h: string) => (h === 'ETag' ? '"etag-new-1"' : null) } as unknown as Headers,
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 304,
        json: async () => ({}),
        headers: { get: () => null } as unknown as Headers,
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
    // branch-1: no prior ETag so no If-None-Match header
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({
        Authorization: 'Bearer token-1',
      }),
    });
    expect((fetchImpl.mock.calls[0]?.[1] as RequestInit | undefined)?.headers).not.toMatchObject(
      expect.objectContaining({ 'If-None-Match': expect.anything() })
    );
    // branch-2: uses stored ETag for conditional request
    expect(fetchImpl.mock.calls[1]?.[1]).toMatchObject({
      headers: expect.objectContaining({
        Authorization: 'Bearer token-2',
        'If-None-Match': '"etag-old-2"',
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
            subpath_glob: '**/*',
            configured_poll_interval_sec: 300,
            linked_account_id: 'linked-1',
            last_known_sha: 'old-sha-1',
            last_known_etag: null,
            is_enterprise: false,
            effective_poll_interval_sec: 300,
          },
        ],
      }),
      () => ({ rowCount: 1, rows: [{ id: 'linked-1', access_token: 'token-1', token_expires_at: null }] }),
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
      headers: { get: () => null } as unknown as Headers,
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

  it('expands wildcard branch templates into tracked concrete branches', async () => {
    const query = makeQueryStub([
      (sql, params) => {
        expect(sql).toContain('FROM odb.repository_branch rb');
        expect(params).toEqual(['2026-04-24T20:02:00.000Z', 500, 60, 300]);
        return {
          rowCount: 1,
          rows: [
            {
              branch_id: 'template-1',
              repository_id: 'repo-9',
              tenant_id: 'tenant-9',
              project_id: null,
              provider: 'github',
              owner: 'acme',
              name: 'platform',
              branch: 'release/*',
              subpath_glob: 'services/**',
              configured_poll_interval_sec: 180,
              linked_account_id: 'linked-9',
              last_known_sha: null,
              last_known_etag: null,
              is_enterprise: false,
              effective_poll_interval_sec: 300,
            },
          ],
        };
      },
      (sql, params) => {
        expect(sql).toContain('SELECT id, access_token, token_expires_at');
        expect(params[0]).toEqual(['linked-9']);
        return {
          rowCount: 1,
          rows: [{ id: 'linked-9', access_token: 'token-9', token_expires_at: null }],
        };
      },
      (sql, params) => {
        expect(sql).toContain('INSERT INTO odb.repository_branch');
        expect(sql).toContain('ON CONFLICT (repository_id, branch) DO UPDATE');
        expect(params).toEqual(['repo-9', ['release/2026.04'], 'services/**', 180, '2026-04-24T20:02:00.000Z']);
        return { rowCount: 1, rows: [] };
      },
      (sql, params) => {
        expect(sql).toContain('UPDATE odb.repository_branch rb');
        expect(params[0]).toEqual(['template-1']);
        expect(params[1]).toEqual([300]);
        expect(params[2]).toBe('2026-04-24T20:02:00.000Z');
        return { rowCount: 1, rows: [] };
      },
    ]);

    const enqueue = jest.fn(async () => undefined);
    const fetchImpl = jest.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [{ name: 'main' }, { name: 'release/2026.04' }],
      headers: { get: () => null } as unknown as Headers,
    } as Response);

    const scheduler = createRepositoryPollScheduler({
      query,
      enqueue,
      fetchImpl,
      now: () => new Date('2026-04-24T20:02:00.000Z'),
    });

    const result = await scheduler();

    expect(result.dispatched).toBe(0);
    expect(result.jobs).toEqual([]);
    expect(enqueue).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toContain('/repos/acme/platform/branches?per_page=100&page=1');
  });
});

