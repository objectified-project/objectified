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
  subpath_glob: string;
  configured_poll_interval_sec: number;
  linked_account_id: string | null;
  is_enterprise: boolean;
  effective_poll_interval_sec: number;
  last_known_sha: string | null;
  last_known_etag: string | null;
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
const CONCURRENT_HEAD_CHECKS = 8;
const GITHUB_API_BASE = 'https://api.github.com';

type DetectedHead = {
  sha: string;
  unchanged: boolean;
  etag: string | null;
};

function isBranchGlobPattern(branch: string): boolean {
  return branch.includes('*') || branch.includes('?') || branch.includes('[') || branch.includes(']');
}

function escapeRegExpLiteral(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function branchGlobToRegExp(branchGlob: string): RegExp {
  let regex = '^';
  for (let i = 0; i < branchGlob.length; i += 1) {
    const char = branchGlob[i];
    if (char === '*') {
      const isDoubleStar = branchGlob[i + 1] === '*';
      if (isDoubleStar) {
        regex += '.*';
        i += 1;
      } else {
        regex += '[^/]*';
      }
      continue;
    }
    if (char === '?') {
      regex += '[^/]';
      continue;
    }
    regex += escapeRegExpLiteral(char);
  }
  regex += '$';
  return new RegExp(regex);
}

async function listGithubRepositoryBranches(
  deps: PollSchedulerDeps,
  row: QueryRow,
  token: string
): Promise<string[] | null> {
  const owner = encodeURIComponent(row.owner);
  const name = encodeURIComponent(row.name);
  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const branchNames: string[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${name}/branches?per_page=${perPage}&page=${page}`;
    let response: Response;
    try {
      response = await deps.fetchImpl(url, { headers });
    } catch (err) {
      console.error('Failed to list provider branches for wildcard expansion', row.branch_id, ':', err);
      return null;
    }
    if (!response.ok) {
      console.error(
        'Failed to list provider branches for wildcard expansion',
        row.branch_id,
        'status',
        response.status
      );
      return null;
    }
    const payload = (await response.json()) as Array<{ name?: unknown }>;
    if (!Array.isArray(payload)) {
      return null;
    }
    for (const entry of payload) {
      if (typeof entry.name === 'string' && entry.name) {
        branchNames.push(entry.name);
      }
    }
    if (payload.length < perPage) {
      break;
    }
    page += 1;
  }

  return branchNames;
}

async function expandWildcardBranchRows(
  deps: PollSchedulerDeps,
  rows: QueryRow[],
  tokenMap: Map<string, string>,
  now: Date
): Promise<{ dispatchRows: QueryRow[]; templateBranchIds: string[]; templateIntervalsSec: number[] }> {
  const dispatchRows: QueryRow[] = [];
  const templateBranchIds: string[] = [];
  const templateIntervalsSec: number[] = [];

  for (const row of rows) {
    if (!isBranchGlobPattern(row.branch)) {
      dispatchRows.push(row);
      continue;
    }

    templateBranchIds.push(row.branch_id);
    templateIntervalsSec.push(row.effective_poll_interval_sec);

    if (row.provider !== 'github') {
      continue;
    }
    const token = tokenMap.get(row.linked_account_id ?? '');
    if (!token) {
      continue;
    }

    const providerBranches = await listGithubRepositoryBranches(deps, row, token);
    if (!providerBranches || providerBranches.length === 0) {
      continue;
    }

    const matcher = branchGlobToRegExp(row.branch);
    const matchingBranches = providerBranches.filter((branch) => matcher.test(branch));
    for (const matchedBranch of matchingBranches) {
      try {
        await deps.query(
          `INSERT INTO odb.repository_branch (
            repository_id,
            branch,
            subpath_glob,
            is_tracked,
            poll_interval_sec,
            next_poll_at
          ) VALUES (
            $1::uuid,
            $2,
            $3,
            TRUE,
            $4,
            $5::timestamptz
          )
          ON CONFLICT (repository_id, branch) DO UPDATE
          SET
            is_tracked = TRUE,
            subpath_glob = EXCLUDED.subpath_glob,
            poll_interval_sec = EXCLUDED.poll_interval_sec,
            next_poll_at = LEAST(
              COALESCE(odb.repository_branch.next_poll_at, EXCLUDED.next_poll_at),
              EXCLUDED.next_poll_at
            )`,
          [
            row.repository_id,
            matchedBranch,
            row.subpath_glob,
            row.configured_poll_interval_sec,
            now.toISOString(),
          ]
        );
      } catch (err) {
        console.error('Failed to upsert expanded wildcard branch', matchedBranch, 'for row', row.branch_id, ':', err);
      }
    }
  }

  return { dispatchRows, templateBranchIds, templateIntervalsSec };
}

async function batchResolveLinkedAccountTokens(
  deps: PollSchedulerDeps,
  linkedAccountIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(linkedAccountIds.filter(Boolean))];
  if (unique.length === 0) {
    return new Map();
  }

  try {
    const result = await deps.query(
      `SELECT id, access_token, token_expires_at
       FROM odb.external_auth_providers
       WHERE id = ANY($1::uuid[])`,
      [unique]
    );
    const now = deps.now();
    const map = new Map<string, string>();
    for (const rawRow of result.rows) {
      const row = rawRow as { id?: unknown; access_token?: unknown; token_expires_at?: unknown };
      if (typeof row.id !== 'string' || typeof row.access_token !== 'string' || !row.access_token.trim()) {
        continue;
      }
      if (row.token_expires_at != null) {
        const expiresAt = new Date(row.token_expires_at as string);
        if (!isNaN(expiresAt.getTime()) && expiresAt <= now) {
          console.warn('Skipping expired linked account token during poll for account:', row.id);
          continue;
        }
      }
      map.set(row.id, row.access_token);
    }
    return map;
  } catch (err) {
    console.error('Failed to batch resolve linked account tokens for poll:', err);
    return new Map();
  }
}

async function detectGithubBranchHead(
  deps: PollSchedulerDeps,
  row: QueryRow,
  token: string
): Promise<DetectedHead | null> {
  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (row.last_known_etag) {
    headers['If-None-Match'] = row.last_known_etag;
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
        etag: null,
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
    const etag = response.headers.get('ETag') ?? null;
    return {
      sha,
      unchanged: row.last_known_sha === sha,
      etag,
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
          rb.subpath_glob,
          rb.poll_interval_sec AS configured_poll_interval_sec,
          MIN(rcr.linked_account_id) AS linked_account_id,
          rb.last_known_sha,
          rb.last_known_etag,
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
          rb.last_known_etag,
          rb.poll_interval_sec
        ORDER BY rb.next_poll_at ASC, rb.id ASC
        LIMIT $2
        FOR UPDATE OF rb SKIP LOCKED`,
      [now.toISOString(), batchSize, ENTERPRISE_MIN_POLL_SEC, NON_ENTERPRISE_MIN_POLL_SEC]
    );

    const jobs: PollJob[] = [];
    const headShaBranchIds: string[] = [];
    const headShas: string[] = [];
    const headEtagBranchIds: string[] = [];
    const headEtags: string[] = [];

    // Batch-prefetch all linked account tokens in one query, checking expiry.
    const githubLinkedAccountIds = rowsResult.rows
      .filter((row) => row.provider === 'github')
      .map((row) => row.linked_account_id)
      .filter((id): id is string => !!id);
    const tokenMap = await batchResolveLinkedAccountTokens(deps, githubLinkedAccountIds);
    const { dispatchRows, templateBranchIds, templateIntervalsSec } = await expandWildcardBranchRows(
      deps,
      rowsResult.rows,
      tokenMap,
      now
    );
    const processedBranchIds: string[] = [...templateBranchIds];
    const processedIntervalsSec: number[] = [...templateIntervalsSec];

    // Detect HEAD commits with bounded concurrency so scheduler latency scales.
    const detectedHeads: (DetectedHead | null)[] = new Array(dispatchRows.length).fill(null);
    const headTasks = dispatchRows.map((row, index) => async () => {
      if (row.provider !== 'github') return;
      const token = tokenMap.get(row.linked_account_id ?? '');
      if (!token) return;
      detectedHeads[index] = await detectGithubBranchHead(deps, row, token);
    });
    for (let i = 0; i < headTasks.length; i += CONCURRENT_HEAD_CHECKS) {
      await Promise.all(headTasks.slice(i, i + CONCURRENT_HEAD_CHECKS).map((fn) => fn()));
    }

    for (let rowIndex = 0; rowIndex < dispatchRows.length; rowIndex++) {
      const row = dispatchRows[rowIndex];
      const detectedHead = detectedHeads[rowIndex] ?? null;

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
        // Persist SHA (ETag is null for 304 responses — no update needed).
        headShaBranchIds.push(row.branch_id);
        headShas.push(detectedHead.sha);
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

      // Persist SHA and ETag only after the job was successfully enqueued and recorded.
      if (detectedHead) {
        headShaBranchIds.push(row.branch_id);
        headShas.push(detectedHead.sha);
        if (detectedHead.etag) {
          headEtagBranchIds.push(row.branch_id);
          headEtags.push(detectedHead.etag);
        }
      }
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

    if (headEtagBranchIds.length > 0) {
      await deps.query(
        `UPDATE odb.repository_branch rb
        SET last_known_etag = upd.etag
        FROM (
          SELECT
            unnest($1::uuid[]) AS branch_id,
            unnest($2::text[]) AS etag
        ) upd
        WHERE rb.id = upd.branch_id`,
        [headEtagBranchIds, headEtags]
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
