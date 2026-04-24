import { timingSafeEqual } from 'node:crypto';

import { RepositoryProviderError, type RepositoryProvider } from './repository-provider';
import type {
  BranchInfo,
  ListReposOpts,
  RepoDetail,
  RepoRef,
  RepoSummary,
  TreeEntry,
  WebhookTarget,
} from './types';

type FetchFn = typeof fetch;

interface RequestOptions {
  pathOrUrl: string;
  token: string;
  query?: Record<string, string | number | undefined>;
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
}

const BITBUCKET_API_BASE = 'https://api.bitbucket.org/2.0';
const BITBUCKET_MAX_PAGE = 100;

export class BitbucketRepositoryProvider implements RepositoryProvider {
  readonly id = 'bitbucket' as const;
  private readonly fetchFn: FetchFn;

  constructor(fetchFn?: FetchFn) {
    this.fetchFn = fetchFn ?? fetch;
  }

  async *listRepositories(token: string, opts?: ListReposOpts): AsyncIterable<RepoSummary> {
    const perPage = Math.min(opts?.perPage ?? BITBUCKET_MAX_PAGE, BITBUCKET_MAX_PAGE);
    let nextPathOrUrl: string | null = '/repositories';
    let query: Record<string, string | number | undefined> | undefined = {
      role: 'member',
      pagelen: perPage,
      page: opts?.page ?? 1,
      sort: mapBitbucketSort(opts?.sort),
    };

    while (nextPathOrUrl) {
      const payload: Record<string, unknown> = await this.requestJson({
        pathOrUrl: nextPathOrUrl,
        token,
        query,
      });

      const repositories = Array.isArray(payload.values) ? payload.values : [];
      for (const repository of repositories) {
        const summary = toRepoSummary(repository);
        if (summary) {
          yield summary;
        }
      }

      nextPathOrUrl = typeof payload.next === 'string' ? payload.next : null;
      query = undefined;
    }
  }

  async getRepository(token: string, owner: string, name: string): Promise<RepoDetail> {
    const repository = await this.requestJson<unknown>({
      pathOrUrl: `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
      token,
    });
    const summary = toRepoSummary(repository);
    if (summary) {
      return summary;
    }

    return {
      id: '',
      name,
      fullName: `${owner}/${name}`,
      description: null,
      isPrivate: true,
      defaultBranch: 'main',
      htmlUrl: '',
      updatedAt: null,
    };
  }

  async *listBranches(token: string, repo: RepoRef): AsyncIterable<BranchInfo> {
    let nextPathOrUrl: string | null =
      `/repositories/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/refs/branches`;
    let query: Record<string, string | number | undefined> | undefined = { pagelen: BITBUCKET_MAX_PAGE };

    while (nextPathOrUrl) {
      const payload: Record<string, unknown> = await this.requestJson({
        pathOrUrl: nextPathOrUrl,
        token,
        query,
      });
      const branches = Array.isArray(payload.values) ? payload.values : [];

      for (const branch of branches) {
        const record = toRecord(branch);
        if (!record) {
          continue;
        }
        const target = toRecord(record.target);
        yield {
          name: String(record.name ?? ''),
          commitSha: String(target?.hash ?? ''),
          isProtected: false,
        };
      }

      nextPathOrUrl = typeof payload.next === 'string' ? payload.next : null;
      query = undefined;
    }
  }

  async getCommitSha(token: string, repo: RepoRef, branch: string): Promise<string> {
    const payload: unknown = await this.requestJson({
      pathOrUrl:
        `/repositories/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/refs/branches/` +
        encodeURIComponent(branch),
      token,
    });
    const record = toRecord(payload);
    const target = toRecord(record?.target);
    return String(target?.hash ?? '');
  }

  async *walkTree(token: string, repo: RepoRef, branch: string, subpath?: string): AsyncIterable<TreeEntry> {
    const normalizedSubpath = normalizePath(subpath ?? '');
    const queue: string[] = [normalizedSubpath];
    const visited = new Set<string>(queue);

    while (queue.length > 0) {
      const directory = queue.shift() ?? '';
      let nextPathOrUrl: string | null = buildSrcPath(repo, branch, directory);
      let query: Record<string, string | number | undefined> | undefined = { pagelen: BITBUCKET_MAX_PAGE };

      while (nextPathOrUrl) {
        const payload: Record<string, unknown> = await this.requestJson({
          pathOrUrl: nextPathOrUrl,
          token,
          query,
        });

        const entries = Array.isArray(payload.values) ? payload.values : [];
        for (const entry of entries) {
          const normalized = toTreeEntry(entry);
          if (!normalized) {
            continue;
          }

          if (normalized.type === 'dir' && !visited.has(normalized.path)) {
            visited.add(normalized.path);
            queue.push(normalized.path);
          }

          yield normalized;
        }

        nextPathOrUrl = typeof payload.next === 'string' ? payload.next : null;
        query = undefined;
      }
    }
  }

  async readFile(
    token: string,
    repo: RepoRef,
    branch: string,
    path: string
  ): Promise<{ contentBase64: string; sha: string; sizeBytes: number }> {
    const normalizedPath = normalizePath(path);
    const pathOrUrl = buildSrcPath(repo, branch, normalizedPath);
    const metadata: unknown = await this.requestJson({
      pathOrUrl,
      token,
      query: { format: 'meta' },
    });
    const content = await this.requestText({ pathOrUrl, token });
    const metadataRecord = toRecord(metadata);
    const commit = toRecord(metadataRecord?.commit);
    return {
      contentBase64: Buffer.from(content, 'utf8').toString('base64'),
      sha: String(commit?.hash ?? ''),
      sizeBytes: Number(metadataRecord?.size ?? Buffer.byteLength(content)),
    };
  }

  async registerWebhook(token: string, repo: RepoRef, target: WebhookTarget): Promise<{ id: string; secret: string }> {
    const payload: unknown = await this.requestJson({
      pathOrUrl: `/repositories/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/hooks`,
      token,
      method: 'POST',
      body: {
        description: 'Objectified repository webhook',
        url: target.url,
        active: true,
        events: normalizeBitbucketEvents(target.events),
      },
    });
    const record = toRecord(payload);
    const uuid = normalizeHookUuid(String(record?.uuid ?? ''));
    return {
      id: uuid,
      secret: uuid,
    };
  }

  async removeWebhook(token: string, repo: RepoRef, id: string): Promise<void> {
    const normalizedId = normalizeHookUuid(id);
    if (!normalizedId) {
      throw new RepositoryProviderError('UNKNOWN', 'Bitbucket webhook id is invalid');
    }
    await this.request({
      pathOrUrl: `/repositories/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/hooks/${encodeURIComponent(normalizedId)}`,
      token,
      method: 'DELETE',
    });
  }

  verifyWebhookSignature(secret: string, headers: Headers): boolean {
    const expected = normalizeHookUuid(secret);
    const provided = normalizeHookUuid(headers.get('x-hook-uuid') ?? '');
    if (!expected || !provided) {
      return false;
    }

    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(provided);
    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }
    return timingSafeEqual(expectedBuffer, providedBuffer);
  }

  private async requestJson<T>(options: RequestOptions): Promise<T> {
    const response = await this.request(options);
    return (await response.json()) as T;
  }

  private async requestText(options: RequestOptions): Promise<string> {
    const response = await this.request(options);
    return await response.text();
  }

  private async request({ pathOrUrl, token, query, method = 'GET', body }: RequestOptions): Promise<Response> {
    const url = buildUrl(pathOrUrl, query);

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch (error) {
      throw new RepositoryProviderError('NETWORK', 'Failed to reach Bitbucket API', undefined, { cause: error });
    }

    if (!response.ok) {
      const text = await response.text();
      throw normalizeBitbucketError(response.status, text, response.headers);
    }

    return response;
  }
}

function buildUrl(pathOrUrl: string, query?: Record<string, string | number | undefined>): string {
  const url = new URL(pathOrUrl, BITBUCKET_API_BASE);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function buildSrcPath(repo: RepoRef, branch: string, path: string): string {
  const encodedRepo = `${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`;
  const encodedBranch = encodeURIComponent(branch);
  const normalizedPath = normalizePath(path);
  if (!normalizedPath) {
    return `/repositories/${encodedRepo}/src/${encodedBranch}`;
  }
  const encodedPath = normalizedPath
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `/repositories/${encodedRepo}/src/${encodedBranch}/${encodedPath}`;
}

function toRepoSummary(value: unknown): RepoSummary | null {
  const record = toRecord(value);
  if (!record) {
    return null;
  }
  const fullName = String(record.full_name ?? '');
  const slug = toRecord(record.slug);
  const mainbranch = toRecord(record.mainbranch);
  const links = toRecord(record.links);
  const htmlLink = toRecord(links?.html);
  return {
    id: String(record.uuid ?? record.id ?? ''),
    name: String(record.name ?? slug?.name ?? ''),
    fullName,
    description: typeof record.description === 'string' ? record.description : null,
    isPrivate: Boolean(record.is_private),
    defaultBranch: typeof mainbranch?.name === 'string' ? mainbranch.name : 'main',
    htmlUrl: String(htmlLink?.href ?? ''),
    updatedAt: typeof record.updated_on === 'string' ? record.updated_on : null,
  };
}

function toTreeEntry(value: unknown): TreeEntry | null {
  const record = toRecord(value);
  if (!record || typeof record.path !== 'string' || record.path.length === 0) {
    return null;
  }
  const type = mapTreeType(record.type);
  if (!type) {
    return null;
  }
  const commit = toRecord(record.commit);
  return {
    path: normalizePath(record.path),
    type,
    sha: String(commit?.hash ?? ''),
    sizeBytes: Number(record.size ?? 0),
  };
}

function mapTreeType(value: unknown): TreeEntry['type'] | null {
  switch (value) {
    case 'commit_file':
      return 'file';
    case 'commit_directory':
      return 'dir';
    case 'commit_link':
      return 'symlink';
    case 'commit_subrepository':
      return 'submodule';
    default:
      return null;
  }
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as Record<string, unknown>;
}

function mapBitbucketSort(sort?: ListReposOpts['sort']): string {
  switch (sort) {
    case 'created':
      return '-created_on';
    case 'pushed':
      return '-updated_on';
    case 'full_name':
      return 'full_name';
    case 'updated':
    default:
      return '-updated_on';
  }
}

function normalizeBitbucketEvents(events: string[]): string[] {
  if (events.length === 0) {
    return ['repo:push'];
  }
  return events.map((event) => event.trim()).filter((event) => event.length > 0);
}

function normalizeBitbucketError(status: number, body: string, headers: Headers): RepositoryProviderError {
  if (status === 401) {
    return new RepositoryProviderError('UNAUTHORIZED', 'Unauthorized Bitbucket token', status);
  }
  if (status === 404) {
    return new RepositoryProviderError('NOT_FOUND', 'Bitbucket resource not found', status);
  }
  if (status === 429 || isBitbucketRateLimited(status, body, headers)) {
    return new RepositoryProviderError('RATE_LIMITED', 'Bitbucket API rate limit exceeded', status);
  }
  return new RepositoryProviderError('UNKNOWN', 'Unexpected Bitbucket API error', status);
}

function isBitbucketRateLimited(status: number, body: string, headers: Headers): boolean {
  if (status !== 403) {
    return false;
  }
  if (headers.get('x-ratelimit-remaining') === '0') {
    return true;
  }
  return body.toLowerCase().includes('rate limit');
}

function normalizePath(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

function normalizeHookUuid(uuid: string): string {
  return uuid.replace(/[{}]/g, '').trim().toLowerCase();
}
