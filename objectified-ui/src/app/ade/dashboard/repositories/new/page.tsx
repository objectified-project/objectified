'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Globe, Link2, PlusCircle, Search } from 'lucide-react';
import { Button, buttonVariants } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { Label } from '@/app/components/ui/Label';
import { LoadingState } from '@/app/components/ui/LoadingState';
import { toast } from 'sonner';
import { cn } from '@lib/utils';
import { getLinkedAccountsForUser } from '@lib/db/helper';
import {
  dashboardContentStackClass,
  dashboardMainClass,
} from '@/app/components/ade/dashboard/dashboardScreenClasses';
import {
  LinkedAccountIcon,
  ManageLinkedAccountsLink,
  SourceOptionCard,
} from '@/app/components/ade/dashboard/repositories/repositoryStoreUi';

type SourceKind = 'linked' | 'public_url';

interface LinkedAccount {
  id: string;
  provider: string;
  provider_email: string;
  provider_username: string | null;
}

export default function AddRepositoryPage() {
  const { data: session } = useSession();
  const currentTenantId = (session?.user as { current_tenant_id?: string })?.current_tenant_id;
  const userId = (session?.user as { user_id?: string })?.user_id;

  const [source, setSource] = useState<SourceKind>('linked');
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [repoSearch, setRepoSearch] = useState('');
  const [publicCloneUrl, setPublicCloneUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [urlTestLoading, setUrlTestLoading] = useState(false);
  const [urlTestResult, setUrlTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoadingAccounts(true);
    void (async () => {
      try {
        const raw = await getLinkedAccountsForUser(userId);
        const list = JSON.parse(raw) as LinkedAccount[];
        if (!cancelled) {
          setLinkedAccounts(Array.isArray(list) ? list : []);
          if (Array.isArray(list) && list.length === 1) {
            setSelectedAccountId(list[0].id);
          }
        }
      } catch {
        if (!cancelled) setLinkedAccounts([]);
      } finally {
        if (!cancelled) setLoadingAccounts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    setUrlTestResult(null);
  }, [publicCloneUrl]);

  const selectedAccount = useMemo(
    () => linkedAccounts.find((a) => a.id === selectedAccountId) ?? null,
    [linkedAccounts, selectedAccountId]
  );

  const accountLabel = (a: LinkedAccount) => {
    const u = a.provider_username?.trim();
    if (u) return u;
    return a.provider_email;
  };

  const canContinue =
    source === 'public_url'
      ? /^https:\/\/.+\..+/.test(publicCloneUrl.trim())
      : Boolean(selectedAccountId);

  const handleTestPublicUrl = async () => {
    const u = publicCloneUrl.trim();
    if (!/^https:\/\//i.test(u)) {
      toast.error('Enter an HTTPS clone URL to test.');
      return;
    }
    setUrlTestLoading(true);
    setUrlTestResult(null);
    try {
      const res = await fetch('/api/repositories/test-public-url', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (res.status === 401) {
        toast.error('Sign in to test this URL.');
        return;
      }
      const ok = Boolean(data.ok);
      const message = typeof data.message === 'string' ? data.message : 'Unexpected response from server.';
      setUrlTestResult({ ok, message });
      if (ok) {
        toast.success('URL looks reachable.');
      } else {
        toast.error(message);
      }
    } catch {
      const message = 'Could not reach the test service. Check your connection and try again.';
      setUrlTestResult({ ok: false, message });
      toast.error(message);
    } finally {
      setUrlTestLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!currentTenantId) {
      toast.error('Select a tenant first.');
      return;
    }
    if (!canContinue) {
      toast.error(source === 'public_url' ? 'Enter an HTTPS clone URL.' : 'Pick a linked account.');
      return;
    }
    setSubmitting(true);
    try {
      const body =
        source === 'public_url'
          ? { source: 'public_url', clone_url: publicCloneUrl.trim() }
          : { source: 'linked_account', linked_account_id: selectedAccountId };
      const res = await fetch('/api/repositories', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 501) {
        toast.message(typeof data.error === 'string' ? data.error : 'Repository API is not enabled yet.');
        return;
      }
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : res.statusText);
      }
      toast.success('Repository registered.');
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentTenantId) {
    return (
      <div className={cn(dashboardMainClass, 'max-w-3xl')}>
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-8 dark:border-amber-700/50 dark:from-amber-900/20 dark:to-yellow-900/20">
          <h2 className="mb-2 text-xl font-bold text-amber-900 dark:text-amber-100">No tenant selected</h2>
          <p className="mb-4 text-amber-800 dark:text-amber-200">Select a tenant before adding a repository.</p>
          <Link href="/ade/dashboard/tenants" className={cn(buttonVariants())}>
            Go to Tenants
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(dashboardMainClass, dashboardContentStackClass, 'max-w-4xl')}>
      <div className="border-b border-gray-200 bg-white px-6 pb-5 pt-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/20">
            <PlusCircle className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Add a repository</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              Register a repository so Objectified can scan it for importable specifications. Choose a linked account or
              paste a public Git URL.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-6 pb-10">
        <ol className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <li className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-semibold text-white">
              1
            </span>
            Source
          </li>
          <li className="hidden w-8 border-t border-gray-300 sm:block dark:border-gray-600" aria-hidden />
          <li className="flex items-center gap-2 text-gray-400">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[11px] font-semibold dark:bg-gray-700">
              2
            </span>
            Repository
          </li>
          <li className="hidden w-8 border-t border-gray-300 sm:block dark:border-gray-600" aria-hidden />
          <li className="flex items-center gap-2 text-gray-400">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[11px] font-semibold dark:bg-gray-700">
              3
            </span>
            Scan settings
          </li>
          <li className="hidden w-8 border-t border-gray-300 sm:block dark:border-gray-600" aria-hidden />
          <li className="flex items-center gap-2 text-gray-400">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[11px] font-semibold dark:bg-gray-700">
              4
            </span>
            Confirm
          </li>
        </ol>

        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 text-sm font-semibold">Where does the repository live?</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <SourceOptionCard
              radioName="repo-source"
              selected={source === 'linked'}
              onSelect={() => setSource('linked')}
              icon={<Link2 className="h-4 w-4 text-indigo-500" aria-hidden />}
              title="Linked account"
              description="Pick from repos accessible via your connected GitHub, GitLab, or Bitbucket account."
            />
            <SourceOptionCard
              radioName="repo-source"
              selected={source === 'public_url'}
              onSelect={() => setSource('public_url')}
              icon={<Globe className="h-4 w-4 text-emerald-500" aria-hidden />}
              title="Public Git URL"
              description="Paste the HTTPS clone URL of any public repository — no authentication required."
            />
          </div>
        </div>

        {source === 'linked' && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Linked accounts</h3>
              <ManageLinkedAccountsLink />
            </div>
            {loadingAccounts ? (
              <LoadingState message="Loading linked accounts…" />
            ) : linkedAccounts.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No linked accounts yet.{' '}
                <Link href="/ade/dashboard/linked-accounts" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                  Connect GitHub or GitLab
                </Link>{' '}
                to browse private repositories.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {linkedAccounts.map((a) => {
                  const active = selectedAccountId === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setSelectedAccountId(a.id)}
                      className={cn(
                        'rounded-lg border-2 p-3 text-left transition-colors',
                        active
                          ? 'border-indigo-500 bg-indigo-50/40 dark:border-indigo-500 dark:bg-indigo-900/10'
                          : 'border-gray-200 hover:border-indigo-300 dark:border-gray-700 dark:hover:border-indigo-600'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <LinkedAccountIcon provider={a.provider} />
                        <span className="text-sm font-medium capitalize">{a.provider}</span>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-gray-500 dark:text-gray-400">{accountLabel(a)}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {source === 'linked' && selectedAccount && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-3 text-sm font-semibold">Choose a repository</h3>
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              Remote repository listing will appear here once the provider API is connected. Search is ready for when
              results load.
            </p>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
              <Input
                value={repoSearch}
                onChange={(e) => setRepoSearch(e.target.value)}
                placeholder={`Search repos in ${accountLabel(selectedAccount)}…`}
                className="bg-gray-50 pl-9 dark:bg-gray-900/50"
              />
            </div>
            <div className="rounded-md border border-dashed border-gray-200 py-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
              No repositories loaded yet.
            </div>
          </div>
        )}

        {source === 'public_url' && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-3 text-sm font-semibold">Public clone URL</h3>
            <Label htmlFor="clone-url" className="text-xs text-gray-500 dark:text-gray-400">
              HTTPS URL
            </Label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                id="clone-url"
                value={publicCloneUrl}
                onChange={(e) => setPublicCloneUrl(e.target.value)}
                placeholder="https://github.com/org/public-repo.git"
                className="min-w-0 flex-1 font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="default"
                className="shrink-0"
                disabled={urlTestLoading || !publicCloneUrl.trim()}
                onClick={() => void handleTestPublicUrl()}
              >
                {urlTestLoading ? 'Testing…' : 'Test'}
              </Button>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Must be reachable without credentials. Private repositories require a linked account instead.
            </p>
            {urlTestResult ? (
              <p
                className={cn(
                  'mt-2 text-sm',
                  urlTestResult.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                )}
              >
                {urlTestResult.message}
              </p>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/ade/dashboard/repositories"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Cancel
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/ade/dashboard/repositories" className={cn(buttonVariants({ variant: 'outline', size: 'default' }))}>
              Back
            </Link>
            <Button
              type="button"
              size="sm"
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"
              disabled={!canContinue || submitting}
              onClick={() => void handleContinue()}
            >
              Continue
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
