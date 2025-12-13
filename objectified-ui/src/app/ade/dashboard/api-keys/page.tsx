'use client';

import { useSession } from 'next-auth/react';
import { getApiKeysForTenant, createApiKey, deleteApiKey, toggleApiKeyStatus } from '../../../../../lib/db/helper';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Key, Copy, Check, AlertCircle } from 'lucide-react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { useDialog } from '../../../components/providers/DialogProvider';

interface ApiKey {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  key_prefix: string;
  last_used_at: string | null;
  expires_at: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

const ApiKeys = () => {
  const { data: session } = useSession();
  const { confirm: confirmDialog } = useDialog();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState('');
  const [newApiKeyDescription, setNewApiKeyDescription] = useState('');
  const [newApiKeyExpiry, setNewApiKeyExpiry] = useState('');
  const [generatedApiKey, setGeneratedApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  const currentTenantId = (session?.user as any)?.current_tenant_id;

  useEffect(() => {
    if (currentTenantId) {
      loadApiKeys();
    }
  }, [currentTenantId]);

  const loadApiKeys = async () => {
    if (!currentTenantId) return;

    const result = await getApiKeysForTenant(currentTenantId);
    setApiKeys(JSON.parse(result));
  };

  const handleCreateApiKey = () => {
    setNewApiKeyName('');
    setNewApiKeyDescription('');
    setNewApiKeyExpiry('');
    setErrorMessage('');
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async () => {
    if (!newApiKeyName.trim()) {
      setErrorMessage('API key name is required');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const expiresInDays = newApiKeyExpiry ? parseInt(newApiKeyExpiry) : null;
      const result = await createApiKey(
        currentTenantId,
        newApiKeyName,
        newApiKeyDescription,
        expiresInDays
      );

      const response = JSON.parse(result);

      if (response.success) {
        setGeneratedApiKey(response.apiKey);
        setShowCreateModal(false);
        setShowApiKeyModal(true);
        await loadApiKeys();
      } else {
        setErrorMessage(response.error || 'Failed to create API key');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to create API key');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = async (apiKey: ApiKey) => {
    const confirmed = await confirmDialog({
      title: 'Delete API Key',
      message: `Are you sure you want to delete the API key "${apiKey.name}"? This action cannot be undone and will immediately revoke access for any applications using this key.`,
      variant: 'danger',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) return;

    try {
      const result = await deleteApiKey(apiKey.id);
      const response = JSON.parse(result);

      if (response.success) {
        await loadApiKeys();
      } else {
        console.error('Failed to delete API key:', response.error);
      }
    } catch (error: any) {
      console.error('Failed to delete API key:', error.message);
    }
  };

  const handleToggleStatus = async (apiKey: ApiKey, nextEnabledParam?: boolean) => {
    try {
      const nextEnabled = typeof nextEnabledParam === 'boolean' ? nextEnabledParam : !apiKey.enabled;

      // If disabling, ask for confirmation first
      if (!nextEnabled) {
        const confirmed = await confirmDialog({
          title: 'Disable API Key',
          message: `Are you sure you want to disable "${apiKey.name}"? This will immediately block all requests using this key.`,
          variant: 'warning',
          confirmLabel: 'Disable',
          cancelLabel: 'Cancel',
        });
        if (!confirmed) {
          // Force a re-render to keep the switch in sync with current value
          setApiKeys((prev) => prev.slice());
          return;
        }
      }

      const result = await toggleApiKeyStatus(apiKey.id, nextEnabled);
      const response = JSON.parse(result);

      if (response.success) {
        await loadApiKeys();
      }
    } catch (error) {
      console.error('Failed to toggle API key status:', error);
    }
  };

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(generatedApiKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch (error) {
      console.error('Failed to copy API key:', error);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (!currentTenantId) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="relative">
          {/* Decorative background */}
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-gradient-to-br from-amber-100 to-yellow-100 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-full blur-3xl opacity-60" />

          <div className="relative bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/25 flex-shrink-0">
                <AlertCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-amber-900 dark:text-amber-100 mb-2">
                  No Tenant Selected
                </h2>
                <p className="text-amber-800 dark:text-amber-200 mb-4">
                  Please select a tenant before managing API Keys. API Keys are associated with a specific tenant.
                </p>
                <a
                  href="/ade/dashboard/tenants"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40"
                >
                  Go to Tenants
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
            <Key className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">API Keys</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Manage API keys for external REST API access to your tenant data
            </p>
          </div>
        </div>
        <button
          onClick={handleCreateApiKey}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-2.5 px-5 rounded-xl cursor-pointer transition-all duration-200 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5"
        >
          <Plus className="h-5 w-5" />
          Create API Key
        </button>
      </div>

      {/* API Keys List */}
      <div className="space-y-4">
        {apiKeys.length === 0 ? (
          <div className="relative">
            {/* Decorative background */}
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20 rounded-full blur-3xl opacity-60" />
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-gradient-to-br from-orange-100 to-yellow-100 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-full blur-3xl opacity-60" />

            <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-16 text-center shadow-xl">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Key className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                No API Keys Yet
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                Create your first API key to access your tenant data via REST API using the &quot;Create API Key&quot; button above
              </p>
            </div>
          </div>
        ) : (
          apiKeys.map((apiKey) => (
            <Card
              key={apiKey.id}
              sx={{
                borderRadius: 3,
                border: '1px solid',
                borderColor: isExpired(apiKey.expires_at) ? 'rgba(239, 68, 68, 0.3)' : 'rgba(0, 0, 0, 0.06)',
                boxShadow: 'none',
                transition: 'all 0.2s ease',
                background: isExpired(apiKey.expires_at)
                  ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.03) 0%, rgba(249, 115, 22, 0.03) 100%)'
                  : !apiKey.enabled
                    ? 'rgba(148, 163, 184, 0.05)'
                    : 'white',
                '&:hover': {
                  borderColor: 'rgba(245, 158, 11, 0.3)',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.1)',
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center">
                        <Key size={20} className="text-amber-600 dark:text-amber-400" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">{apiKey.name}</h3>
                      {isExpired(apiKey.expires_at) && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-50 text-red-700 border border-red-200">
                          <AlertCircle size={12} />
                          Expired
                        </span>
                      )}
                      {!apiKey.enabled && !isExpired(apiKey.expires_at) && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 text-gray-600 border border-gray-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                          Disabled
                        </span>
                      )}
                      {apiKey.enabled && !isExpired(apiKey.expires_at) && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Active
                        </span>
                      )}
                    </div>

                    {apiKey.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 ml-13">{apiKey.description}</p>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-sm ml-13">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Key Prefix:</span>
                        <span className="font-mono bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-lg text-gray-900 dark:text-gray-100 text-xs">
                          {apiKey.key_prefix}...
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Last Used:</span>
                        <span className="text-gray-600 dark:text-gray-300">{formatDate(apiKey.last_used_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Created:</span>
                        <span className="text-gray-600 dark:text-gray-300">{formatDate(apiKey.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Expires:</span>
                        <span className={isExpired(apiKey.expires_at) ? 'text-red-600 font-semibold' : 'text-gray-600 dark:text-gray-300'}>
                          {apiKey.expires_at ? formatDate(apiKey.expires_at) : 'Never'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 ml-4">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={apiKey.enabled}
                          onChange={(_, checked) => handleToggleStatus(apiKey, checked)}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: '#10b981',
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: '#10b981',
                            },
                          }}
                        />
                      }
                      label={
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          {apiKey.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      }
                    />
                    <Tooltip title="Delete API Key">
                      <IconButton
                        onClick={() => handleDeleteClick(apiKey)}
                        sx={{
                          '&:hover': {
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          },
                        }}
                      >
                        <Trash2 size={18} className="text-gray-400 hover:text-red-500 transition-colors" />
                      </IconButton>
                    </Tooltip>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create API Key Modal */}
      <Dialog
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
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
          borderColor: 'rgba(245, 158, 11, 0.1)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              p: 1.5,
              borderRadius: 2,
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(249, 115, 22, 0.1) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Key size={20} color="#f59e0b" />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
              Create API Key
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {errorMessage}
            </Alert>
          )}

          <TextField
            autoFocus
            margin="dense"
            label="Name"
            type="text"
            fullWidth
            required
            value={newApiKeyName}
            onChange={(e) => setNewApiKeyName(e.target.value)}
            helperText="A descriptive name for this API key"
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

          <TextField
            margin="dense"
            label="Description"
            type="text"
            fullWidth
            multiline
            rows={3}
            value={newApiKeyDescription}
            onChange={(e) => setNewApiKeyDescription(e.target.value)}
            helperText="Optional description of what this key is used for"
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

          <TextField
            margin="dense"
            label="Expires In (Days)"
            type="number"
            fullWidth
            value={newApiKeyExpiry}
            onChange={(e) => setNewApiKeyExpiry(e.target.value)}
            helperText="Leave empty for no expiration"
            slotProps={{
              htmlInput: { min: 1 }
            }}
            sx={{
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
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'rgba(0, 0, 0, 0.06)' }}>
          <Button
            onClick={() => setShowCreateModal(false)}
            disabled={isLoading}
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
            onClick={handleCreateSubmit}
            variant="contained"
            disabled={isLoading}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)',
              '&:hover': {
                background: 'linear-gradient(135deg, #d97706 0%, #ea580c 100%)',
                boxShadow: '0 6px 16px rgba(245, 158, 11, 0.35)',
              },
            }}
          >
            {isLoading ? 'Creating...' : 'Create API Key'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Show Generated API Key Modal */}
      <Dialog
        open={showApiKeyModal}
        onClose={() => {
          setShowApiKeyModal(false);
          setGeneratedApiKey('');
          setCopiedKey(false);
        }}
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
          borderColor: 'rgba(16, 185, 129, 0.1)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              p: 1.5,
              borderRadius: 2,
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(20, 184, 166, 0.1) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Check size={20} color="#10b981" />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
              API Key Created Successfully
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Alert
            severity="warning"
            sx={{
              mb: 3,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'warning.light',
            }}
          >
            <strong>Important:</strong> This is the only time you&apos;ll see this API key. Please copy it now and store it securely.
          </Alert>

          <Box sx={{
            p: 3,
            borderRadius: 3,
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(249, 115, 22, 0.05) 100%)',
            border: '1px solid',
            borderColor: 'rgba(245, 158, 11, 0.2)',
          }}>
            <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600, mb: 1.5, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Your API Key:
            </Typography>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 font-mono text-sm break-all text-gray-900 dark:text-gray-100 shadow-inner">
                {generatedApiKey}
              </code>
              <Tooltip title={copiedKey ? 'Copied!' : 'Copy to clipboard'}>
                <IconButton
                  onClick={handleCopyKey}
                  sx={{
                    bgcolor: copiedKey ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                    '&:hover': {
                      bgcolor: copiedKey ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    },
                  }}
                >
                  {copiedKey ? <Check size={20} className="text-emerald-600" /> : <Copy size={20} className="text-amber-600" />}
                </IconButton>
              </Tooltip>
            </div>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'rgba(0, 0, 0, 0.06)' }}>
          <Button
            onClick={() => {
              setShowApiKeyModal(false);
              setGeneratedApiKey('');
              setCopiedKey(false);
            }}
            variant="contained"
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              px: 4,
              background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
              '&:hover': {
                background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
                boxShadow: '0 6px 16px rgba(16, 185, 129, 0.35)',
              },
            }}
          >
            I&apos;ve Saved My Key
          </Button>
        </DialogActions>
      </Dialog>

    </div>
  );
};

export default ApiKeys;

