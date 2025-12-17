'use client';

import { useSession, signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Link as LinkIcon, Check, Key } from 'lucide-react';
import { SiGithub, SiGitlab, SiGoogle, SiAmazon } from 'react-icons/si';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Label } from '../../../components/ui/Label';
import { Alert } from '../../../components/ui/Alert';
import { Card, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { cn } from '../../../../../lib/utils';
import { useDialog } from '@/app/components/providers/DialogProvider';
import { getLinkedAccountsForUser, unlinkExternalAccount, updatePersonalAccessToken, removePersonalAccessToken } from '../../../../../lib/db/helper';

interface LinkedAccount {
  id: string;
  provider: string;
  provider_user_id: string;
  provider_email: string;
  provider_username: string | null;
  access_token?: string | null;
  created_at: string;
  last_login_at: string | null;
}

interface ProviderConfig {
  name: string;
  displayName: string;
  icon: React.ComponentType<any>;
  color: string;
  available: boolean;
}

const providerConfigs: Record<string, ProviderConfig> = {
  github: { name: 'github', displayName: 'GitHub', icon: SiGithub, color: '#24292e', available: true },
  gitlab: { name: 'gitlab', displayName: 'GitLab', icon: SiGitlab, color: '#fc6d26', available: true },
  google: { name: 'google', displayName: 'Google / GCP', icon: SiGoogle, color: '#4285f4', available: false },
  aws: { name: 'aws', displayName: 'AWS', icon: SiAmazon, color: '#ff9900', available: false },
};

const LinkedAccounts = () => {
  const { data: session } = useSession();
  const { confirm: confirmDialog } = useDialog();
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [patDialogOpen, setPatDialogOpen] = useState(false);
  const [patProvider, setPatProvider] = useState<string>('');
  const [patToken, setPatToken] = useState('');
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

  const userId = (session?.user as any)?.user_id;

  useEffect(() => {
    if (userId) {
      loadLinkedAccounts();
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('linked') === 'true') {
        setSuccessMessage('Account linked successfully!');
        window.history.replaceState({}, '', '/ade/dashboard/linked-accounts');
      } else if (urlParams.get('error')) {
        setErrorMessage(urlParams.get('error') || 'Failed to link account');
        window.history.replaceState({}, '', '/ade/dashboard/linked-accounts');
      }
    }
  }, [userId]);

  const loadLinkedAccounts = async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const result = await getLinkedAccountsForUser(userId);
      setLinkedAccounts(JSON.parse(result));
    } catch (error: any) {
      setErrorMessage('Failed to load linked accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkAccount = async (provider: string) => {
    try {
      const response = await fetch(`/api/auth/link/${provider}`, { method: 'GET', credentials: 'include' });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        setErrorMessage(`Failed to initiate account linking: ${error.error || 'Unknown error'}`);
        return;
      }
      signIn(provider, { callbackUrl: '/ade/dashboard/linked-accounts' });
    } catch (error) {
      setErrorMessage('An error occurred while linking the account');
    }
  };

  const handleUnlinkAccount = async (account: LinkedAccount) => {
    const providerConfig = providerConfigs[account.provider];
    const confirmed = await confirmDialog({
      title: `Unlink ${providerConfig?.displayName || account.provider} Account`,
      message: `Are you sure you want to unlink your ${providerConfig?.displayName || account.provider} account (${account.provider_username || account.provider_email})?`,
    });
    if (!confirmed) return;

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const result = await unlinkExternalAccount(userId, account.id);
      const response = JSON.parse(result);
      if (response.success) {
        setSuccessMessage(`Successfully unlinked ${providerConfig?.displayName || account.provider} account`);
        await loadLinkedAccounts();
      } else {
        setErrorMessage(response.error || 'Failed to unlink account');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'An error occurred while unlinking the account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenPatDialog = (provider: string, accountId?: string) => {
    setPatProvider(provider);
    setEditingAccountId(accountId || null);
    setPatToken('');
    setErrorMessage('');
    setPatDialogOpen(true);
  };

  const handleClosePatDialog = () => {
    setPatDialogOpen(false);
    setPatProvider('');
    setPatToken('');
    setEditingAccountId(null);
  };

  const handleSavePatToken = async () => {
    if (!patToken.trim()) {
      setErrorMessage('Personal Access Token is required');
      return;
    }
    if (!editingAccountId) {
      setErrorMessage('No linked account found. Please link your account first.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const result = await updatePersonalAccessToken(userId, editingAccountId, patToken);
      const response = JSON.parse(result);
      if (response.success) {
        setSuccessMessage(`Successfully ${linkedAccounts.find(a => a.id === editingAccountId)?.access_token ? 'updated' : 'added'} Personal Access Token`);
        await loadLinkedAccounts();
        handleClosePatDialog();
      } else {
        setErrorMessage(response.error || 'Failed to save Personal Access Token');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'An error occurred while saving the Personal Access Token');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemovePatToken = async (provider: string, accountId: string) => {
    const providerConfig = providerConfigs[provider];
    const account = linkedAccounts.find(a => a.id === accountId);

    const confirmed = await confirmDialog({
      title: `Remove Personal Access Token`,
      message: `Are you sure you want to remove the Personal Access Token for your ${providerConfig?.displayName || provider} account (${account?.provider_username || account?.provider_email})?`,
    });
    if (!confirmed) return;

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const result = await removePersonalAccessToken(userId, accountId);
      const response = JSON.parse(result);
      if (response.success) {
        setSuccessMessage(`Successfully removed Personal Access Token for ${providerConfig?.displayName || provider}`);
        await loadLinkedAccounts();
      } else {
        setErrorMessage(response.error || 'Failed to remove Personal Access Token');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'An error occurred while removing the Personal Access Token');
    } finally {
      setIsLoading(false);
    }
  };

  const getProviderIcon = (provider: string) => providerConfigs[provider]?.icon || LinkIcon;
  const getProviderDisplayName = (provider: string) => providerConfigs[provider]?.displayName || provider.charAt(0).toUpperCase() + provider.slice(1);
  const isProviderLinked = (provider: string) => linkedAccounts.some((account) => account.provider === provider);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  if (!session) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <p className="text-gray-500 dark:text-gray-300">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
          <LinkIcon className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Linked Accounts</h1>
          <p className="text-gray-500 dark:text-gray-300 mt-1">Link external accounts to enable single sign-on (SSO) authentication</p>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && <Alert variant="success" className="mb-4" onClose={() => setSuccessMessage('')}>{successMessage}</Alert>}

      {/* Error Message */}
      {errorMessage && <Alert variant="error" className="mb-4" onClose={() => setErrorMessage('')}>{errorMessage}</Alert>}

      {/* Linked Accounts List */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-indigo-100 dark:border-indigo-900/30">
          <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
            <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Your Linked Accounts</h2>
        </div>

        {linkedAccounts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-4">
                <LinkIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-1">No linked accounts</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Link an external account below to enable SSO authentication</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {linkedAccounts.map((account) => {
              const Icon = getProviderIcon(account.provider);
              const displayName = getProviderDisplayName(account.provider);
              const config = providerConfigs[account.provider];

              return (
                <Card key={account.id} className="transition-all duration-200 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/10">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${config?.color}15 0%, ${config?.color}25 100%)`, border: `1px solid ${config?.color}30` }}>
                          <Icon size={28} color={config?.color} />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{displayName}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">{account.provider_username || account.provider_email}</p>
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <Badge variant="default" className="text-xs">Linked {formatDate(account.created_at)}</Badge>
                            {account.last_login_at && <Badge variant="success" className="text-xs">Last login: {formatDate(account.last_login_at)}</Badge>}
                          </div>
                        </div>
                      </div>
                      <Button variant="destructive" size="sm" onClick={() => handleUnlinkAccount(account)} disabled={isLoading}>
                        <Trash2 className="h-4 w-4" />
                        Unlink
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Available Providers */}
      <div>
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-purple-100 dark:border-purple-900/30">
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <Plus className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Available Providers</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.values(providerConfigs).map((provider) => {
            const Icon = provider.icon;
            const isLinked = isProviderLinked(provider.name);
            const isAvailable = provider.available;
            const linkedAccount = linkedAccounts.find(a => a.provider === provider.name);
            const hasPAT = !!linkedAccount?.access_token;

            return (
              <Card key={provider.name} className={cn("transition-all duration-300", !isAvailable && "opacity-60", isLinked && "border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-900/10", isAvailable && "hover:-translate-y-0.5 hover:shadow-lg")}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${provider.color}10 0%, ${provider.color}20 100%)`, border: `1px solid ${provider.color}25` }}>
                        <Icon size={24} color={provider.color} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">{provider.displayName}</p>
                        {!isAvailable && <Badge variant="secondary" className="text-xs mt-0.5">Coming soon</Badge>}
                        {hasPAT && <Badge variant="warning" className="text-xs mt-0.5"><Key className="h-3 w-3 mr-1" />PAT Active</Badge>}
                      </div>
                    </div>
                    {isLinked ? (
                      <Badge variant="success" className="text-xs font-bold"><Check className="h-3 w-3 mr-1" />Linked</Badge>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => handleLinkAccount(provider.name)} disabled={isLoading || !isAvailable}>
                        <Plus className="h-4 w-4" />Link
                      </Button>
                    )}
                  </div>

                  {/* Personal Access Token Section */}
                  {(provider.name === 'github' || provider.name === 'gitlab') && isAvailable && isLinked && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                          <Key className="h-3.5 w-3.5 text-amber-500" />Personal Access Token
                        </span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleOpenPatDialog(provider.name, linkedAccount?.id)} disabled={isLoading} className="text-xs h-7 px-2 border-amber-300 text-amber-600 hover:bg-amber-50">
                            <Key className="h-3 w-3" />{linkedAccount?.access_token ? 'Update' : 'Add'} PAT
                          </Button>
                          {linkedAccount?.access_token && (
                            <Button variant="destructive" size="sm" onClick={() => handleRemovePatToken(provider.name, linkedAccount.id)} disabled={isLoading} className="text-xs h-7 px-2">
                              <Trash2 className="h-3 w-3" />Remove
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {linkedAccount?.access_token ? 'PAT configured for direct repository access' : 'Add a PAT for direct repository access'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Info Alert */}
        <Alert variant="info" className="mt-6">
          <strong>Note:</strong> You can link multiple provider accounts to your Objectified account.
          Once linked, you can sign in using any of these providers.
        </Alert>
      </div>

      {/* Personal Access Token Dialog */}
      <Dialog open={patDialogOpen} onOpenChange={(open) => !open && handleClosePatDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30">
                <Key className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              {linkedAccounts.find(a => a.id === editingAccountId)?.access_token ? 'Update' : 'Add'} Personal Access Token
            </DialogTitle>
            <DialogDescription>
              {patProvider && `${providerConfigs[patProvider]?.displayName} • ${linkedAccounts.find(a => a.id === editingAccountId)?.provider_username || linkedAccounts.find(a => a.id === editingAccountId)?.provider_email}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="patToken">Personal Access Token</Label>
              <Input id="patToken" type="password" value={patToken} onChange={(e) => setPatToken(e.target.value)} placeholder="Enter your token" autoFocus />
              <p className="text-xs text-gray-500 dark:text-gray-400">The token used to authenticate with {providerConfigs[patProvider]?.displayName || 'the provider'}'s API</p>
            </div>

            {patProvider === 'github' && (
              <Alert variant="info">
                <strong>Required GitHub scopes:</strong> repo (or public_repo), read:org, read:user, user:email
              </Alert>
            )}
            {patProvider === 'gitlab' && (
              <Alert variant="info">
                <strong>Required GitLab scopes:</strong> read_api, read_repository, read_user
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClosePatDialog}>Cancel</Button>
            <Button onClick={handleSavePatToken} disabled={isLoading} className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600">
              {linkedAccounts.find(a => a.id === editingAccountId)?.access_token ? 'Update Token' : 'Add Token'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LinkedAccounts;

