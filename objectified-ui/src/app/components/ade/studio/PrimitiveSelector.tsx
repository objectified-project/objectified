'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Tooltip from '@mui/material/Tooltip';
import SearchIcon from '@mui/icons-material/Search';
import ShieldIcon from '@mui/icons-material/Shield';
import PersonIcon from '@mui/icons-material/Person';
import ClearIcon from '@mui/icons-material/Clear';
import DataObjectIcon from '@mui/icons-material/DataObject';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useDarkMode } from '@/app/hooks/useDarkMode';
import { PropertyFormData } from './PropertyFormFields';

export interface Primitive {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  category: string;
  schema: Record<string, unknown>;
  tags: string[];
  created_by: string | null;
  is_system: boolean;
  is_public: boolean;
  usage_count: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface PrimitiveSelectorProps {
  // Form data and update handler
  formData: PropertyFormData;
  onChange: (field: keyof PropertyFormData, value: any) => void;

  // Current property type (to filter primitives by category)
  propertyType: string;

  // Optional: callback when a primitive is applied
  onPrimitiveApplied?: (primitive: Primitive) => void;

  // Size variant
  size?: 'small' | 'medium';
}

// Category type mapping from property types to primitive categories
const propertyTypeToPrimitiveCategory: Record<string, string> = {
  'string': 'string',
  'number': 'number',
  'integer': 'integer',
  'boolean': 'boolean',
  'array': 'array',
  'object': 'object',
};

export const PrimitiveSelector: React.FC<PrimitiveSelectorProps> = ({
  formData,
  onChange,
  propertyType,
  onPrimitiveApplied,
  size = 'small',
}) => {
  const isDark = useDarkMode();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [primitives, setPrimitives] = useState<Primitive[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSystemPrimitives, setShowSystemPrimitives] = useState(true);
  const [showTenantPrimitives, setShowTenantPrimitives] = useState(true);
  const [selectedPrimitive, setSelectedPrimitive] = useState<Primitive | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch primitives when dialog opens
  useEffect(() => {
    if (dialogOpen) {
      fetchPrimitives();
    }
  }, [dialogOpen]);

  const fetchPrimitives = async () => {
    setLoading(true);
    setError(null);
    try {
      const category = propertyTypeToPrimitiveCategory[propertyType];
      const url = category ? `/api/primitives?category=${category}` : '/api/primitives';
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch primitives');
      }

      const data = await response.json();
      if (data.success) {
        setPrimitives(data.primitives || []);
      } else {
        setError(data.error || 'Failed to load primitives');
      }
    } catch (err) {
      console.error('Error fetching primitives:', err);
      setError(err instanceof Error ? err.message : 'Failed to load primitives');
    } finally {
      setLoading(false);
    }
  };

  // Filter primitives based on search and visibility settings
  const filteredPrimitives = useMemo(() => {
    let filtered = primitives;

    // Filter by system/tenant
    if (!showSystemPrimitives) {
      filtered = filtered.filter(p => !p.is_system);
    }
    if (!showTenantPrimitives) {
      filtered = filtered.filter(p => p.is_system);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sort: tenant primitives first, then alphabetically
    return filtered.sort((a, b) => {
      if (a.is_system !== b.is_system) {
        return a.is_system ? 1 : -1; // Tenant primitives first
      }
      return a.name.localeCompare(b.name);
    });
  }, [primitives, searchQuery, showSystemPrimitives, showTenantPrimitives]);

  // Apply primitive schema to form data
  const applyPrimitive = (primitive: Primitive) => {
    const schema = primitive.schema;

    // First, clear all constraint fields (preserve title, description which are identity fields)
    // Clear string constraints
    onChange('format', '');
    onChange('pattern', '');
    onChange('minLength', '');
    onChange('maxLength', '');

    // Clear number constraints
    onChange('minimum', '');
    onChange('maximum', '');
    onChange('minimumType', undefined);
    onChange('maximumType', undefined);
    onChange('multipleOf', '');

    // Clear array constraints
    onChange('minItems', '');
    onChange('maxItems', '');
    onChange('uniqueItems', false);

    // Clear enum and default
    onChange('enum', []);
    onChange('default', '');
    onChange('const', '');

    // Now apply the primitive's constraints
    // Apply format
    if (schema.format !== undefined) {
      onChange('format', schema.format as string);
    }

    // Apply pattern (regex)
    if (schema.pattern !== undefined) {
      onChange('pattern', schema.pattern as string);
    }

    // Apply string constraints
    if (schema.minLength !== undefined) {
      onChange('minLength', String(schema.minLength));
    }
    if (schema.maxLength !== undefined) {
      onChange('maxLength', String(schema.maxLength));
    }

    // Apply number constraints
    if (schema.minimum !== undefined) {
      onChange('minimum', String(schema.minimum));
      onChange('minimumType', 'inclusive');
    }
    if (schema.exclusiveMinimum !== undefined) {
      onChange('minimum', String(schema.exclusiveMinimum));
      onChange('minimumType', 'exclusive');
    }
    if (schema.maximum !== undefined) {
      onChange('maximum', String(schema.maximum));
      onChange('maximumType', 'inclusive');
    }
    if (schema.exclusiveMaximum !== undefined) {
      onChange('maximum', String(schema.exclusiveMaximum));
      onChange('maximumType', 'exclusive');
    }
    if (schema.multipleOf !== undefined) {
      onChange('multipleOf', String(schema.multipleOf));
    }

    // Apply array constraints
    if (schema.minItems !== undefined) {
      onChange('minItems', String(schema.minItems));
    }
    if (schema.maxItems !== undefined) {
      onChange('maxItems', String(schema.maxItems));
    }
    if (schema.uniqueItems !== undefined) {
      onChange('uniqueItems', schema.uniqueItems);
    }

    // Apply enum values
    if (schema.enum !== undefined && Array.isArray(schema.enum)) {
      onChange('enum', schema.enum.map(String));
    }

    // Apply default value
    if (schema.default !== undefined) {
      onChange('default', String(schema.default));
    }

    // Apply const value
    if (schema.const !== undefined) {
      onChange('const', typeof schema.const === 'string' ? schema.const : JSON.stringify(schema.const));
    }

    // Apply description only if the form doesn't have one (don't overwrite user's description)
    if (schema.description && !formData.description) {
      onChange('description', schema.description as string);
    }

    // Notify callback
    if (onPrimitiveApplied) {
      onPrimitiveApplied(primitive);
    }

    setDialogOpen(false);
    setSelectedPrimitive(null);
    setSearchQuery('');
  };

  // Render schema preview
  const renderSchemaPreview = (schema: Record<string, unknown>) => {
    const constraints: string[] = [];

    if (schema.format) constraints.push(`format: ${schema.format}`);
    if (schema.pattern) constraints.push(`pattern: ${schema.pattern}`);
    if (schema.minLength !== undefined) constraints.push(`minLength: ${schema.minLength}`);
    if (schema.maxLength !== undefined) constraints.push(`maxLength: ${schema.maxLength}`);
    if (schema.minimum !== undefined) constraints.push(`minimum: ${schema.minimum}`);
    if (schema.maximum !== undefined) constraints.push(`maximum: ${schema.maximum}`);
    if (schema.exclusiveMinimum !== undefined) constraints.push(`exclusiveMinimum: ${schema.exclusiveMinimum}`);
    if (schema.exclusiveMaximum !== undefined) constraints.push(`exclusiveMaximum: ${schema.exclusiveMaximum}`);
    if (schema.multipleOf !== undefined) constraints.push(`multipleOf: ${schema.multipleOf}`);
    if (schema.minItems !== undefined) constraints.push(`minItems: ${schema.minItems}`);
    if (schema.maxItems !== undefined) constraints.push(`maxItems: ${schema.maxItems}`);
    if (schema.uniqueItems) constraints.push('uniqueItems: true');
    if (schema.enum && Array.isArray(schema.enum)) {
      const enumStr = (schema.enum as string[]).slice(0, 3).join(', ');
      constraints.push(`enum: [${enumStr}${(schema.enum as string[]).length > 3 ? '...' : ''}]`);
    }

    return constraints.length > 0 ? constraints.join(', ') : 'No constraints defined';
  };

  return (
    <>
      {/* Trigger Button */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button
          variant="outlined"
          size={size}
          onClick={() => setDialogOpen(true)}
          startIcon={<AutoAwesomeIcon fontSize="small" />}
          sx={{
            borderColor: isDark ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.5)',
            color: isDark ? '#a5b4fc' : '#6366f1',
            textTransform: 'none',
            '&:hover': {
              borderColor: '#6366f1',
              bgcolor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)',
            },
          }}
        >
          Apply Primitive
        </Button>
        <Tooltip title="Apply a predefined primitive type to automatically set format, pattern, and constraints">
          <Typography variant="caption" sx={{ color: isDark ? '#94a3b8' : '#64748b', cursor: 'help' }}>
            ⓘ
          </Typography>
        </Tooltip>
      </Box>

      {/* Selection Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedPrimitive(null);
          setSearchQuery('');
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: isDark ? '#1e293b' : '#ffffff',
            maxHeight: '80vh',
          },
        }}
      >
        <DialogTitle sx={{
          borderBottom: '1px solid',
          borderColor: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}>
          <AutoAwesomeIcon sx={{ color: '#6366f1' }} />
          <Typography component="span" variant="h6" sx={{ flex: 1 }}>
            Apply Primitive
          </Typography>
          <IconButton onClick={() => setDialogOpen(false)} size="small">
            <ClearIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          {/* Search and Filters */}
          <Box sx={{
            p: 2,
            borderBottom: '1px solid',
            borderColor: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}>
            <TextField
              placeholder="Search primitives by name, description, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: isDark ? '#94a3b8' : '#64748b' }} />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchQuery('')}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                bgcolor: isDark ? '#0f172a' : '#f8fafc',
                '& .MuiOutlinedInput-root': { borderRadius: 2 },
              }}
            />

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showSystemPrimitives}
                    onChange={(e) => setShowSystemPrimitives(e.target.checked)}
                    size="small"
                    sx={{ color: '#10b981', '&.Mui-checked': { color: '#10b981' } }}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <ShieldIcon sx={{ fontSize: 16, color: '#10b981' }} />
                    <Typography variant="body2">System Primitives</Typography>
                  </Box>
                }
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showTenantPrimitives}
                    onChange={(e) => setShowTenantPrimitives(e.target.checked)}
                    size="small"
                    sx={{ color: '#6366f1', '&.Mui-checked': { color: '#6366f1' } }}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <PersonIcon sx={{ fontSize: 16, color: '#6366f1' }} />
                    <Typography variant="body2">Tenant Primitives</Typography>
                  </Box>
                }
              />
              <Chip
                label={`Showing ${filteredPrimitives.length} primitive${filteredPrimitives.length !== 1 ? 's' : ''}`}
                size="small"
                variant="outlined"
                sx={{ ml: 'auto' }}
              />
            </Box>
          </Box>

          {/* Primitives List */}
          <Box sx={{ minHeight: 300, maxHeight: 400, overflow: 'auto' }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
                <CircularProgress size={32} />
              </Box>
            ) : error ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="error">{error}</Typography>
                <Button onClick={fetchPrimitives} sx={{ mt: 2 }}>Retry</Button>
              </Box>
            ) : filteredPrimitives.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <DataObjectIcon sx={{ fontSize: 48, color: isDark ? '#475569' : '#cbd5e1', mb: 2 }} />
                <Typography variant="body1" sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                  {searchQuery ? 'No primitives match your search' : `No ${propertyType} primitives available`}
                </Typography>
                <Typography variant="body2" sx={{ color: isDark ? '#64748b' : '#94a3b8', mt: 1 }}>
                  {searchQuery ? 'Try a different search term' : 'Create primitives in the Primitives Management section'}
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {filteredPrimitives.map((primitive) => (
                  <ListItemButton
                    key={primitive.id}
                    selected={selectedPrimitive?.id === primitive.id}
                    onClick={() => setSelectedPrimitive(primitive)}
                    onDoubleClick={() => applyPrimitive(primitive)}
                    sx={{
                      borderBottom: '1px solid',
                      borderColor: isDark ? 'rgba(148, 163, 184, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                      py: 1.5,
                      px: 2,
                      '&.Mui-selected': {
                        bgcolor: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.08)',
                        '&:hover': {
                          bgcolor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.12)',
                        },
                      },
                      '&:hover': {
                        bgcolor: isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.04)',
                      },
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        {primitive.is_system ? (
                          <Tooltip title="System Primitive">
                            <ShieldIcon sx={{ fontSize: 16, color: '#10b981' }} />
                          </Tooltip>
                        ) : (
                          <Tooltip title="Tenant Primitive">
                            <PersonIcon sx={{ fontSize: 16, color: '#6366f1' }} />
                          </Tooltip>
                        )}
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 600,
                            color: isDark ? '#e2e8f0' : '#1e293b',
                          }}
                        >
                          {primitive.name}
                        </Typography>
                        <Chip
                          label={primitive.category}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            bgcolor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)',
                            color: isDark ? '#a5b4fc' : '#6366f1',
                          }}
                        />
                        {primitive.usage_count > 0 && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: isDark ? '#64748b' : '#94a3b8',
                              ml: 'auto',
                            }}
                          >
                            Used {primitive.usage_count}×
                          </Typography>
                        )}
                      </Box>

                      {primitive.description && (
                        <Typography
                          variant="body2"
                          sx={{
                            color: isDark ? '#94a3b8' : '#64748b',
                            mb: 0.5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {primitive.description}
                        </Typography>
                      )}

                      <Typography
                        variant="caption"
                        sx={{
                          color: isDark ? '#64748b' : '#94a3b8',
                          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                          fontSize: '0.7rem',
                        }}
                      >
                        {renderSchemaPreview(primitive.schema)}
                      </Typography>

                      {primitive.tags.length > 0 && (
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                          {primitive.tags.slice(0, 5).map((tag) => (
                            <Chip
                              key={tag}
                              label={tag}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.65rem',
                                bgcolor: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                                color: isDark ? '#94a3b8' : '#64748b',
                              }}
                            />
                          ))}
                          {primitive.tags.length > 5 && (
                            <Typography variant="caption" sx={{ color: isDark ? '#64748b' : '#94a3b8' }}>
                              +{primitive.tags.length - 5} more
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Box>
                  </ListItemButton>
                ))}
              </List>
            )}
          </Box>

          {/* Selected Primitive Preview */}
          {selectedPrimitive && (
            <Box sx={{
              p: 2,
              borderTop: '1px solid',
              borderColor: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              bgcolor: isDark ? 'rgba(99, 102, 241, 0.05)' : 'rgba(99, 102, 241, 0.02)',
            }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                Schema Preview
              </Typography>
              <Box
                component="pre"
                sx={{
                  bgcolor: isDark ? '#0f172a' : '#f8fafc',
                  borderRadius: 1,
                  p: 1.5,
                  fontSize: '0.75rem',
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  overflow: 'auto',
                  maxHeight: 150,
                  color: isDark ? '#e2e8f0' : '#1e293b',
                  margin: 0,
                }}
              >
                {JSON.stringify(selectedPrimitive.schema, null, 2)}
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}>
          <Button
            onClick={() => {
              setDialogOpen(false);
              setSelectedPrimitive(null);
              setSearchQuery('');
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!selectedPrimitive}
            onClick={() => selectedPrimitive && applyPrimitive(selectedPrimitive)}
            sx={{
              bgcolor: '#6366f1',
              '&:hover': { bgcolor: '#4f46e5' },
              '&.Mui-disabled': { bgcolor: isDark ? '#475569' : '#cbd5e1' },
            }}
          >
            Apply Primitive
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PrimitiveSelector;
