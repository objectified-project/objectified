'use client';

import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import { Close, Save } from '@mui/icons-material';
import { useDarkMode } from '../../../../hooks/useDarkMode';
import { useDialog } from '../../../../components/providers/DialogProvider';
import {
  updateSharedPathResponse,
} from '../../../../../../lib/db/helper-shared-path-responses';

interface ResponsePropertiesPanelProps {
  responseId: string | null;
  statusCode: string;
  initialDescription?: string;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function ResponsePropertiesPanel({
  responseId,
  statusCode,
  initialDescription = '',
  onClose,
  onRefresh,
}: ResponsePropertiesPanelProps) {
  const isDark = useDarkMode();
  const { alert: alertDialog } = useDialog();

  const [description, setDescription] = useState(initialDescription);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  // Update description when initialDescription changes (new response selected)
  useEffect(() => {
    setDescription(initialDescription);
  }, [initialDescription]);

  const handleSave = async () => {
    if (!responseId) return;

    setIsSaving(true);
    setSaveStatus('idle');
    try {
      const result = await updateSharedPathResponse(
        responseId,
        { description: description.trim() }
      );

      const data = JSON.parse(result);
      if (!data.success) {
        await alertDialog({
          message: data.error || 'Failed to update response',
          variant: 'error',
        });
        return;
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      onRefresh?.();
    } catch (error) {
      console.error('Error saving response:', error);
      await alertDialog({
        message: 'An error occurred while saving the response',
        variant: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box
      sx={{
        width: 360,
        height: '100%',
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderLeft: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
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
          backgroundColor: isDark ? '#0f172a' : '#f8fafc',
        }}
      >
        <Box>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Response Properties</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Status Code: {statusCode}
          </p>
        </Box>
        <IconButton
          size="small"
          onClick={onClose}
          sx={{
            color: isDark ? '#9ca3af' : '#6b7280',
            '&:hover': {
              backgroundColor: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(107, 114, 128, 0.1)',
            },
          }}
        >
          <Close fontSize="small" />
        </IconButton>
      </Box>

      {/* Content */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Description */}
          <Box>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <TextField
              fullWidth
              multiline
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this response..."
              variant="outlined"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  fontSize: '0.875rem',
                  '& fieldset': {
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                  },
                  '&:hover fieldset': {
                    borderColor: isDark ? '#475569' : '#cbd5e1',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#6366f1',
                  },
                },
                '& .MuiInputBase-input': {
                  color: isDark ? '#f1f5f9' : '#1e293b',
                },
              }}
            />
          </Box>

          {/* Save Button */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<Save />}
              onClick={handleSave}
              disabled={isSaving || !responseId}
              sx={{
                textTransform: 'none',
                backgroundColor: '#6366f1',
                '&:hover': {
                  backgroundColor: '#4f46e5',
                },
                '&:disabled': {
                  backgroundColor: isDark ? '#334155' : '#e2e8f0',
                  color: isDark ? '#64748b' : '#94a3b8',
                },
              }}
            >
              {isSaving ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save Changes'}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

