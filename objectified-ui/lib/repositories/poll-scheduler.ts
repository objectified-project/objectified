'use server';

export type PollPriority = 'high' | 'normal';

export interface PollJob {
  branchId: string;
  repositoryId: string;
  tenantId: string;
  projectId: string | null;
  provider: string;
  owner: string;
  name: string;
  branch: string;
  linkedAccountId: string | null;
  priority: PollPriority;
  stream: string;
  effectivePollIntervalSec: number;
  headCommitSha: string | null;
  dispatchedAt: Date;
}

export interface PollDispatchResult {
  dispatched: number;
  jobs: PollJob[];
}

type QueryRow = {
  branch_id: string;
  repository_id: string;
  tenant_id: string;
  project_id: string | null;
  provider: string;
  owner: string;
  name: string;
  branch: string;
  linked_account_id: string | null;
  is_enterprise: boolean;
  effective_poll_interval_sec: number;
  last_known_sha: string | null;
};

type QueryResult = {
  rowCount: number | null;
  rows: QueryRow[];
};

interface PollSchedulerDeps {
  query: (sql: string, params: unknown[]) => Promise<QueryResult>;
  enqueue: (job: PollJob) => Promise<void>;
  now: () => Date;
  fetchImpl: typeof fetch;
}

export interface PollSchedulerOptions {
  batchSize?: number;
}

const NON_ENTERPRISE_MIN_POLL_SEC = 300;
const ENTERPRISE_MIN_POLL_SEC = 60;
const DEFAULT_BATCH_SIZE = 500;
const GITHUB_API_BASE = 'https://api.github.com';

type DetectedHead = {
  sha: string;
  unchanged: boolean;
};

async function resolveLinkedAccountToken(
  deps: PollSchedulerDeps,
  linkedAccountId: string | null
): Promise<string | null> {
  if (!linkedAccountId) {
    return null;
  }

  try {
    const result = await deps.query(
      `SELECT access_token
       FROM odb.external_auth_providers
       WHERE id = $1
       LIMIT 1`,
      [linkedAccountId]
    );
    const row = result.rows[0] as { access_token?: unknown } | undefined;
    if (!row || typeof row.access_token !== 'string' || row.access_token.trim().length === 0) {
      return null;
    }
    return row.access_token;
  } catch (err) {
    console.error('Failed to resolve linked account token for poll branch', linkedAccountId, ':', err);
    return null;
  }
}

async function detectGithubBranchHead(
  deps: PollSchedulerDeps,
  row: QueryRow
): Promise<DetectedHead | null> {
  const token = await resolveLinkedAccountToken(deps, row.linked_account_id);
  if (!token) {
    return null;
  }

  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (row.last_known_sha) {
    headers['If-None-Match'] = `"${row.last_known_sha}"`;
  }

  const owner = encodeURIComponent(row.owner);
  const name = encodeURIComponent(row.name);
  const branch = encodeURIComponent(row.branch);
  const url = `${GITHUB_API_BASE}/repos/${owner}/${name}/commits/${branch}`;

  try {
    const response = await deps.fetchImpl(url, { headers });
    if (response.status === 304 && row.last_known_sha) {
      return {
        sha: row.last_known_sha,
        unchanged: true,
      };
    }
    if (!response.ok) {
      console.error(
        'Failed to detect commit SHA for branch',
        row.branch_id,
        'status',
        response.status
      );
      return null;
    }

    const payload = (await response.json()) as { sha?: unknown };
    const sha = typeof payload.sha === 'string' ? payload.sha : '';
    if (!sha) {
      return null;
    }
    return {
      sha,
      unchanged: row.last_known_sha === sha,
    };
  } catch (err) {
    console.error('Failed to call provider for branch SHA detection', row.branch_id, ':', err);
    return null;
  }
}

async function insertScheduledScan(
  deps: PollSchedulerDeps,
  args: {
    repositoryId: string;
    branch: string;
    commitSha: string;
    status: 'pending' | 'skipped_unchanged';
    at: Date;
  }
): Promise<void> {
  const atIso = args.at.toISOString();
  const eventLog =
    args.status === 'skipped_unchanged'
      ? [
          {
            type: 'repository.scan.skipped_unchanged',
            at: atIso,
            reason: 'scheduled poll detected no changes',
          },
        ]
      : [
          {
            type: 'repository.scan.queued',
            at: atIso,
            trigger: 'scheduled',
          },
        ];
  const finishedAt = args.status === 'skipped_unchanged' ? atIso : null;
  const durationMs = args.status === 'skipped_unchanged' ? 0 : null;

  try {
    await deps.query(
      `INSERT INTO odb.repository_scan (
        id,
        repository_id,
        branch,
        commit_sha,
        trigger,
        status,
        started_at,
        finished_at,
        duration_ms,
        files_seen,
        files_classified,
        files_unknown,
        files_failed,
        event_log,
        diff_summary
      ) VALUES (
        $1::uuid,
        $2::uuid,
        $3,
        $4,
        'scheduled',
        $5::odb.repository_scan_status,
        $6::timestamptz,
        $7::timestamptz,
        $8,
        0,
        0,
        0,
        0,
        $9::jsonb,
        '{}'::jsonb
      )`,
      [
        crypto.randomUUID(),
        args.repositoryId,
        args.branch,
        args.commitSha,
        args.status,
        atIso,
        finishedAt,
        durationMs,
        JSON.stringify(eventLog),
      ]
    );
  } catch (err) {
    console.error('Failed to insert repository_scan row for scheduled poll branch', args.branch, ':', err);
  }
}

async function insertDispatchAudit(
  deps: PollSchedulerDeps,
  args: {
    tenantId: string;
    projectId: string | null;
    repositoryId: string;
    branch: string;
    actorId: string | null;
    priority: PollPriority;
    stream: string;
    effectivePollIntervalSec: number;
  }
): Promise<void> {
  const detail = {
    repository_id: args.repositoryId,
    branch: args.branch,
    priority: args.priority,
    stream: args.stream,
    poll_interval_sec: args.effectivePollIntervalSec,
  };

  try {
    await deps.query(
      `INSERT INTO odb.workflow_audit (
        tenant_id, project_id, version_id, action, outcome, actor_id, detail
      ) VALUES ($1, $2, NULL, $3, $4, $5, $6::jsonb)`,
      [args.tenantId, args.projectId, 'repository.polled', 'success', args.actorId, JSON.stringify(detail)]
    );
  } catch (err) {
    console.error('Failed to insert workflow_audit for repository.polled:', err);
    return;
  }
}

export function createRepositoryPollScheduler(
  partialDeps: Partial<PollSchedulerDeps>,
  options?: PollSchedulerOptions
) {
  if (!partialDeps.query || !partialDeps.enqueue) {
    throw new Error('createRepositoryPollScheduler requires query and enqueue dependencies');
  }

  const deps: PollSchedulerDeps = {
    query: partialDeps.query,
    enqueue: partialDeps.enqueue,
    now: partialDeps.now ?? (() => new Date()),
    fetchImpl: partialDeps.fetchImpl ?? fetch,
  };
  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;

  return async function dispatchPollTick(): Promise<PollDispatchResult> {
    const now = deps.now();
    const rowsResult = await deps.query(
      `SELECT
          rb.id AS branch_id,
          rb.repository_id,
          r.tenant_id,
          r.project_id,
          r.provider::text AS provider,
          r.owner,
          r.name,
          rb.branch,
          MIN(rcr.linked_account_id) AS linked_account_id,
          rb.last_known_sha,
          COALESCE(MAX(CASE WHEN ue.plan_code ILIKE 'enterprise%' THEN 1 ELSE 0 END), 0) = 1 AS is_enterprise,
          GREATEST(
            rb.poll_interval_sec,
            CASE
              WHEN COALESCE(MAX(CASE WHEN ue.plan_code ILIKE 'enterprise%' THEN 1 ELSE 0 END), 0) = 1 THEN $3
              ELSE $4
            END
          ) AS effective_poll_interval_sec
        FROM odb.repository_branch rb
        JOIN odb.repository r ON r.id = rb.repository_id
        LEFT JOIN odb.repository_credential_ref rcr ON rcr.repository_id = r.id
        LEFT JOIN odb.tenant_users tu ON tu.tenant_id = r.tenant_id
        LEFT JOIN odb.user_entitlements ue ON ue.user_id = tu.user_id
        WHERE rb.is_tracked = TRUE
          AND rb.next_poll_at <= $1
          AND r.status <> 'paused'
        GROUP BY
          rb.id,
          rb.repository_id,
          r.tenant_id,
          r.project_id,
          r.provider,
          r.owner,
          r.name,
          rb.branch,
          rb.last_known_sha,
          rb.poll_interval_sec
        ORDER BY rb.next_poll_at ASC, rb.id ASC
        LIMIT $2
        FOR UPDATE OF rb SKIP LOCKED`,
      [now.toISOString(), batchSize, ENTERPRISE_MIN_POLL_SEC, NON_ENTERPRISE_MIN_POLL_SEC]
    );

    const jobs: PollJob[] = [];
    const processedBranchIds: string[] = [];
    const processedIntervalsSec: number[] = [];
    const headShaBranchIds: string[] = [];
    const headShas: string[] = [];

    for (const row of rowsResult.rows) {
      const detectedHead =
        row.provider === 'github' ? await detectGithubBranchHead(deps, row) : null;
      if (detectedHead) {
        headShaBranchIds.push(row.branch_id);
        headShas.push(detectedHead.sha);
      }

      if (detectedHead?.unchanged) {
        processedBranchIds.push(row.branch_id);
        processedIntervalsSec.push(row.effective_poll_interval_sec);
        await insertScheduledScan(deps, {
          repositoryId: row.repository_id,
          branch: row.branch,
          commitSha: detectedHead.sha,
          status: 'skipped_unchanged',
          at: now,
        });
        await insertDispatchAudit(deps, {
          tenantId: row.tenant_id,
          projectId: row.project_id,
          repositoryId: row.repository_id,
          branch: row.branch,
          actorId: null,
          priority: row.is_enterprise ? 'high' : 'normal',
          stream: 'repo.poll.skipped_unchanged',
          effectivePollIntervalSec: row.effective_poll_interval_sec,
        });
        continue;
      }

      const priority: PollPriority = row.is_enterprise ? 'high' : 'normal';
      const stream = `repo.poll.${priority}`;
      const job: PollJob = {
        branchId: row.branch_id,
        repositoryId: row.repository_id,
        tenantId: row.tenant_id,
        projectId: row.project_id,
        provider: row.provider,
        owner: row.owner,
        name: row.name,
        branch: row.branch,
        linkedAccountId: row.linked_account_id,
        priority,
        stream,
        effectivePollIntervalSec: row.effective_poll_interval_sec,
        headCommitSha: detectedHead?.sha ?? null,
        dispatchedAt: now,
      };

      try {
        await deps.enqueue(job);
      } catch (err) {
        console.error('Failed to enqueue poll job for branch', job.branchId, ':', err);
        continue;
      }

      processedBranchIds.push(job.branchId);
      processedIntervalsSec.push(job.effectivePollIntervalSec);
      jobs.push(job);

      await insertScheduledScan(deps, {
        repositoryId: job.repositoryId,
        branch: job.branch,
        commitSha: job.headCommitSha ?? `pending-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
        status: 'pending',
        at: now,
      });

      await insertDispatchAudit(deps, {
        tenantId: job.tenantId,
        projectId: job.projectId,
        repositoryId: job.repositoryId,
        branch: job.branch,
        actorId: null,
        priority: job.priority,
        stream: job.stream,
        effectivePollIntervalSec: job.effectivePollIntervalSec,
      });
    }

    if (processedBranchIds.length > 0) {
      await deps.query(
        `UPDATE odb.repository_branch rb
        SET
          last_polled_at = upd.now,
          next_poll_at = upd.now + make_interval(secs => upd.interval_sec)
        FROM (
          SELECT
            unnest($1::uuid[]) AS branch_id,
            unnest($2::numeric[]) AS interval_sec,
            $3::timestamptz AS now
        ) upd
        WHERE rb.id = upd.branch_id`,
        [processedBranchIds, processedIntervalsSec, now.toISOString()]
      );
    }

    if (headShaBranchIds.length > 0) {
      await deps.query(
        `UPDATE odb.repository_branch rb
        SET last_known_sha = upd.sha
        FROM (
          SELECT
            unnest($1::uuid[]) AS branch_id,
            unnest($2::text[]) AS sha
        ) upd
        WHERE rb.id = upd.branch_id`,
        [headShaBranchIds, headShas]
      );
    }

    return {
      dispatched: jobs.length,
      jobs,
    };
  };
}

export async function dispatchRepositoryPollTick(): Promise<PollDispatchResult> {
  console.error(
    'dispatchRepositoryPollTick called without a configured enqueue implementation; skipping poll dispatch to avoid mutating state without enqueuing jobs'
  );

  return {
    dispatched: 0,
    jobs: [],
  };
}
