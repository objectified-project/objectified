'use server';

const connectionPool = require('../db/db');

import { BitbucketRepositoryProvider } from './providers/bitbucket-provider';
import { GithubRepositoryProvider } from './providers/github-provider';
import { GitlabRepositoryProvider } from './providers/gitlab-provider';
import { RepositoryProviderError, type RepositoryProvider } from './providers/repository-provider';

export type RepositoryCredentialHealthStatus = 'healthy' | 'scope_missing' | 'revoked' | 'network_error';

type QueryResult = {
  rowCount: number | null;
  rows: Record<string, unknown>[];
};

interface RepositoryCredentialHealthProbeRow {
  linked_account_id: string;
  provider: string;
  access_token: string | null;
  repository_ids: string[];
}

interface RepositoryCredentialHealthMonitorDeps {
  query: (sql: string, params: unknown[]) => Promise<QueryResult>;
  now: () => Date;
  providers: Partial<Record<string, RepositoryProvider>>;
}

export interface RepositoryCredentialHealthMonitorResult {
  processedCredentials: number;
  pausedRepositories: number;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function toProbeRow(raw: Record<string, unknown>): RepositoryCredentialHealthProbeRow | null {
  if (typeof raw.linked_account_id !== 'string' || typeof raw.provider !== 'string') {
    return null;
  }

  return {
    linked_account_id: raw.linked_account_id,
    provider: raw.provider,
    access_token: typeof raw.access_token === 'string' ? raw.access_token : null,
    repository_ids: toStringArray(raw.repository_ids),
  };
}

function classifyProbeFailure(error: unknown): { status: RepositoryCredentialHealthStatus; detail: string } {
  if (!(error instanceof RepositoryProviderError)) {
    return {
      status: 'network_error',
      detail: error instanceof Error ? error.message : 'Unexpected provider probe error.',
    };
  }

  switch (error.code) {
    case 'UNAUTHORIZED':
      return { status: 'revoked', detail: error.message };
    case 'FORBIDDEN':
      return { status: 'scope_missing', detail: error.message };
    default:
      return { status: 'network_error', detail: error.message };
  }
}

async function upsertCredentialHealth(
  deps: RepositoryCredentialHealthMonitorDeps,
  linkedAccountId: string,
  status: RepositoryCredentialHealthStatus,
  checkedAt: string,
  detail: string | null
): Promise<void> {
  await deps.query(
    `INSERT INTO odb.repository_credential_health (
      linked_account_id,
      status,
      checked_at,
      detail,
      updated_at
    ) VALUES ($1::uuid, $2, $3::timestamptz, $4, $3::timestamptz)
    ON CONFLICT (linked_account_id) DO UPDATE
    SET
      status = EXCLUDED.status,
      checked_at = EXCLUDED.checked_at,
      detail = EXCLUDED.detail,
      updated_at = EXCLUDED.updated_at`,
    [linkedAccountId, status, checkedAt, detail]
  );
}

async function pauseRepositoriesForRevokedCredential(
  deps: RepositoryCredentialHealthMonitorDeps,
  linkedAccountId: string,
  repositoryIds: string[],
  checkedAt: string
): Promise<number> {
  if (repositoryIds.length === 0) {
    return 0;
  }

  const pausedResult = await deps.query(
    `UPDATE odb.repository
    SET
      status = 'paused',
      updated_at = $2::timestamptz
    WHERE id = ANY($1::uuid[])
      AND status = 'active'
    RETURNING id, tenant_id, project_id`,
    [repositoryIds, checkedAt]
  );

  if (pausedResult.rows.length > 0) {
    const auditRows = pausedResult.rows
      .filter(
        (rawRow) => typeof rawRow.id === 'string' && typeof rawRow.tenant_id === 'string'
      )
      .map((rawRow) => ({
        repositoryId: rawRow.id as string,
        tenantId: rawRow.tenant_id as string,
        projectId: typeof rawRow.project_id === 'string' ? rawRow.project_id : null,
      }));

    if (auditRows.length > 0) {
      const PARAMS_PER_AUDIT_ROW = 5;
      const valuePlaceholders = auditRows
        .map((_, i) => `($${i * PARAMS_PER_AUDIT_ROW + 1}, $${i * PARAMS_PER_AUDIT_ROW + 2}, NULL, $${i * PARAMS_PER_AUDIT_ROW + 3}, $${i * PARAMS_PER_AUDIT_ROW + 4}, NULL, $${i * PARAMS_PER_AUDIT_ROW + 5}::jsonb)`)
        .join(', ');
      const flatParams: unknown[] = [];
      for (const row of auditRows) {
        flatParams.push(
          row.tenantId,
          row.projectId,
          'repository.auto_paused',
          'success',
          JSON.stringify({
            repository_id: row.repositoryId,
            linked_account_id: linkedAccountId,
            reason: 'credential_revoked',
          })
        );
      }
      await deps.query(
        `INSERT INTO odb.workflow_audit (
          tenant_id, project_id, version_id, action, outcome, actor_id, detail
        ) VALUES ${valuePlaceholders}`,
        flatParams
      );
    }
  }

  return pausedResult.rowCount ?? 0;
}

export function createRepositoryCredentialHealthMonitor(partialDeps?: Partial<RepositoryCredentialHealthMonitorDeps>) {
  const deps: RepositoryCredentialHealthMonitorDeps = {
    query: partialDeps?.query ?? ((sql: string, params: unknown[]) => connectionPool.query(sql, params)),
    now: partialDeps?.now ?? (() => new Date()),
    providers: partialDeps?.providers ?? {
      github: new GithubRepositoryProvider(),
      gitlab: new GitlabRepositoryProvider(),
      bitbucket: new BitbucketRepositoryProvider(),
    },
  };

  return async function runRepositoryCredentialHealthMonitor(): Promise<RepositoryCredentialHealthMonitorResult> {
    const checkedAt = deps.now().toISOString();
    const probeRowsResult = await deps.query(
      `SELECT
        eap.id AS linked_account_id,
        eap.provider::text AS provider,
        eap.access_token,
        ARRAY_AGG(DISTINCT rcr.repository_id) AS repository_ids
      FROM odb.repository_credential_ref rcr
      JOIN odb.external_auth_providers eap ON eap.id = rcr.linked_account_id
      GROUP BY eap.id, eap.provider, eap.access_token
      ORDER BY eap.id`,
      []
    );

    let pausedRepositories = 0;
    for (const rawRow of probeRowsResult.rows) {
      const row = toProbeRow(rawRow);
      if (!row) {
        continue;
      }

      let status: RepositoryCredentialHealthStatus = 'healthy';
      let detail: string | null = null;
      const provider = deps.providers[row.provider];

      if (!row.access_token) {
        status = 'revoked';
        detail = 'Linked account token is missing or was revoked.';
      } else if (!provider) {
        status = 'network_error';
        detail = `Provider "${row.provider}" is not configured for token probing.`;
      } else {
        try {
          await provider.probeIdentity(row.access_token);
        } catch (error) {
          const classified = classifyProbeFailure(error);
          status = classified.status;
          detail = classified.detail;
        }
      }

      await upsertCredentialHealth(deps, row.linked_account_id, status, checkedAt, detail);

      if (status === 'revoked') {
        pausedRepositories += await pauseRepositoriesForRevokedCredential(
          deps,
          row.linked_account_id,
          row.repository_ids,
          checkedAt
        );
      }
    }

    return {
      processedCredentials: probeRowsResult.rows.length,
      pausedRepositories,
    };
  };
}

export async function runRepositoryCredentialHealthMonitor(): Promise<RepositoryCredentialHealthMonitorResult> {
  return createRepositoryCredentialHealthMonitor()();
}
