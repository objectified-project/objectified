'use client';

import React, { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import { Close, Save } from '@mui/icons-material';
import { useDarkMode } from '../../../../hooks/useDarkMode';
import { useDialog } from '../../../../components/providers/DialogProvider';
import {
  updateSharedPathResponse,
  getSharedPathResponses,
} from '../../../../../../lib/db/helper-shared-path-responses';
import {
  getClassesWithPropertiesAndTags,
} from '../../../../../../lib/db/helper';
import SchemaBuilder from './SchemaBuilder';
import { useStudio } from '../../StudioContext';

interface ResponsePropertiesPanelProps {
  responseId: string | null;
  statusCode: string;
  initialDescription?: string;
  versionPathId?: string | null;
  refreshKey?: number; // Key from parent to force reload
  onClose: () => void;
  onRefresh?: () => void;
}

export default function ResponsePropertiesPanel({
  responseId,
  statusCode,
  initialDescription = '',
  versionPathId,
  refreshKey = 0,
  onClose,
  onRefresh,
}: ResponsePropertiesPanelProps) {
  const isDark = useDarkMode();
  const { alert: alertDialog } = useDialog();
  const { selectedVersionId } = useStudio();

  const [description, setDescription] = useState(initialDescription);
  const [responseSchema, setResponseSchema] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const refreshCounterRef = useRef(0);

  // Load response data when responseId changes
  useEffect(() => {
    if (!responseId || !versionPathId) {
      setDescription('');
      setResponseSchema(null);
      return;
    }

    const loadResponse = async () => {
      setIsLoading(true);
      try {
        // Get all responses for this path and find the one we need
        const responsesResponse = await getSharedPathResponses(versionPathId);
        const responsesData = JSON.parse(responsesResponse);

        if (responsesData.success && responsesData.responses) {
          const response = responsesData.responses.find((r: any) => r.id === responseId);
          
          if (response) {
            // Update description
            setDescription(response.description || initialDescription);

            // Load schema from response.data field
            let schema: any = null;
            if (response.data) {
              try {
                const responseData = typeof response.data === 'string' 
                  ? JSON.parse(response.data) 
                  : response.data;
                
                // Extract schema from the data structure
                // OpenAPI format: content['application/json'].schema
                schema = responseData?.content?.['application/json']?.schema || responseData?.schema || null;
              } catch (error) {
                console.error('Error parsing response data:', error);
              }
            }

            setResponseSchema(schema);
          }
        }
      } catch (error) {
        console.error('Error loading response:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadResponse();
  }, [responseId, versionPathId, initialDescription, refreshKey]); // Include refreshKey to reload when canvas refreshes

  // Listen for onRefresh callback and reload when it's called
  // This happens when a class is dropped on a response
  const prevOnRefreshRef = useRef(onRefresh);
  useEffect(() => {
    if (prevOnRefreshRef.current !== onRefresh) {
      prevOnRefreshRef.current = onRefresh;
      // onRefresh changed, but we can't call it directly
      // Instead, we'll reload when responseId or versionPathId changes
    }
  }, [onRefresh]);

    // Also reload when canvas refresh happens (detected via a small delay after responseId is set)
    // This ensures we get fresh data after drag-drop operations
    useEffect(() => {
      if (!responseId || !versionPathId) return;
      
      // Longer delay to ensure database is updated after drag-drop
      const timeoutId = setTimeout(() => {
        const loadResponse = async () => {
          try {
            const responsesResponse = await getSharedPathResponses(versionPathId);
            const responsesData = JSON.parse(responsesResponse);

            if (responsesData.success && responsesData.responses) {
              const response = responsesData.responses.find((r: any) => r.id === responseId);
              
              if (response) {
                setDescription(response.description || initialDescription);

                let schema: any = null;
                if (response.data) {
                  try {
                    const responseData = typeof response.data === 'string' 
                      ? JSON.parse(response.data) 
                      : response.data;
                    
                    schema = responseData?.content?.['application/json']?.schema || responseData?.schema || null;
                  } catch (error) {
                    console.error('Error parsing response data:', error);
                  }
                }

                setResponseSchema(schema);
              }
            }
          } catch (error) {
            console.error('Error reloading response:', error);
          }
        };
        
        loadResponse();
      }, 800);

      return () => clearTimeout(timeoutId);
    }, [responseId, versionPathId, initialDescription]);

  const handleSave = async () => {
    if (!responseId) return;

    setIsSaving(true);
    setSaveStatus('idle');
    try {
      const updateData: any = {
        description: description.trim() || undefined,
      };

      // Include schema in data field if present
      if (responseSchema) {
        updateData.data = {
          content: {
            'application/json': {
              schema: responseSchema,
            },
          },
        };
      }

      const result = await updateSharedPathResponse(responseId, updateData);

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
              rows={4}
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

          {/* Response Schema Builder */}
          <Box sx={{ mt: 3, pt: 3, borderTop: isDark ? '1px solid #334155' : '1px solid #e2e8f0' }}>
            {isLoading ? (
              <Box sx={{ py: 2, textAlign: 'center' }}>
                <span className="text-xs text-gray-500 dark:text-gray-400">Loading schema...</span>
              </Box>
            ) : (
              <SchemaBuilder
                value={responseSchema}
                onChange={setResponseSchema}
                label="Response Schema"
                description="Define the response body schema using existing classes or create inline schemas"
                allowInline={true}
              />
            )}
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

