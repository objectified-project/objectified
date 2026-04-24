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
};

type QueryResult = {
  rowCount: number | null;
  rows: QueryRow[];
};

interface PollSchedulerDeps {
  query: (sql: string, params: unknown[]) => Promise<QueryResult>;
  enqueue: (job: PollJob) => Promise<void>;
  now: () => Date;
}

export interface PollSchedulerOptions {
  batchSize?: number;
}

const NON_ENTERPRISE_MIN_POLL_SEC = 300;
const ENTERPRISE_MIN_POLL_SEC = 60;
const DEFAULT_BATCH_SIZE = 500;

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
  } catch {
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
          rb.poll_interval_sec
        ORDER BY rb.next_poll_at ASC, rb.id ASC
        LIMIT $2
        FOR UPDATE OF rb SKIP LOCKED`,
      [now.toISOString(), batchSize, ENTERPRISE_MIN_POLL_SEC, NON_ENTERPRISE_MIN_POLL_SEC]
    );

    const jobs: PollJob[] = [];
    const enqueuedBranchIds: string[] = [];
    const enqueuedIntervalsSec: number[] = [];

    for (const row of rowsResult.rows) {
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
        dispatchedAt: now,
      };

      try {
        await deps.enqueue(job);
      } catch {
        continue;
      }

      enqueuedBranchIds.push(job.branchId);
      enqueuedIntervalsSec.push(job.effectivePollIntervalSec);
      jobs.push(job);

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

    if (enqueuedBranchIds.length > 0) {
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
        [enqueuedBranchIds, enqueuedIntervalsSec, now.toISOString()]
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
