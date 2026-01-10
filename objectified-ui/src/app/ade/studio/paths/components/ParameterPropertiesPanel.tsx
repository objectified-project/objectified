'use client';

import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import { Close, Save } from '@mui/icons-material';
import { Hash } from 'lucide-react';
import { useDarkMode } from '../../../../hooks/useDarkMode';
import { useDialog } from '../../../../components/providers/DialogProvider';
import {
  getParametersForOperation,
  updatePathParameter,
  deletePathParameter,
} from '../../../../../../lib/db/helper-path-parameters';
import { extractPathParameters } from '../../../../../../lib/utils/path-params';

interface ParameterPropertiesPanelProps {
  parameterId: string | null;
  operationId: string;
  pathname: string;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function ParameterPropertiesPanel({
  parameterId,
  operationId,
  pathname,
  onClose,
  onRefresh,
}: ParameterPropertiesPanelProps) {
  const isDark = useDarkMode();
  const { alert: alertDialog, confirm: confirmDialog } = useDialog();
  const [name, setName] = useState('');
  const [inLocation, setInLocation] = useState<'path' | 'query' | 'header' | 'cookie'>('path');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [required, setRequired] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [availablePathParams, setAvailablePathParams] = useState<string[]>([]);

  // Load parameter details when parameterId changes
  useEffect(() => {
    if (!parameterId || !operationId) {
      setName('');
      setInLocation('path');
      setSummary('');
      setDescription('');
      setRequired(true);
      return;
    }

    const loadParameter = async () => {
      setIsLoading(true);
      try {
        const result = await getParametersForOperation(operationId);
        const data = JSON.parse(result);

        if (data.success && data.parameters) {
          const param = data.parameters.find((p: any) => p.id === parameterId);
          if (param) {
            setName(param.name);
            setInLocation(param.in_location);
            setSummary(param.summary || '');
            setDescription(param.description || '');
            setRequired(param.metadata?.required ?? (param.in_location === 'path'));
          }
        }
      } catch (error) {
        console.error('Error loading parameter:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadParameter();
  }, [parameterId, operationId]);

  // Extract available path parameters from pathname
  useEffect(() => {
    if (pathname) {
      const params = extractPathParameters(pathname);
      setAvailablePathParams(params);
    }
  }, [pathname]);

  const handleSave = async () => {
    if (!parameterId || !name.trim()) return;

    setIsSaving(true);
    setSaveStatus('idle');
    try {
      const metadata = {
        required,
        schema: {
          type: 'string',
        },
      };

      const result = await updatePathParameter(parameterId, {
        name: name.trim(),
        inLocation,
        summary: summary.trim() || undefined,
        description: description.trim() || undefined,
        metadata,
      });

      const parsed = JSON.parse(result);
      if (parsed.success) {
        // Show "Saved" in button briefly
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
        // Refresh the canvas
        if (onRefresh) {
          onRefresh();
        }
      } else {
        await alertDialog({
          title: 'Error',
          message: parsed.error || 'Failed to update parameter',
          variant: 'error',
        });
      }
    } catch (error: any) {
      console.error('Error saving parameter:', error);
      await alertDialog({
        title: 'Error',
        message: 'Failed to update parameter. Please try again.',
        variant: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!parameterId) return;

    const confirmed = await confirmDialog({
      title: 'Delete Parameter',
      message: `Are you sure you want to delete the parameter "${name}"?`,
      variant: 'danger',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) return;

    try {
      const result = await deletePathParameter(parameterId);
      const parsed = JSON.parse(result);

      if (parsed.success) {
        await alertDialog({
          title: 'Success',
          message: 'Parameter deleted successfully',
          variant: 'success',
        });
        // Close the panel and refresh the canvas
        onClose();
        if (onRefresh) {
          onRefresh();
        }
      } else {
        await alertDialog({
          title: 'Error',
          message: parsed.error || 'Failed to delete parameter',
          variant: 'error',
        });
      }
    } catch (error) {
      console.error('Error deleting parameter:', error);
      await alertDialog({
        title: 'Error',
        message: 'Failed to delete parameter. Please try again.',
        variant: 'error',
      });
    }
  };

  if (!parameterId) return null;

  return (
    <Box
      sx={{
        width: 320,
        height: '100%',
        borderLeft: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
        background: isDark
          ? 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)'
          : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Hash size={20} color={isDark ? '#a78bfa' : '#8b5cf6'} />
          <Box>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              Parameter Details
            </span>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {name}
            </div>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>
          <Close sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* Content */}
      {isLoading ? (
        <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
          <span className="text-sm text-gray-500 dark:text-gray-400">Loading...</span>
        </Box>
      ) : (
        <>
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Parameter Name */}
              <Box>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Parameter Name
                </label>
                {inLocation === 'path' && availablePathParams.length > 0 ? (
                  <TextField
                    fullWidth
                    select
                    size="small"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    sx={{
                      '& .MuiInputBase-root': {
                        fontSize: '0.875rem',
                        backgroundColor: isDark ? '#0f172a' : '#ffffff',
                        color: isDark ? '#f1f5f9' : '#0f172a',
                      },
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                      },
                    }}
                  >
                    {availablePathParams.map((param) => (
                      <MenuItem key={param} value={param}>
                        {param}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : (
                  <TextField
                    fullWidth
                    size="small"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Parameter name"
                    sx={{
                      '& .MuiInputBase-root': {
                        fontSize: '0.875rem',
                        backgroundColor: isDark ? '#0f172a' : '#ffffff',
                        color: isDark ? '#f1f5f9' : '#0f172a',
                      },
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                      },
                    }}
                  />
                )}
              </Box>

              {/* Location */}
              <Box>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Location
                </label>
                <TextField
                  fullWidth
                  select
                  size="small"
                  value={inLocation}
                  onChange={(e) => setInLocation(e.target.value as any)}
                  sx={{
                    '& .MuiInputBase-root': {
                      fontSize: '0.875rem',
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      color: isDark ? '#f1f5f9' : '#0f172a',
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: isDark ? '#334155' : '#e2e8f0',
                    },
                  }}
                >
                  <MenuItem value="path">Path</MenuItem>
                  <MenuItem value="query">Query</MenuItem>
                  <MenuItem value="header">Header</MenuItem>
                  <MenuItem value="cookie">Cookie</MenuItem>
                </TextField>
              </Box>

              {/* Required */}
              <Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={required}
                      onChange={(e) => setRequired(e.target.checked)}
                      sx={{
                        color: isDark ? '#64748b' : '#94a3b8',
                        '&.Mui-checked': {
                          color: '#8b5cf6',
                        },
                      }}
                    />
                  }
                  label={
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Required parameter
                    </span>
                  }
                />
              </Box>

              {/* Summary */}
              <Box>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Summary
                </label>
                <TextField
                  fullWidth
                  size="small"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Brief summary"
                  sx={{
                    '& .MuiInputBase-root': {
                      fontSize: '0.875rem',
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      color: isDark ? '#f1f5f9' : '#0f172a',
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: isDark ? '#334155' : '#e2e8f0',
                    },
                  }}
                />
              </Box>

              {/* Description */}
              <Box>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  size="small"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed description of the parameter..."
                  sx={{
                    '& .MuiInputBase-root': {
                      fontSize: '0.875rem',
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      color: isDark ? '#f1f5f9' : '#0f172a',
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: isDark ? '#334155' : '#e2e8f0',
                    },
                  }}
                />
              </Box>
            </Box>
          </Box>

          {/* Footer with Save and Delete buttons */}
          <Box
            sx={{
              p: 2,
              borderTop: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            <Button
              fullWidth
              variant="contained"
              onClick={handleSave}
              disabled={isSaving || !name.trim()}
              startIcon={<Save />}
              sx={{
                background: saveStatus === 'saved'
                  ? 'linear-gradient(135deg, #10b981 0%, #34d399 100%)'
                  : 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
                '&:hover': {
                  background: saveStatus === 'saved'
                    ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                    : 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
                },
                '&:disabled': {
                  background: isDark ? '#334155' : '#e2e8f0',
                  color: isDark ? '#64748b' : '#94a3b8',
                },
              }}
            >
              {isSaving ? 'Saving...' : saveStatus === 'saved' ? 'Saved ✓' : 'Save Changes'}
            </Button>
            <Button
              fullWidth
              variant="outlined"
              onClick={handleDelete}
              sx={{
                borderColor: '#ef4444',
                color: '#ef4444',
                '&:hover': {
                  borderColor: '#dc2626',
                  backgroundColor: 'rgba(239, 68, 68, 0.04)',
                },
              }}
            >
              Delete Parameter
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
}

