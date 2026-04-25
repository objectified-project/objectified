import { describe, expect, it, jest } from '@jest/globals';

import { createRepositoryCredentialHealthMonitor } from '../../lib/repositories/token-health-monitor';
import { RepositoryProviderError } from '../../lib/repositories/providers/repository-provider';

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

function makeProvider(probe: () => Promise<void>) {
  return {
    id: 'github',
    listRepositories: async function* () {},
    getRepository: async () => ({ id: '', name: '', fullName: '', description: null, isPrivate: true, defaultBranch: 'main', htmlUrl: '', updatedAt: null }),
    listBranches: async function* () {},
    getCommitSha: async () => '',
    walkTree: async function* () {},
    readFile: async () => ({ contentBase64: '', sha: '', sizeBytes: 0 }),
    probeIdentity: probe,
  };
}

describe('repository credential health monitor', () => {
  it('stores probe classifications and auto-pauses repositories for revoked credentials', async () => {
    const githubProbe = jest.fn(async () => undefined);
    const gitlabProbe = jest.fn(async () => {
      throw new RepositoryProviderError('FORBIDDEN', 'missing scope', 403);
    });
    const query = makeQueryStub([
      (sql) => {
        expect(sql).toContain('FROM odb.repository_credential_ref rcr');
        return {
          rowCount: 3,
          rows: [
            {
              linked_account_id: 'linked-healthy',
              provider: 'github',
              access_token: 'token-healthy',
              repository_ids: ['repo-a'],
            },
            {
              linked_account_id: 'linked-scope',
              provider: 'gitlab',
              access_token: 'token-scope',
              repository_ids: ['repo-b'],
            },
            {
              linked_account_id: 'linked-revoked',
              provider: 'github',
              access_token: null,
              repository_ids: ['repo-c', 'repo-d'],
            },
          ],
        };
      },
      (sql, params) => {
        expect(sql).toContain('INSERT INTO odb.repository_credential_health');
        expect(params[0]).toBe('linked-healthy');
        expect(params[1]).toBe('healthy');
        expect(params[3]).toBeNull();
        return { rowCount: 1, rows: [] };
      },
      (sql, params) => {
        expect(sql).toContain('INSERT INTO odb.repository_credential_health');
        expect(params[0]).toBe('linked-scope');
        expect(params[1]).toBe('scope_missing');
        expect(String(params[3])).toContain('missing scope');
        return { rowCount: 1, rows: [] };
      },
      (sql, params) => {
        expect(sql).toContain('INSERT INTO odb.repository_credential_health');
        expect(params[0]).toBe('linked-revoked');
        expect(params[1]).toBe('revoked');
        return { rowCount: 1, rows: [] };
      },
      (sql, params) => {
        expect(sql).toContain('UPDATE odb.repository');
        expect(params[0]).toEqual(['repo-c', 'repo-d']);
        return {
          rowCount: 2,
          rows: [
            { id: 'repo-c', tenant_id: 'tenant-1', project_id: 'project-1' },
            { id: 'repo-d', tenant_id: 'tenant-1', project_id: null },
          ],
        };
      },
      (sql, params) => {
        expect(sql).toContain('INSERT INTO odb.workflow_audit');
        // Batched insert: params are laid out as 5 values per row
        expect(params[2]).toBe('repository.auto_paused');
        const detailC = JSON.parse(String(params[4]));
        expect(detailC).toMatchObject({
          repository_id: 'repo-c',
          linked_account_id: 'linked-revoked',
          reason: 'credential_revoked',
        });
        expect(params[7]).toBe('repository.auto_paused');
        const detailD = JSON.parse(String(params[9]));
        expect(detailD.repository_id).toBe('repo-d');
        return { rowCount: 2, rows: [] };
      },
    ]);

    const monitor = createRepositoryCredentialHealthMonitor({
      query,
      now: () => new Date('2026-04-24T20:20:00.000Z'),
      providers: {
        github: makeProvider(githubProbe),
        gitlab: makeProvider(gitlabProbe),
      },
    });

    const result = await monitor();

    expect(result).toEqual({
      processedCredentials: 3,
      pausedRepositories: 2,
    });
    expect(githubProbe).toHaveBeenCalledTimes(1);
    expect(githubProbe).toHaveBeenCalledWith('token-healthy');
    expect(gitlabProbe).toHaveBeenCalledTimes(1);
  });
});
