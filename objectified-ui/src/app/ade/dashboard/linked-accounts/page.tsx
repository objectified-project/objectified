'use client';

import { useSession, signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Link as LinkIcon, Check, Key } from 'lucide-react';
import { SiGithub, SiGitlab, SiGoogle, SiAmazon } from 'react-icons/si';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
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
  github: {
    name: 'github',
    displayName: 'GitHub',
    icon: SiGithub,
    color: '#24292e',
    available: true,
  },
  gitlab: {
    name: 'gitlab',
    displayName: 'GitLab',
    icon: SiGitlab,
    color: '#fc6d26',
    available: true,
  },
  google: {
    name: 'google',
    displayName: 'Google / GCP',
    icon: SiGoogle,
    color: '#4285f4',
    available: false,
  },
  aws: {
    name: 'aws',
    displayName: 'AWS',
    icon: SiAmazon,
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
  const [patDialogOpen, setPatDialogOpen] = useState(false);
  const [patProvider, setPatProvider] = useState<string>('');
  const [patToken, setPatToken] = useState('');
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

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
      // Always updating existing account - PAT is added to OAuth-linked account
      const result = await updatePersonalAccessToken(userId, editingAccountId, patToken);
      const response = JSON.parse(result);

      if (response.success) {
        setSuccessMessage(
          `Successfully ${linkedAccounts.find(a => a.id === editingAccountId)?.access_token ? 'updated' : 'added'} Personal Access Token for ${providerConfigs[patProvider]?.displayName || patProvider}`
        );
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
      message: `Are you sure you want to remove the Personal Access Token for your ${providerConfig?.displayName || provider} account (${account?.provider_username || account?.provider_email})?\n\nYou will lose direct repository access until you add a new PAT with the same repository access permissions.`,
    });

    if (!confirmed) return;

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const result = await removePersonalAccessToken(userId, accountId);
      const response = JSON.parse(result);

      if (response.success) {
        setSuccessMessage(
          `Successfully removed Personal Access Token for ${providerConfig?.displayName || provider}`
        );
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
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
          <LinkIcon className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Linked Accounts</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Link external accounts to enable single sign-on (SSO) authentication
          </p>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <Alert
          severity="success"
          sx={{
            mb: 3,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'success.light',
            '& .MuiAlert-icon': { alignItems: 'center' },
          }}
          onClose={() => setSuccessMessage('')}
        >
          {successMessage}
        </Alert>
      )}

      {/* Error Message */}
      {errorMessage && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'error.light',
            '& .MuiAlert-icon': { alignItems: 'center' },
          }}
          onClose={() => setErrorMessage('')}
        >
          {errorMessage}
        </Alert>
      )}

      {/* Linked Accounts List */}
      <Box sx={{ mb: 5 }}>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          mb: 3,
          pb: 2,
          borderBottom: '1px solid',
          borderColor: 'rgba(99, 102, 241, 0.1)',
        }}>
          <Box sx={{
            p: 1,
            borderRadius: 2,
            bgcolor: 'rgba(99, 102, 241, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Check size={18} color="#6366f1" />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
            Your Linked Accounts
          </Typography>
        </Box>

        {linkedAccounts.length === 0 ? (
          <Card sx={{
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'rgba(0, 0, 0, 0.06)',
            boxShadow: 'none',
          }}>
            <CardContent>
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Box sx={{
                  width: 64,
                  height: 64,
                  borderRadius: 3,
                  bgcolor: 'rgba(99, 102, 241, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                }}>
                  <LinkIcon size={32} color="#6366f1" />
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#334155', mb: 0.5 }}>
                  No linked accounts
                </Typography>
                <Typography variant="body2" sx={{ color: '#94a3b8' }}>
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
                <Card
                  key={account.id}
                  sx={{
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'rgba(0, 0, 0, 0.06)',
                    boxShadow: 'none',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: 'rgba(99, 102, 241, 0.3)',
                      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.1)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
                        <Box
                          sx={{
                            width: 56,
                            height: 56,
                            borderRadius: 3,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: `linear-gradient(135deg, ${providerConfigs[account.provider]?.color}15 0%, ${providerConfigs[account.provider]?.color}25 100%)`,
                            border: '1px solid',
                            borderColor: `${providerConfigs[account.provider]?.color}30`,
                          }}
                        >
                          <Icon size={28} color={providerConfigs[account.provider]?.color || 'inherit'} />
                        </Box>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.25 }}>
                            {displayName}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                            {account.provider_username || account.provider_email}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                            <Chip
                              label={`Linked ${formatDate(account.created_at)}`}
                              size="small"
                              sx={{
                                height: 24,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                bgcolor: 'rgba(99, 102, 241, 0.1)',
                                color: '#6366f1',
                                border: 'none',
                              }}
                            />
                            {account.last_login_at && (
                              <Chip
                                label={`Last login: ${formatDate(account.last_login_at)}`}
                                size="small"
                                sx={{
                                  height: 24,
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  bgcolor: 'rgba(16, 185, 129, 0.1)',
                                  color: '#10b981',
                                  border: 'none',
                                }}
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
                        sx={{
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 600,
                          px: 2.5,
                          borderColor: 'rgba(239, 68, 68, 0.3)',
                          '&:hover': {
                            borderColor: 'error.main',
                            bgcolor: 'rgba(239, 68, 68, 0.05)',
                          },
                        }}
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
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          mb: 3,
          pb: 2,
          borderBottom: '1px solid',
          borderColor: 'rgba(99, 102, 241, 0.1)',
        }}>
          <Box sx={{
            p: 1,
            borderRadius: 2,
            bgcolor: 'rgba(139, 92, 246, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Plus size={18} color="#8b5cf6" />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
            Available Providers
          </Typography>
        </Box>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.values(providerConfigs).map((provider) => {
            const Icon = provider.icon;
            const isLinked = isProviderLinked(provider.name);
            const isAvailable = provider.available;
            const linkedAccount = linkedAccounts.find(a => a.provider === provider.name);
            const hasPAT = !!linkedAccount?.access_token;

            return (
              <Card
                key={provider.name}
                sx={{
                  opacity: !isAvailable ? 0.6 : 1,
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: isLinked ? 'rgba(16, 185, 129, 0.3)' : 'rgba(0, 0, 0, 0.06)',
                  boxShadow: 'none',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: isLinked
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.03) 0%, rgba(6, 182, 212, 0.03) 100%)'
                    : 'white',
                  '&:hover': {
                    transform: isAvailable ? 'translateY(-2px)' : 'none',
                    boxShadow: isAvailable ? `0 8px 24px ${provider.color}15` : 'none',
                    borderColor: isAvailable ? `${provider.color}40` : 'rgba(0, 0, 0, 0.06)',
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: (provider.name === 'github' || provider.name === 'gitlab') && isAvailable && isLinked ? 2 : 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 2.5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: `linear-gradient(135deg, ${provider.color}10 0%, ${provider.color}20 100%)`,
                          border: '1px solid',
                          borderColor: `${provider.color}25`,
                        }}
                      >
                        <Icon size={24} color={provider.color} />
                      </Box>
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 700, color: '#1e293b' }}>
                          {provider.displayName}
                        </Typography>
                        {!isAvailable && (
                          <Chip
                            label="Coming soon"
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              bgcolor: 'rgba(148, 163, 184, 0.15)',
                              color: '#64748b',
                              border: 'none',
                              mt: 0.5,
                            }}
                          />
                        )}
                        {hasPAT && (
                          <Chip
                            icon={<Key size={12} />}
                            label="PAT Active"
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              bgcolor: 'rgba(245, 158, 11, 0.1)',
                              color: '#f59e0b',
                              border: 'none',
                              mt: 0.5,
                              '& .MuiChip-icon': {
                                color: '#f59e0b',
                              },
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                    {isLinked ? (
                      <Chip
                        icon={<Check size={14} />}
                        label="Linked"
                        size="small"
                        sx={{
                          height: 28,
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          bgcolor: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          border: 'none',
                          '& .MuiChip-icon': {
                            color: '#10b981',
                          },
                        }}
                      />
                    ) : (
                      <Button
                        variant="outlined"
                        startIcon={<Plus size={16} />}
                        onClick={() => handleLinkAccount(provider.name)}
                        disabled={isLoading || !isAvailable}
                        sx={{
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 600,
                          px: 2.5,
                          borderColor: `${provider.color}40`,
                          color: provider.color,
                          '&:hover': {
                            borderColor: provider.color,
                            bgcolor: `${provider.color}08`,
                          },
                        }}
                      >
                        Link
                      </Button>
                    )}
                  </Box>

                  {/* Personal Access Token Section (GitHub and GitLab) - Only shown if account is linked */}
                  {(provider.name === 'github' || provider.name === 'gitlab') && isAvailable && isLinked && (
                    <Box sx={{
                      mt: 2,
                      pt: 2,
                      borderTop: '1px solid',
                      borderColor: 'rgba(99, 102, 241, 0.1)',
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.75, color: '#334155' }}>
                          <Key size={14} color="#f59e0b" />
                          Personal Access Token
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Key size={14} />}
                            onClick={() => handleOpenPatDialog(provider.name, linkedAccount?.id)}
                            disabled={isLoading}
                            sx={{
                              borderRadius: 2,
                              textTransform: 'none',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                              borderColor: 'rgba(245, 158, 11, 0.3)',
                              color: '#f59e0b',
                              '&:hover': {
                                borderColor: '#f59e0b',
                                bgcolor: 'rgba(245, 158, 11, 0.05)',
                              },
                            }}
                          >
                            {linkedAccount?.access_token ? 'Update' : 'Add'} PAT
                          </Button>
                          {linkedAccount?.access_token && (
                            <Button
                              variant="outlined"
                              color="error"
                              size="small"
                              startIcon={<Trash2 size={14} />}
                              onClick={() => handleRemovePatToken(provider.name, linkedAccount.id)}
                              disabled={isLoading}
                              sx={{
                                borderRadius: 2,
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: '0.75rem',
                                borderColor: 'rgba(239, 68, 68, 0.3)',
                                '&:hover': {
                                  borderColor: 'error.main',
                                  bgcolor: 'rgba(239, 68, 68, 0.05)',
                                },
                              }}
                            >
                              Remove
                            </Button>
                          )}
                        </Box>
                      </Box>
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                        {linkedAccount?.access_token
                          ? 'PAT configured for direct repository access'
                          : 'Add a PAT for direct repository access'}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Info Alert */}
        <Alert
          severity="info"
          sx={{
            mt: 4,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'info.light',
            bgcolor: 'rgba(6, 182, 212, 0.05)',
          }}
        >
          <Typography variant="body2" sx={{ color: '#334155' }}>
            <strong>Note:</strong> You can link multiple provider accounts to your Objectified account.
            Once linked, you can sign in using any of these providers. Your primary email and account
            data will always be tied to your main Objectified account.
          </Typography>
        </Alert>
      </Box>

      {/* Personal Access Token Dialog */}
      <Dialog
        open={patDialogOpen}
        onClose={handleClosePatDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          },
        }}
      >
        <DialogTitle sx={{
          pb: 1,
          borderBottom: '1px solid',
          borderColor: 'rgba(99, 102, 241, 0.1)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              p: 1.5,
              borderRadius: 2,
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(251, 191, 36, 0.1) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Key size={20} color="#f59e0b" />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
                {linkedAccounts.find(a => a.id === editingAccountId)?.access_token ? 'Update' : 'Add'} Personal Access Token
              </Typography>
              {patProvider && (
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  {providerConfigs[patProvider]?.displayName} • {linkedAccounts.find(a => a.id === editingAccountId)?.provider_username || linkedAccounts.find(a => a.id === editingAccountId)?.provider_email}
                </Typography>
              )}
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <TextField
            autoFocus
            margin="dense"
            label="Personal Access Token"
            type="password"
            fullWidth
            variant="outlined"
            value={patToken}
            onChange={(e) => setPatToken(e.target.value)}
            helperText={`The token used to authenticate with ${providerConfigs[patProvider]?.displayName || 'the provider'}'s API`}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#f59e0b',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#f59e0b',
                },
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: '#f59e0b',
              },
            }}
          />

          {/* Provider-specific instructions */}
          {patProvider === 'github' && (
            <Alert
              severity="info"
              sx={{
                mt: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'info.light',
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 500 }}>
                <strong>Required GitHub scopes:</strong> repo (or public_repo), read:org, read:user, user:email
              </Typography>
            </Alert>
          )}
          {patProvider === 'gitlab' && (
            <Alert
              severity="info"
              sx={{
                mt: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'info.light',
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 500 }}>
                <strong>Required GitLab scopes:</strong> read_api, read_repository, read_user
              </Typography>
            </Alert>
          )}

          {errorMessage && (
            <Alert
              severity="error"
              sx={{
                mt: 2,
                borderRadius: 2,
              }}
            >
              {errorMessage}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'rgba(0, 0, 0, 0.06)' }}>
          <Button
            onClick={handleClosePatDialog}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              color: '#64748b',
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSavePatToken}
            variant="contained"
            disabled={isLoading}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)',
              '&:hover': {
                background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
                boxShadow: '0 6px 16px rgba(245, 158, 11, 0.35)',
              },
            }}
          >
            {linkedAccounts.find(a => a.id === editingAccountId)?.access_token ? 'Update Token' : 'Add Token'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default LinkedAccounts;

