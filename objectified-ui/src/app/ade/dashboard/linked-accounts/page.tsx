'use client';

import { useSession, signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Link as LinkIcon, Github, GitBranch, Cloud, Check } from 'lucide-react';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { useDialog } from '../../../components/providers/DialogProvider';
import { getLinkedAccountsForUser, unlinkExternalAccount } from '../../../../../lib/db/helper';

interface LinkedAccount {
  id: string;
  provider: string;
  provider_user_id: string;
  provider_email: string;
  provider_username: string | null;
  created_at: string;
  last_login_at: string | null;
}

interface ProviderConfig {
  name: string;
  displayName: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  available: boolean;
}

const providerConfigs: Record<string, ProviderConfig> = {
  github: {
    name: 'github',
    displayName: 'GitHub',
    icon: Github,
    color: '#24292e',
    available: true,
  },
  gitlab: {
    name: 'gitlab',
    displayName: 'GitLab',
    icon: GitBranch,
    color: '#fc6d26',
    available: false,
  },
  google: {
    name: 'google',
    displayName: 'Google / GCP',
    icon: Cloud,
    color: '#4285f4',
    available: false,
  },
  aws: {
    name: 'aws',
    displayName: 'AWS',
    icon: Cloud,
    color: '#ff9900',
    available: false,
  },
};

const LinkedAccounts = () => {
  const { data: session } = useSession();
  const { confirm: confirmDialog } = useDialog();
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const userId = (session?.user as any)?.user_id;

  useEffect(() => {
    if (userId) {
      loadLinkedAccounts();

      // Check if we're returning from an OAuth flow
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('linked') === 'true') {
        setSuccessMessage('Account linked successfully!');
        // Clean up URL
        window.history.replaceState({}, '', '/ade/dashboard/linked-accounts');
      } else if (urlParams.get('error')) {
        setErrorMessage(urlParams.get('error') || 'Failed to link account');
        // Clean up URL
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
      console.log(`[handleLinkAccount] Setting linking intent for ${provider}`);

      // First, set the linking intent cookie via API call
      const response = await fetch(`/api/auth/link/${provider}`, {
        method: 'GET',
        credentials: 'include', // Important: include cookies
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        setErrorMessage(`Failed to initiate account linking: ${error.error || 'Unknown error'}`);
        return;
      }

      const data = await response.json();
      console.log(`[handleLinkAccount] Cookie set successfully, triggering OAuth for ${provider}`, data);

      // Then trigger the OAuth flow using NextAuth's signIn
      // This will redirect to GitHub OAuth
      signIn(provider, {
        callbackUrl: '/ade/dashboard/linked-accounts',
      });
    } catch (error) {
      console.error('[handleLinkAccount] Error linking account:', error);
      setErrorMessage('An error occurred while linking the account');
    }
  };

  const handleUnlinkAccount = async (account: LinkedAccount) => {
    const providerConfig = providerConfigs[account.provider];
    const confirmed = await confirmDialog({
      title: `Unlink ${providerConfig?.displayName || account.provider} Account`,
      message: `Are you sure you want to unlink your ${providerConfig?.displayName || account.provider} account (${account.provider_username || account.provider_email})? You will no longer be able to sign in using this provider.`,
    });

    if (!confirmed) return;

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const result = await unlinkExternalAccount(userId, account.id);
      const response = JSON.parse(result);

      if (response.success) {
        setSuccessMessage(
          `Successfully unlinked ${providerConfig?.displayName || account.provider} account`
        );
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

  const getProviderIcon = (provider: string) => {
    const config = providerConfigs[provider];
    if (!config) return LinkIcon;
    return config.icon;
  };

  const getProviderDisplayName = (provider: string) => {
    const config = providerConfigs[provider];
    return config?.displayName || provider.charAt(0).toUpperCase() + provider.slice(1);
  };

  const isProviderLinked = (provider: string) => {
    return linkedAccounts.some((account) => account.provider === provider);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!session) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Linked Accounts</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Link external accounts to enable single sign-on (SSO) authentication
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      )}

      {/* Error Message */}
      {errorMessage && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setErrorMessage('')}>
          {errorMessage}
        </Alert>
      )}

      {/* Linked Accounts List */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          Your Linked Accounts
        </Typography>

        {linkedAccounts.length === 0 ? (
          <Card>
            <CardContent>
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <LinkIcon size={48} className="mx-auto mb-3 text-gray-400" />
                <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                  No linked accounts
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Link an external account below to enable SSO authentication
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {linkedAccounts.map((account) => {
              const Icon = getProviderIcon(account.provider);
              const displayName = getProviderDisplayName(account.provider);

              return (
                <Card key={account.id}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'action.hover',
                          }}
                        >
                          <Icon size={24} />
                        </Box>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                            {displayName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {account.provider_username || account.provider_email}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            <Chip
                              label={`Linked ${formatDate(account.created_at)}`}
                              size="small"
                              variant="outlined"
                            />
                            {account.last_login_at && (
                              <Chip
                                label={`Last login: ${formatDate(account.last_login_at)}`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </Box>
                      </Box>
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<Trash2 size={16} />}
                        onClick={() => handleUnlinkAccount(account)}
                        disabled={isLoading}
                      >
                        Unlink
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </Box>

      {/* Available Providers */}
      <Box>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          Available Providers
        </Typography>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.values(providerConfigs).map((provider) => {
            const Icon = provider.icon;
            const isLinked = isProviderLinked(provider.name);
            const isAvailable = provider.available;

            return (
              <Card
                key={provider.name}
                sx={{
                  opacity: !isAvailable ? 0.6 : 1,
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: 'action.hover',
                        }}
                      >
                        <Icon size={20} />
                      </Box>
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {provider.displayName}
                        </Typography>
                        {!isAvailable && (
                          <Typography variant="caption" color="text.secondary">
                            Coming soon
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    {isLinked ? (
                      <Chip
                        icon={<Check size={16} />}
                        label="Linked"
                        color="success"
                        size="small"
                      />
                    ) : (
                      <Button
                        variant="outlined"
                        startIcon={<Plus size={16} />}
                        onClick={() => handleLinkAccount(provider.name)}
                        disabled={isLoading || !isAvailable}
                      >
                        Link
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Info Alert */}
        <Alert severity="info" sx={{ mt: 3 }}>
          <Typography variant="body2">
            <strong>Note:</strong> You can link multiple provider accounts to your Objectified account.
            Once linked, you can sign in using any of these providers. Your primary email and account
            data will always be tied to your main Objectified account.
          </Typography>
        </Alert>
      </Box>
    </div>
  );
};

export default LinkedAccounts;

