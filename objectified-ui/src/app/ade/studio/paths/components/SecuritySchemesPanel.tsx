'use client';

import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import { Add, Delete, Edit, Lock, VpnKey } from '@mui/icons-material';
import * as Dialog from '@radix-ui/react-dialog';
import { useStudio } from '../../StudioContext';
import { useDialog } from '../../../../components/providers/DialogProvider';
import {
  getSecuritySchemesForVersion,
  createApiKeySecurityScheme,
  updateApiKeySecurityScheme,
  deleteSecurityScheme,
  type SecuritySchemeRecord,
  type ApiKeySchemeInput,
} from '../../../../../../lib/db/helper-security-schemes';
import { useDarkMode } from '../../../../hooks/useDarkMode';

const API_KEY_IN_OPTIONS: { value: 'header' | 'query' | 'cookie'; label: string }[] = [
  { value: 'header', label: 'Header' },
  { value: 'query', label: 'Query' },
  { value: 'cookie', label: 'Cookie' },
];

export default function SecuritySchemesPanel({ onRefresh }: { onRefresh?: () => void }) {
  const { selectedVersionId } = useStudio();
  const { confirm: confirmDialog, alert: alertDialog } = useDialog();
  const isDark = useDarkMode();
  const [schemes, setSchemes] = useState<SecuritySchemeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingScheme, setEditingScheme] = useState<SecuritySchemeRecord | null>(null);
  const [formData, setFormData] = useState<ApiKeySchemeInput>({
    scheme_name: '',
    in_location: 'header',
    param_name: 'X-API-Key',
    description: '',
  });

  const loadSchemes = async () => {
    if (!selectedVersionId) {
      setSchemes([]);
      return;
    }
    setIsLoading(true);
    try {
      const data = await getSecuritySchemesForVersion(selectedVersionId);
      setSchemes(data);
    } catch (err) {
      console.error('Error loading security schemes:', err);
      setSchemes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSchemes();
  }, [selectedVersionId]);

  const resetForm = () => {
    setFormData({
      scheme_name: '',
      in_location: 'header',
      param_name: 'X-API-Key',
      description: '',
    });
    setEditingScheme(null);
  };

  const handleAdd = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = (scheme: SecuritySchemeRecord) => {
    if (scheme.scheme_type !== 'apiKey') return;
    setFormData({
      scheme_name: scheme.scheme_name,
      in_location: (scheme.in_location as 'header' | 'query' | 'cookie') || 'header',
      param_name: scheme.param_name || 'X-API-Key',
      description: scheme.description || '',
    });
    setEditingScheme(scheme);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedVersionId) return;
    const name = formData.scheme_name.trim();
    const paramName = formData.param_name.trim();
    if (!name || !paramName) {
      await alertDialog({
        title: 'Validation Error',
        message: 'Scheme name and parameter name are required.',
        variant: 'error',
      });
      return;
    }

    try {
      if (editingScheme) {
        const result = await updateApiKeySecurityScheme(editingScheme.id, formData);
        if (result.success && result.scheme) {
          setSchemes(prev =>
            prev.map(s => (s.id === editingScheme.id ? result.scheme! : s))
          );
          setDialogOpen(false);
          resetForm();
          onRefresh?.();
        } else {
          await alertDialog({
            title: 'Error',
            message: result.error || 'Failed to update scheme',
            variant: 'error',
          });
        }
      } else {
        const result = await createApiKeySecurityScheme(selectedVersionId, formData);
        if (result.success && result.scheme) {
          setSchemes(prev => [...prev, result.scheme!].sort((a, b) => a.scheme_name.localeCompare(b.scheme_name)));
          setDialogOpen(false);
          resetForm();
          onRefresh?.();
        } else {
          await alertDialog({
            title: 'Error',
            message: result.error || 'Failed to create scheme',
            variant: 'error',
          });
        }
      }
    } catch (err) {
      console.error('Error saving security scheme:', err);
      await alertDialog({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to save',
        variant: 'error',
      });
    }
  };

  const handleDelete = async (scheme: SecuritySchemeRecord) => {
    const confirmed = await confirmDialog({
      title: 'Delete Security Scheme',
      message: `Are you sure you want to delete "${scheme.scheme_name}"? Operations using this scheme will need to be updated.`,
      variant: 'danger',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) return;

    try {
      const result = await deleteSecurityScheme(scheme.id);
      if (result.success) {
        setSchemes(prev => prev.filter(s => s.id !== scheme.id));
        onRefresh?.();
      } else {
        await alertDialog({
          title: 'Error',
          message: result.error || 'Failed to delete scheme',
          variant: 'error',
        });
      }
    } catch (err) {
      console.error('Error deleting security scheme:', err);
      await alertDialog({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to delete',
        variant: 'error',
      });
    }
  };

  const getInLabel = (inLoc: string | null) => {
    const opt = API_KEY_IN_OPTIONS.find(o => o.value === inLoc);
    return opt?.label || inLoc || 'header';
  };

  if (!selectedVersionId) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-1.5">
          <Lock sx={{ fontSize: 14, color: '#f59e0b' }} />
          API Key Schemes
        </span>
        <Button
          size="small"
          startIcon={<Add sx={{ fontSize: 14 }} />}
          onClick={handleAdd}
          sx={{
            fontSize: '0.7rem',
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
      <p className="text-[11px] text-gray-500 dark:text-gray-400 -mt-1">
        Define API Key auth for header, query, or cookie. Use these scheme names when adding security to operations.
      </p>

      {isLoading ? (
        <span className="text-xs text-gray-500 dark:text-gray-400">Loading...</span>
      ) : schemes.length === 0 ? (
        <Box
          sx={{
            py: 3,
            px: 2,
            textAlign: 'center',
            border: isDark ? '1px dashed #334155' : '1px dashed #e2e8f0',
            borderRadius: 1,
          }}
        >
          <VpnKey sx={{ fontSize: 32, color: isDark ? '#475569' : '#94a3b8', mb: 1 }} />
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            No API Key schemes defined
          </p>
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
            Add API Key Scheme
          </Button>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {schemes.map((scheme) => (
            <Box
              key={scheme.id}
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
                  {scheme.scheme_name}
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {getInLabel(scheme.in_location)}: {scheme.param_name || '—'}
                </span>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.25 }}>
                <IconButton
                  size="small"
                  onClick={() => handleEdit(scheme)}
                  sx={{ p: 0.5, color: isDark ? '#94a3b8' : '#64748b' }}
                >
                  <Edit sx={{ fontSize: 14 }} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => handleDelete(scheme)}
                  sx={{ p: 0.5, color: '#ef4444' }}
                >
                  <Delete sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* Add/Edit Dialog */}
      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm rounded-xl shadow-xl p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
            onPointerDownOutside={(e) => e.preventDefault()}
          >
            <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {editingScheme ? 'Edit API Key Scheme' : 'Add API Key Scheme'}
            </Dialog.Title>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Scheme Name
                </label>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="apiKey"
                  value={formData.scheme_name}
                  onChange={(e) => setFormData(d => ({ ...d, scheme_name: e.target.value }))}
                  disabled={!!editingScheme}
                  helperText={editingScheme ? 'Name cannot be changed' : 'Used in operation security (e.g., apiKey)'}
                  sx={{
                    '& .MuiInputBase-root': {
                      fontSize: '0.875rem',
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    },
                  }}
                />
              </Box>
              <Box>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Location
                </label>
                <select
                  value={formData.in_location}
                  onChange={(e) =>
                    setFormData(d => ({
                      ...d,
                      in_location: e.target.value as 'header' | 'query' | 'cookie',
                      param_name:
                        e.target.value === 'header'
                          ? 'X-API-Key'
                          : e.target.value === 'query'
                          ? 'api_key'
                          : 'api_key',
                    }))
                  }
                  className={`w-full px-3 py-2 text-sm rounded-md border ${
                    isDark
                      ? 'bg-slate-800 border-slate-600 text-slate-200'
                      : 'bg-white border-gray-300 text-gray-700'
                  }`}
                >
                  {API_KEY_IN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Box>
              <Box>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Parameter / Header Name
                </label>
                <TextField
                  fullWidth
                  size="small"
                  placeholder={formData.in_location === 'header' ? 'X-API-Key' : 'api_key'}
                  value={formData.param_name}
                  onChange={(e) => setFormData(d => ({ ...d, param_name: e.target.value }))}
                  sx={{
                    '& .MuiInputBase-root': {
                      fontSize: '0.875rem',
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    },
                  }}
                />
              </Box>
              <Box>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Description (optional)
                </label>
                <TextField
                  fullWidth
                  size="small"
                  multiline
                  rows={2}
                  placeholder="API key for authentication"
                  value={formData.description}
                  onChange={(e) => setFormData(d => ({ ...d, description: e.target.value }))}
                  sx={{
                    '& .MuiInputBase-root': {
                      fontSize: '0.875rem',
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    },
                  }}
                />
              </Box>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
              <Dialog.Close asChild>
                <button
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                className="px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                onClick={handleSave}
              >
                {editingScheme ? 'Save' : 'Add'}
              </button>
            </Box>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Box>
  );
}
