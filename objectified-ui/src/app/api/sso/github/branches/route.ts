import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { getLinkedAccountById } from '@lib/db/helper';

/** List branches (first page, up to 100). */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { user_id?: string }).user_id;

    if (!userId) {
      return NextResponse.json({ error: 'User ID not found in session' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const accountId = searchParams.get('accountId');
    const repo = searchParams.get('repo');

    if (!accountId || !repo) {
      return NextResponse.json({ error: 'Account ID and repo are required' }, { status: 400 });
    }

    const repoParts = repo.split('/');
    if (repoParts.length !== 2 || !repoParts[0] || !repoParts[1]) {
      return NextResponse.json({ error: 'repo must be in owner/repo format' }, { status: 400 });
    }
    const [repoOwner, repoName] = repoParts;

    const accountResult = await getLinkedAccountById(accountId, userId);
    const accountData = JSON.parse(accountResult);

    if (!accountData.found || !accountData.account) {
      return NextResponse.json({ error: 'Linked account not found' }, { status: 404 });
    }

    const account = accountData.account;

    if (!account.access_token) {
      return NextResponse.json({ error: 'No access token found for this account' }, { status: 401 });
    }

    const commonHeaders = {
      Authorization: `Bearer ${account.access_token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    const branchesUrl = `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/branches?per_page=100`;
    const repositoryUrl = `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}`;

    const [githubBranchesResponse, githubRepositoryResponse] = await Promise.all([
      fetch(branchesUrl, { headers: commonHeaders }),
      fetch(repositoryUrl, { headers: commonHeaders }),
    ]);

    if (!githubBranchesResponse.ok) {
      const errorText = await githubBranchesResponse.text();
      console.error('GitHub API error:', githubBranchesResponse.status, errorText);

      if (githubBranchesResponse.status === 401) {
        return NextResponse.json(
          { error: 'GitHub access token is invalid or expired. Please re-link your account.' },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: `GitHub API error: ${githubBranchesResponse.statusText}` },
        { status: githubBranchesResponse.status }
      );
    }

    const branches: unknown = await githubBranchesResponse.json();
    const names = Array.isArray(branches)
      ? branches
          .map((b) => (typeof b === 'object' && b !== null && 'name' in b ? String((b as { name: string }).name) : ''))
          .filter(Boolean)
      : [];
    const repositoryPayload: unknown = githubRepositoryResponse.ok ? await githubRepositoryResponse.json() : null;
    const defaultBranch =
      typeof repositoryPayload === 'object' &&
      repositoryPayload !== null &&
      'default_branch' in repositoryPayload &&
      typeof (repositoryPayload as { default_branch?: unknown }).default_branch === 'string'
        ? String((repositoryPayload as { default_branch: string }).default_branch)
        : null;

    return NextResponse.json({ branches: names, defaultBranch });
  } catch (error: unknown) {
    console.error('Error fetching GitHub branches:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch branches';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
