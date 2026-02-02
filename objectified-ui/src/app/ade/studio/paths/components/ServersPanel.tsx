'use client';

import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import { Add, Delete, Edit } from '@mui/icons-material';
import { Server } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { useStudio } from '../../StudioContext';
import { useDialog } from '../../../../components/providers/DialogProvider';
import {
  getServersForVersion,
  createServer,
  updateServer,
  deleteServer,
  type VersionServerRecord,
  type VersionServerInput,
} from '../../../../../../lib/db/helper-version-servers';
import { useDarkMode } from '../../../../hooks/useDarkMode';

export default function ServersPanel({ onRefresh }: { onRefresh?: () => void }) {
  const { selectedVersionId } = useStudio();
  const { confirm: confirmDialog, alert: alertDialog } = useDialog();
  const isDark = useDarkMode();
  const [servers, setServers] = useState<VersionServerRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<VersionServerRecord | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadServers = async () => {
    if (!selectedVersionId) {
      setServers([]);
      return;
    }
    setIsLoading(true);
    try {
      const list = await getServersForVersion(selectedVersionId);
      setServers(list);
    } catch (err) {
      console.error('Error loading servers:', err);
      setServers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadServers();
  }, [selectedVersionId]);

  const resetForm = () => {
    setEditingServer(null);
    setName('');
    setUrl('');
    setDescription('');
    setFormError('');
  };

  const handleAdd = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = (server: VersionServerRecord) => {
    setEditingServer(server);
    setName(server.name ?? '');
    setUrl(server.url ?? '');
    setDescription(server.description ?? '');
    setFormError('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const urlTrim = url?.trim();
    if (!urlTrim) {
      setFormError('URL is required');
      return;
    }
    if (!selectedVersionId) return;
    setIsSaving(true);
    setFormError('');
    try {
      if (editingServer) {
        const result = await updateServer(editingServer.id, {
          name: name.trim() || undefined,
          url: urlTrim,
          description: description.trim() || undefined,
        });
        if (result.success && result.server) {
          setServers((prev) => prev.map((s) => (s.id === editingServer.id ? result.server! : s)));
          setDialogOpen(false);
          onRefresh?.();
        } else {
          setFormError(result.error ?? 'Failed to update server');
        }
      } else {
        const result = await createServer(selectedVersionId, {
          name: name.trim() || undefined,
          url: urlTrim,
          description: description.trim() || undefined,
          sort_order: servers.length,
        });
        if (result.success && result.server) {
          setServers((prev) => [...prev, result.server!]);
          setDialogOpen(false);
          onRefresh?.();
        } else {
          setFormError(result.error ?? 'Failed to create server');
        }
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (server: VersionServerRecord) => {
    const confirmed = await confirmDialog({
      title: 'Delete Server',
      message: `Delete server "${server.name || server.url}"? This will remove it from the OpenAPI spec.`,
      variant: 'danger',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;
    try {
      const result = await deleteServer(server.id);
      if (result.success) {
        setServers((prev) => prev.filter((s) => s.id !== server.id));
        onRefresh?.();
      } else {
        await alertDialog({
          title: 'Error',
          message: result.error ?? 'Failed to delete server',
          variant: 'error',
        });
      }
    } catch (err) {
      await alertDialog({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      });
    }
  };

  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
          <Server size={18} className="text-gray-600 dark:text-gray-400" />
          Servers
        </label>
        <Button
          size="small"
          startIcon={<Add />}
          onClick={handleAdd}
          disabled={!selectedVersionId}
          sx={{
            fontSize: '0.75rem',
            textTransform: 'none',
            color: '#6366f1',
            '&:hover': {
              backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)',
            },
          }}
        >
          Add
        </Button>
      </Box>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 -mt-1 mb-2">
        Define multiple server URLs (e.g. Production, Staging). Exported in the OpenAPI spec.
      </p>

      {!selectedVersionId ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Select a version to manage servers.</p>
      ) : isLoading ? (
        <span className="text-xs text-gray-500 dark:text-gray-400">Loading...</span>
      ) : servers.length === 0 ? (
        <Box
          sx={{
            py: 3,
            px: 2,
            textAlign: 'center',
            border: isDark ? '1px dashed #334155' : '1px dashed #e2e8f0',
            borderRadius: 1,
          }}
        >
          <Server size={32} className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">No servers defined</p>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Add />}
            onClick={handleAdd}
            sx={{
              fontSize: '0.7rem',
              textTransform: 'none',
              borderColor: '#6366f1',
              color: '#6366f1',
              '&:hover': {
                borderColor: '#4f46e5',
                backgroundColor: 'rgba(99, 102, 241, 0.04)',
              },
            }}
          >
            Add server
          </Button>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {servers.map((server) => (
            <Box
              key={server.id}
              sx={{
                p: 1.5,
                border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                borderRadius: 1,
                backgroundColor: isDark ? '#0f172a' : '#f9fafb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <span className="text-sm font-medium text-gray-900 dark:text-white block truncate">
                  {server.name || server.url || 'Server'}
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block truncate" title={server.url}>
                  {server.url}
                </span>
                {server.description && (
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block truncate mt-0.5">
                    {server.description}
                  </span>
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 0.25 }}>
                <IconButton
                  size="small"
                  onClick={() => handleEdit(server)}
                  sx={{ p: 0.5, color: isDark ? '#94a3b8' : '#64748b' }}
                >
                  <Edit sx={{ fontSize: 14 }} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => handleDelete(server)}
                  sx={{ p: 0.5, color: '#ef4444' }}
                >
                  <Delete sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      <Dialog.Root open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[9998]" />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-full max-w-md max-h-[90vh] flex flex-col rounded-xl shadow-xl p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 overflow-y-auto"
            onPointerDownOutside={(e) => e.preventDefault()}
          >
            <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {editingServer ? 'Edit Server' : 'Add Server'}
            </Dialog.Title>
            {formError && (
              <div
                className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300"
                role="alert"
              >
                {formError}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name (optional)</label>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="e.g. Production, Staging"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  sx={{
                    '& .MuiInputBase-root': {
                      fontSize: '0.875rem',
                      backgroundColor: isDark ? '#0f172a' : '#fff',
                      color: isDark ? '#f1f5f9' : '#0f172a',
                    },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: isDark ? '#334155' : '#e2e8f0' },
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL (required)</label>
                <TextField
                  size="small"
                  fullWidth
                  required
                  placeholder="https://api.example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  sx={{
                    '& .MuiInputBase-root': {
                      fontSize: '0.875rem',
                      backgroundColor: isDark ? '#0f172a' : '#fff',
                      color: isDark ? '#f1f5f9' : '#0f172a',
                    },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: isDark ? '#334155' : '#e2e8f0' },
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (optional)</label>
                <TextField
                  size="small"
                  fullWidth
                  multiline
                  minRows={2}
                  placeholder="e.g. Production API server"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  sx={{
                    '& .MuiInputBase-root': {
                      fontSize: '0.875rem',
                      backgroundColor: isDark ? '#0f172a' : '#fff',
                      color: isDark ? '#f1f5f9' : '#0f172a',
                    },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: isDark ? '#334155' : '#e2e8f0' },
                  }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !url?.trim()}
                className="px-4 py-2 text-sm font-medium text-white rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : editingServer ? 'Save' : 'Add'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Box>
  );
}
