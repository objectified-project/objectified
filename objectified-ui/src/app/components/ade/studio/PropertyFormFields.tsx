'use client';

import React from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Radio from '@mui/material/Radio';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import InputAdornment from '@mui/material/InputAdornment';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import TuneIcon from '@mui/icons-material/Tune';
import SettingsIcon from '@mui/icons-material/Settings';
import CodeIcon from '@mui/icons-material/Code';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Paper from '@mui/material/Paper';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RegexTester } from './RegexTester';
import { PrefixItemsEditor } from './PrefixItemsEditor';
import { ExtensionsEditor } from './ExtensionsEditor';

export interface PropertyFormData {
  // Basic fields
  title?: string;
  description?: string;
  format?: string;
  pattern?: string;

  // String constraints
  minLength?: string;
  maxLength?: string;

  // Number constraints
  minimum?: string;
  maximum?: string;
  minimumType?: 'inclusive' | 'exclusive'; // OpenAPI 3.1: determines whether to use minimum or exclusiveMinimum
  maximumType?: 'inclusive' | 'exclusive'; // OpenAPI 3.1: determines whether to use maximum or exclusiveMaximum
  multipleOf?: string;

  // Array constraints
  minItems?: string;
  maxItems?: string;
  uniqueItems?: boolean;
  contains?: string; // OpenAPI 3.1: JSON Schema that at least one array item must match
  minContains?: string; // OpenAPI 3.1: Minimum number of items that must match contains schema
  maxContains?: string; // OpenAPI 3.1: Maximum number of items that must match contains schema

  // Tuple mode (OpenAPI 3.1)
  tupleMode?: boolean; // Toggle for tuple mode with prefixItems
  prefixItems?: any[]; // OpenAPI 3.1: Array of schemas for specific positions
  itemsSchema?: string; // JSON string of items schema for positions beyond prefix

  // Common constraints
  enum?: string[];
  const?: string; // OpenAPI 3.1: Constant value (mutually exclusive with enum)
  default?: string;

  // Composition constraints
  not?: string; // OpenAPI 3.1: JSON Schema that the data must NOT match

  // Metadata
  required?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;
  deprecationMessage?: string;
  example?: string;

  // Object constraints
  additionalProperties?: 'default' | 'true' | 'false';
  minProperties?: string;
  maxProperties?: string;

  // Extensions (x- prefixed properties)
  extensions?: Record<string, any>;

  // External Documentation
  externalDocsUrl?: string;
  externalDocsDescription?: string;
}

interface SortableEnumItemProps {
  id: string;
  value: string;
  onDelete: (value: string) => void;
}

const SortableEnumItem: React.FC<SortableEnumItemProps> = ({ id, value, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        backgroundColor: isDragging ? 'action.selected' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        pl: 1,
        pr: 1,
      }}
    >
      <IconButton
        {...attributes}
        {...listeners}
        size="small"
        sx={{
          cursor: 'grab',
          '&:active': { cursor: 'grabbing' },
          color: 'text.secondary',
          flex: 0,
          p: 0.5,
        }}
      >
        <DragIndicatorIcon fontSize="small" />
      </IconButton>
      <ListItemText
        primary={value}
        primaryTypographyProps={{
          fontFamily: 'monospace',
          fontSize: '0.875rem',
        }}
        sx={{ flex: 1, my: 0 }}
      />
      <IconButton
        edge="end"
        onClick={() => onDelete(value)}
        size="small"
        sx={{
          flex: 0,
        }}
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
    </ListItem>
  );
};

export interface PropertyFormFieldsProps {
  // Property type info
  baseType: string;
  isArray: boolean;

  // Form data
  data: PropertyFormData;

  // Change handlers
  onChange: (field: keyof PropertyFormData, value: any) => void;

  // Optional: Show/hide certain fields
  showMetadata?: boolean;
  showTitle?: boolean;
  size?: 'small' | 'medium';

  // Object type information
  nestedProperties?: Array<{
    id: string;
    name: string;
    data: any;
    description?: string;
  }>;
}

export const PropertyFormFields: React.FC<PropertyFormFieldsProps> = ({
  baseType,
  isArray,
  data,
  onChange,
  showMetadata = true,
  showTitle = true,
  size = 'medium',
  nestedProperties,
}) => {
  const [enumInput, setEnumInput] = React.useState('');
  const [enumError, setEnumError] = React.useState('');

  // DnD sensors for enum reordering
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Generate an example value based on the property schema
  const generateExample = () => {
    let exampleValue: any;

    // If enum values exist, use the first one
    if (data.enum && data.enum.length > 0) {
      exampleValue = data.enum[0];
      // Try to parse as number if baseType is number/integer
      if (baseType === 'number' || baseType === 'integer') {
        const numValue = Number(exampleValue);
        if (!isNaN(numValue)) {
          exampleValue = numValue;
        }
      }
    } else {
      // Generate based on type
      switch (baseType) {
        case 'string':
          if (data.format === 'email') {
            exampleValue = 'user@example.com';
          } else if (data.format === 'uri' || data.format === 'url') {
            exampleValue = 'https://example.com';
          } else if (data.format === 'date') {
            exampleValue = '2025-11-30';
          } else if (data.format === 'date-time') {
            exampleValue = '2025-11-30T12:00:00Z';
          } else if (data.format === 'time') {
            exampleValue = '12:00:00';
          } else if (data.format === 'uuid') {
            exampleValue = '123e4567-e89b-12d3-a456-426614174000';
          } else if (data.pattern) {
            // For patterns, provide a hint
            exampleValue = `string matching pattern: ${data.pattern}`;
          } else {
            exampleValue = data.description || 'example string';
          }
          break;

        case 'number':
          if (data.minimum) {
            exampleValue = parseFloat(data.minimum) + (data.minimumType === 'exclusive' ? 0.1 : 0);
          } else if (data.maximum) {
            exampleValue = parseFloat(data.maximum) - (data.maximumType === 'exclusive' ? 0.1 : 0);
          } else {
            exampleValue = 42.5;
          }
          break;

        case 'integer':
          if (data.minimum) {
            exampleValue = Math.ceil(parseFloat(data.minimum) + (data.minimumType === 'exclusive' ? 1 : 0));
          } else if (data.maximum) {
            exampleValue = Math.floor(parseFloat(data.maximum) - (data.maximumType === 'exclusive' ? 1 : 0));
          } else {
            exampleValue = 42;
          }
          break;

        case 'boolean':
          exampleValue = true;
          break;

        case 'object':
          exampleValue = {};
          // Add nested properties if available
          if (nestedProperties && nestedProperties.length > 0) {
            nestedProperties.forEach(prop => {
              const propData = typeof prop.data === 'string' ? JSON.parse(prop.data) : prop.data;
              // Generate simple example for nested properties
              if (propData.type === 'string') {
                exampleValue[prop.name] = 'example';
              } else if (propData.type === 'number') {
                exampleValue[prop.name] = 0;
              } else if (propData.type === 'boolean') {
                exampleValue[prop.name] = true;
              } else if (propData.type === 'array') {
                exampleValue[prop.name] = [];
              } else {
                exampleValue[prop.name] = {};
              }
            });
          } else {
            exampleValue = { property: 'value' };
          }
          break;

        case 'array':
          exampleValue = [];
          break;

        default:
          // For reference types (e.g., Person, Address)
          exampleValue = { id: 1, name: `example ${baseType}` };
          break;
      }
    }

    // Wrap in array if isArray
    if (isArray) {
      exampleValue = [exampleValue];
    }

    // Convert to JSON string
    const jsonString = JSON.stringify(exampleValue, null, 2);
    onChange('example', jsonString);
  };

  const handleAddEnum = () => {
    if (!enumInput.trim()) {
      setEnumError('Enum value cannot be empty');
      return;
    }

    const trimmedValue = enumInput.trim();

    // Validate based on data type
    if (baseType === 'number' || baseType === 'integer') {
      const numValue = Number(trimmedValue);
      if (isNaN(numValue)) {
        setEnumError(`Value must be a valid ${baseType}`);
        return;
      }
      if (baseType === 'integer' && !Number.isInteger(numValue)) {
        setEnumError('Value must be an integer (no decimals)');
        return;
      }
    }

    if (data.enum?.includes(trimmedValue)) {
      setEnumError('This value already exists');
      return;
    }

    // Clear const if it's set when adding enum values
    if (data.const) {
      onChange('const', undefined);
    }

    onChange('enum', [...(data.enum || []), trimmedValue]);
    setEnumInput('');
    setEnumError('');
  };

  const handleRemoveEnum = (value: string) => {
    onChange('enum', (data.enum || []).filter(v => v !== value));
  };

  const handleEnumKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEnum();
    }
  };

  const handleSortEnumAZ = () => {
    if (!data.enum || data.enum.length === 0) return;

    const sorted = [...data.enum].sort((a, b) => {
      // For numeric types, sort as numbers
      if (baseType === 'number' || baseType === 'integer') {
        return Number(a) - Number(b);
      }
      // For strings, sort alphabetically (case-insensitive)
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });

    onChange('enum', sorted);
  };

  const handleSortEnumZA = () => {
    if (!data.enum || data.enum.length === 0) return;

    const sorted = [...data.enum].sort((a, b) => {
      // For numeric types, sort as numbers in descending order
      if (baseType === 'number' || baseType === 'integer') {
        return Number(b) - Number(a);
      }
      // For strings, sort alphabetically in reverse (case-insensitive)
      return b.toLowerCase().localeCompare(a.toLowerCase());
    });

    onChange('enum', sorted);
  };

  const handleEnumDragEnd = (event: any) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !data.enum) {
      return;
    }

    const oldIndex = data.enum.indexOf(active.id);
    const newIndex = data.enum.indexOf(over.id);

    const newEnumArray = arrayMove(data.enum, oldIndex, newIndex);
    onChange('enum', newEnumArray);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* ═══════════════════════════════════════════════════════════════════════════
          SECTION 1: Basic Information
          ═══════════════════════════════════════════════════════════════════════════ */}
      <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <InfoOutlinedIcon sx={{ color: '#6366f1', fontSize: 20 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Basic Information
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 2 }}>
          {showTitle && (
            <TextField
              label="Title"
              size={size}
              fullWidth
              value={data.title || ''}
              onChange={(e) => onChange('title', e.target.value)}
              helperText="Display title"
            />
          )}

          <TextField
            label="Description"
            size={size}
            fullWidth
            multiline
            rows={2}
            value={data.description || ''}
            onChange={(e) => onChange('description', e.target.value)}
            helperText="What this property represents"
            sx={{ gridColumn: showTitle ? 'auto' : '1 / -1' }}
          />
        </Box>

        {/* Default and Example in a row */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mt: 2 }}>
          <TextField
            label="Default Value"
            size={size}
            fullWidth
            value={data.default || ''}
            onChange={(e) => onChange('default', e.target.value)}
            helperText="JSON default value"
            sx={{
              '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.875rem' },
            }}
          />

          <TextField
            label="Example"
            size={size}
            fullWidth
            value={data.example || ''}
            onChange={(e) => onChange('example', e.target.value)}
            helperText="JSON example value"
            sx={{
              '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.875rem' },
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title="Generate example based on schema">
                    <IconButton onClick={generateExample} size="small" sx={{ color: 'primary.main' }}>
                      <AutoAwesomeIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Box>

      {/* ═══════════════════════════════════════════════════════════════════════════
          SECTION 2: Property Behavior (Metadata flags)
          ═══════════════════════════════════════════════════════════════════════════ */}
      {showMetadata && (
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', bgcolor: '#fafafa' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TuneIcon sx={{ color: '#6366f1', fontSize: 20 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Property Behavior
            </Typography>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
            {/* Required */}
            <Box
              sx={{
                p: 2,
                bgcolor: data.required ? '#fef2f2' : 'white',
                borderRadius: 2,
                border: 1,
                borderColor: data.required ? '#fecaca' : 'divider',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                '&:hover': { borderColor: data.required ? '#f87171' : '#94a3b8' }
              }}
              onClick={() => onChange('required', !data.required)}
            >
              <Checkbox
                checked={data.required || false}
                size="small"
                sx={{ p: 0, pointerEvents: 'none' }}
                tabIndex={-1}
              />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: data.required ? '#dc2626' : 'text.primary' }}>
                  Required
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Must be provided
                </Typography>
              </Box>
            </Box>

            {/* Read Only */}
            <Box
              sx={{
                p: 2,
                bgcolor: data.readOnly ? '#eff6ff' : 'white',
                borderRadius: 2,
                border: 1,
                borderColor: data.readOnly ? '#bfdbfe' : 'divider',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                '&:hover': { borderColor: data.readOnly ? '#60a5fa' : '#94a3b8' }
              }}
              onClick={() => {
                onChange('readOnly', !data.readOnly);
                if (!data.readOnly) onChange('writeOnly', false);
              }}
            >
              <Checkbox
                checked={data.readOnly || false}
                size="small"
                sx={{ p: 0, pointerEvents: 'none' }}
                tabIndex={-1}
              />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: data.readOnly ? '#2563eb' : 'text.primary' }}>
                  Read Only
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Output only
                </Typography>
              </Box>
            </Box>

            {/* Write Only */}
            <Box
              sx={{
                p: 2,
                bgcolor: data.writeOnly ? '#f0fdf4' : 'white',
                borderRadius: 2,
                border: 1,
                borderColor: data.writeOnly ? '#bbf7d0' : 'divider',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                '&:hover': { borderColor: data.writeOnly ? '#4ade80' : '#94a3b8' }
              }}
              onClick={() => {
                onChange('writeOnly', !data.writeOnly);
                if (!data.writeOnly) onChange('readOnly', false);
              }}
            >
              <Checkbox
                checked={data.writeOnly || false}
                size="small"
                sx={{ p: 0, pointerEvents: 'none' }}
                tabIndex={-1}
              />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: data.writeOnly ? '#16a34a' : 'text.primary' }}>
                  Write Only
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Input only
                </Typography>
              </Box>
            </Box>

            {/* Deprecated */}
            <Box
              sx={{
                p: 2,
                bgcolor: data.deprecated ? '#fef3c7' : 'white',
                borderRadius: 2,
                border: 1,
                borderColor: data.deprecated ? '#fcd34d' : 'divider',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                '&:hover': { borderColor: data.deprecated ? '#fbbf24' : '#94a3b8' }
              }}
              onClick={() => onChange('deprecated', !data.deprecated)}
            >
              <Checkbox
                checked={data.deprecated || false}
                size="small"
                sx={{ p: 0, pointerEvents: 'none' }}
                tabIndex={-1}
              />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: data.deprecated ? '#d97706' : 'text.primary' }}>
                  Deprecated
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Avoid using
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Deprecation Message */}
          <Collapse in={data.deprecated}>
            <TextField
              label="Deprecation Message"
              size={size}
              fullWidth
              multiline
              rows={2}
              value={data.deprecationMessage || ''}
              onChange={(e) => onChange('deprecationMessage', e.target.value)}
              placeholder="e.g., Use newProperty instead. Will be removed in v2.0."
              sx={{ mt: 2, bgcolor: 'white' }}
            />
          </Collapse>
        </Box>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          SECTION 3: Type-Specific Constraints
          ═══════════════════════════════════════════════════════════════════════════ */}
      <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <TuneIcon sx={{ color: '#6366f1', fontSize: 20 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Constraints
          </Typography>
          <Typography variant="caption" sx={{
            px: 1,
            py: 0.25,
            bgcolor: '#e0e7ff',
            color: '#4338ca',
            borderRadius: 1,
            fontWeight: 500,
            ml: 1
          }}>
            {baseType}{isArray ? '[]' : ''}
          </Typography>
        </Box>

        {/* Tuple mode message */}
        {data.tupleMode && isArray && (
          <Box sx={{ mb: 2, p: 2, bgcolor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, color: '#1d4ed8' }}>
              Tuple Mode Active
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Item-level constraints are defined per-position below. Each position can have its own type and constraints.
            </Typography>
          </Box>
        )}

        {/* No constraints message for boolean and null types */}
        {(baseType === 'boolean' || baseType === 'null') && (
          <Box sx={{ p: 3, bgcolor: '#f8fafc', borderRadius: 2, border: '1px dashed #cbd5e1', textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No additional constraints available
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {baseType === 'boolean'
                ? 'Boolean values are either true or false'
                : 'Null type is always null'}
            </Typography>
          </Box>
        )}

        {/* String Constraints */}
        {baseType === 'string' && !data.tupleMode && (
          <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 2, color: '#334155' }}>
              String Constraints
              {isArray && <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>(per item)</Typography>}
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 2 }}>
              <TextField
                label="Format"
                size={size}
                fullWidth
                value={data.format || ''}
                onChange={(e) => onChange('format', e.target.value)}
                placeholder="date, email, uri, uuid..."
                helperText="Standard format hint"
              />

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <TextField
                  label="Min Length"
                  type="number"
                  size={size}
                  fullWidth
                  value={data.minLength || ''}
                  onChange={(e) => onChange('minLength', e.target.value)}
                  inputProps={{ min: 0 }}
                />
                <TextField
                  label="Max Length"
                  type="number"
                  size={size}
                  fullWidth
                  value={data.maxLength || ''}
                  onChange={(e) => onChange('maxLength', e.target.value)}
                  inputProps={{ min: 0 }}
                />
              </Box>
            </Box>

            <TextField
              label="Pattern (Regex)"
              size={size}
              fullWidth
              value={data.pattern || ''}
              onChange={(e) => onChange('pattern', e.target.value)}
              placeholder="e.g., ^[A-Z]{3}$"
              helperText="Regular expression for validation"
              sx={{
                mb: 1,
                '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.875rem' }
              }}
            />

            <RegexTester pattern={data.pattern || ''} />
          </Box>
        )}

        {/* Number/Integer Constraints */}
        {(baseType === 'number' || baseType === 'integer') && !data.tupleMode && (
          <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 2, color: '#334155' }}>
              Numeric Constraints
              {isArray && <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>(per item)</Typography>}
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 2 }}>
              {/* Minimum */}
              <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 1, border: '1px solid #e2e8f0' }}>
                <TextField
                  label="Minimum"
                  type="number"
                  size={size}
                  fullWidth
                  value={data.minimum || ''}
                  onChange={(e) => {
                    onChange('minimum', e.target.value);
                    if (e.target.value && !data.minimumType) {
                      onChange('minimumType', 'inclusive');
                    } else if (!e.target.value) {
                      onChange('minimumType', undefined);
                    }
                  }}
                  sx={{ mb: 1 }}
                />
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Radio
                        checked={data.minimumType === 'inclusive' || !data.minimumType}
                        onChange={() => onChange('minimumType', 'inclusive')}
                        disabled={!data.minimum}
                        size="small"
                      />
                    }
                    label={<Typography variant="caption">≥ inclusive</Typography>}
                    sx={{ m: 0 }}
                  />
                  <FormControlLabel
                    control={
                      <Radio
                        checked={data.minimumType === 'exclusive'}
                        onChange={() => onChange('minimumType', 'exclusive')}
                        disabled={!data.minimum}
                        size="small"
                      />
                    }
                    label={<Typography variant="caption">&gt; exclusive</Typography>}
                    sx={{ m: 0 }}
                  />
                </Box>
              </Box>

              {/* Maximum */}
              <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 1, border: '1px solid #e2e8f0' }}>
                <TextField
                  label="Maximum"
                  type="number"
                  size={size}
                  fullWidth
                  value={data.maximum || ''}
                  onChange={(e) => {
                    onChange('maximum', e.target.value);
                    if (e.target.value && !data.maximumType) {
                      onChange('maximumType', 'inclusive');
                    } else if (!e.target.value) {
                      onChange('maximumType', undefined);
                    }
                  }}
                  sx={{ mb: 1 }}
                />
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Radio
                        checked={data.maximumType === 'inclusive' || !data.maximumType}
                        onChange={() => onChange('maximumType', 'inclusive')}
                        disabled={!data.maximum}
                        size="small"
                      />
                    }
                    label={<Typography variant="caption">≤ inclusive</Typography>}
                    sx={{ m: 0 }}
                  />
                  <FormControlLabel
                    control={
                      <Radio
                        checked={data.maximumType === 'exclusive'}
                        onChange={() => onChange('maximumType', 'exclusive')}
                        disabled={!data.maximum}
                        size="small"
                      />
                    }
                    label={<Typography variant="caption">&lt; exclusive</Typography>}
                    sx={{ m: 0 }}
                  />
                </Box>
              </Box>
            </Box>

            <TextField
              label="Multiple Of"
              type="number"
              size={size}
              fullWidth
              value={data.multipleOf || ''}
              onChange={(e) => onChange('multipleOf', e.target.value)}
              helperText="Value must be divisible by this number"
            />
          </Box>
        )}

        {/* Array Constraints */}
        {isArray && (
          <Box sx={{ p: 2, bgcolor: '#fefce8', borderRadius: 2, border: '1px solid #fef08a', mt: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 2, color: '#854d0e' }}>
              Array Constraints
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2, mb: 2 }}>
              <TextField
                label="Min Items"
                type="number"
                size={size}
                fullWidth
                value={data.minItems || ''}
                onChange={(e) => onChange('minItems', e.target.value)}
                inputProps={{ min: 0 }}
              />
              <TextField
                label="Max Items"
                type="number"
                size={size}
                fullWidth
                value={data.maxItems || ''}
                onChange={(e) => onChange('maxItems', e.target.value)}
                inputProps={{ min: 0 }}
              />
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                p: 1.5,
                bgcolor: data.uniqueItems ? '#f0fdf4' : 'white',
                borderRadius: 1,
                border: 1,
                borderColor: data.uniqueItems ? '#86efac' : 'divider',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={() => onChange('uniqueItems', !data.uniqueItems)}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={data.uniqueItems || false}
                      onChange={(e) => onChange('uniqueItems', e.target.checked)}
                      size="small"
                    />
                  }
                  label={<Typography variant="body2">Unique Items</Typography>}
                  sx={{ m: 0 }}
                />
              </Box>
            </Box>

            {/* Contains Schema - collapsible advanced feature */}
            <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 1, border: '1px dashed #e2e8f0' }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748b', display: 'block', mb: 1 }}>
                Contains Schema (OpenAPI 3.1)
              </Typography>
              <TextField
                size={size}
                fullWidth
                multiline
                rows={2}
                value={data.contains || ''}
                onChange={(e) => {
                  onChange('contains', e.target.value);
                  if (!e.target.value.trim()) {
                    onChange('minContains', undefined);
                    onChange('maxContains', undefined);
                  }
                }}
                placeholder='{"type": "string", "minLength": 5}'
                helperText="At least one item must match this schema"
                sx={{
                  '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.8rem' }
                }}
              />

              <Collapse in={!!(data.contains && data.contains.trim())}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 2 }}>
                  <TextField
                    label="Min Contains"
                    type="number"
                    size={size}
                    fullWidth
                    value={data.minContains || ''}
                    onChange={(e) => onChange('minContains', e.target.value)}
                    inputProps={{ min: 1 }}
                  />
                  <TextField
                    label="Max Contains"
                    type="number"
                    size={size}
                    fullWidth
                    value={data.maxContains || ''}
                    onChange={(e) => onChange('maxContains', e.target.value)}
                    inputProps={{ min: 1 }}
                  />
                </Box>
              </Collapse>
            </Box>

            {/* Tuple Mode - OpenAPI 3.1 prefixItems */}
            <Box sx={{ mt: 2, p: 2, bgcolor: 'white', borderRadius: 1, border: '1px solid #e2e8f0' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={data.tupleMode || false}
                    onChange={(e) => {
                      onChange('tupleMode', e.target.checked);
                      if (!e.target.checked) {
                        onChange('prefixItems', undefined);
                      } else if (!data.prefixItems) {
                        onChange('prefixItems', []);
                      }
                    }}
                    size="small"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Tuple Mode (prefixItems)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Define ordered schemas for specific array positions
                    </Typography>
                  </Box>
                }
                sx={{ m: 0 }}
              />

              <Collapse in={data.tupleMode}>
                <Box sx={{ mt: 2 }}>
                  <PrefixItemsEditor
                    value={data.prefixItems || []}
                    onChange={(items) => onChange('prefixItems', items)}
                  />

                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748b', display: 'block', mb: 1 }}>
                      Items Schema (beyond prefix positions)
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      size={size}
                      value={data.itemsSchema || ''}
                      onChange={(e) => onChange('itemsSchema', e.target.value)}
                      placeholder='{"type": "string"}'
                      helperText="Schema for items beyond defined positions"
                      sx={{
                        '& textarea': { fontFamily: 'monospace', fontSize: '0.8rem' },
                      }}
                    />
                  </Box>
                </Box>
              </Collapse>
            </Box>
          </Box>
        )}

        {/* Object Constraints */}
        {baseType === 'object' && (
          <Box sx={{ p: 2, bgcolor: '#f0fdf4', borderRadius: 2, border: '1px solid #bbf7d0' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 2, color: '#166534' }}>
              Object Constraints
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2 }}>
              <TextField
                label="Min Properties"
                type="number"
                size={size}
                fullWidth
                value={data.minProperties || ''}
                onChange={(e) => onChange('minProperties', e.target.value)}
                inputProps={{ min: 0 }}
              />
              <TextField
                label="Max Properties"
                type="number"
                size={size}
                fullWidth
                value={data.maxProperties || ''}
                onChange={(e) => onChange('maxProperties', e.target.value)}
                inputProps={{ min: 0 }}
              />
            </Box>

            <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 1, border: '1px solid #e2e8f0' }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748b', display: 'block', mb: 1 }}>
                Additional Properties
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <FormControlLabel
                  control={<Radio checked={data.additionalProperties === 'default'} onChange={() => onChange('additionalProperties', 'default')} size="small" />}
                  label={<Typography variant="body2">Default (allows additional)</Typography>}
                  sx={{ m: 0 }}
                />
                <FormControlLabel
                  control={<Radio checked={data.additionalProperties === 'true'} onChange={() => onChange('additionalProperties', 'true')} size="small" />}
                  label={<Typography variant="body2">Allow additional properties</Typography>}
                  sx={{ m: 0 }}
                />
                <FormControlLabel
                  control={<Radio checked={data.additionalProperties === 'false'} onChange={() => onChange('additionalProperties', 'false')} size="small" />}
                  label={<Typography variant="body2">Strict (no extra properties)</Typography>}
                  sx={{ m: 0 }}
                />
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      {/* ═══════════════════════════════════════════════════════════════════════════
          SECTION 4: Values (Const & Enum)
          ═══════════════════════════════════════════════════════════════════════════ */}
      {(baseType === 'string' || baseType === 'number' || baseType === 'integer' || baseType === 'boolean') && (
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', bgcolor: '#fafafa' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CodeIcon sx={{ color: '#6366f1', fontSize: 20 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Allowed Values
            </Typography>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            {/* Constant Value */}
            <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#334155' }}>
                Constant Value
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Use when property must have exactly one specific value
              </Typography>
              <TextField
                label="Const"
                size={size}
                fullWidth
                type={baseType === 'string' || baseType === 'boolean' ? 'text' : 'number'}
                value={data.const || ''}
                onChange={(e) => {
                  onChange('const', e.target.value);
                  if (e.target.value && data.enum && data.enum.length > 0) {
                    onChange('enum', []);
                  }
                }}
                placeholder={
                  baseType === 'boolean' ? 'true or false' :
                  baseType === 'integer' ? '42' :
                  baseType === 'number' ? '3.14' : 'value'
                }
                disabled={!!data.enum && data.enum.length > 0}
                sx={{
                  '& .MuiInputBase-input': { fontFamily: 'monospace' },
                }}
              />
              {data.const && (
                <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#eff6ff', borderRadius: 1, border: '1px solid #bfdbfe' }}>
                  <Typography variant="caption" sx={{ color: '#1e40af' }}>
                    ✓ Only accepts: <code style={{ fontWeight: 600 }}>{data.const}</code>
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Enum Values */}
            {baseType !== 'boolean' && (
              <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                      Enum Values
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      List of allowed values
                    </Typography>
                  </Box>
                  {data.enum && data.enum.length > 1 && (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Sort A-Z">
                        <IconButton onClick={handleSortEnumAZ} size="small" disabled={!!data.const}>
                          <SortByAlphaIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Sort Z-A">
                        <IconButton onClick={handleSortEnumZA} size="small" disabled={!!data.const} sx={{ transform: 'scaleY(-1)' }}>
                          <SortByAlphaIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Box>

                {data.const && (
                  <Typography variant="caption" sx={{ color: '#d97706', display: 'block', mb: 1 }}>
                    ⚠️ Disabled when const is set
                  </Typography>
                )}

                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <TextField
                    size={size}
                    fullWidth
                    type={baseType === 'string' ? 'text' : 'number'}
                    value={enumInput}
                    onChange={(e) => { setEnumInput(e.target.value); setEnumError(''); }}
                    onKeyDown={handleEnumKeyPress}
                    error={!!enumError}
                    helperText={enumError}
                    placeholder="Add value..."
                    disabled={!!data.const}
                  />
                  <IconButton onClick={handleAddEnum} color="primary" disabled={!enumInput.trim() || !!data.const}>
                    <AddIcon />
                  </IconButton>
                </Box>

                {data.enum && data.enum.length > 0 && (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleEnumDragEnd}>
                    <List dense sx={{ bgcolor: '#f8fafc', borderRadius: 1, maxHeight: 150, overflow: 'auto', border: '1px solid #e2e8f0' }}>
                      <SortableContext items={data.enum} strategy={verticalListSortingStrategy}>
                        {data.enum.map((value) => (
                          <SortableEnumItem key={value} id={value} value={value} onDelete={handleRemoveEnum} />
                        ))}
                      </SortableContext>
                    </List>
                  </DndContext>
                )}
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          SECTION 5: Advanced (NOT Composition, External Docs, Extensions)
          ═══════════════════════════════════════════════════════════════════════════ */}
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CodeIcon sx={{ color: '#6366f1', fontSize: 20 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Advanced
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
          {/* NOT Composition */}
          <Box sx={{ p: 2, bgcolor: '#fef2f2', borderRadius: 2, border: '1px solid #fecaca' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#991b1b' }}>
              NOT Schema
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Data must NOT match this schema (exclusion rule)
            </Typography>
            <TextField
              size={size}
              fullWidth
              multiline
              rows={3}
              value={data.not || ''}
              onChange={(e) => onChange('not', e.target.value)}
              placeholder='{"type": "string", "maxLength": 0}'
              sx={{
                bgcolor: 'white',
                '& textarea': { fontFamily: 'monospace', fontSize: '0.8rem' },
              }}
            />
            {data.not && data.not.trim() && (
              <Box sx={{ mt: 1.5, p: 1.5, bgcolor: 'white', borderRadius: 1, border: '1px solid #fecaca' }}>
                <Typography variant="caption" sx={{ color: '#991b1b' }}>
                  ✗ Values matching this schema will be rejected
                </Typography>
              </Box>
            )}
          </Box>

          {/* External Documentation */}
          <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 2, border: '1px solid #e2e8f0' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <OpenInNewIcon sx={{ color: '#6366f1', fontSize: 16 }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                External Documentation
              </Typography>
            </Box>

            <TextField
              label="URL"
              size={size}
              fullWidth
              type="url"
              value={data.externalDocsUrl || ''}
              onChange={(e) => onChange('externalDocsUrl', e.target.value)}
              placeholder="https://docs.example.com/..."
              sx={{ mb: 2 }}
              InputProps={{
                endAdornment: data.externalDocsUrl?.trim() && (
                  <InputAdornment position="end">
                    <Tooltip title="Open in new tab">
                      <IconButton
                        size="small"
                        onClick={() => {
                          const url = data.externalDocsUrl?.trim();
                          if (url) window.open(url, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Description"
              size={size}
              fullWidth
              multiline
              rows={2}
              value={data.externalDocsDescription || ''}
              onChange={(e) => onChange('externalDocsDescription', e.target.value)}
              placeholder="Brief description..."
            />
          </Box>
        </Box>

        {/* Extensions */}
        <Box sx={{ mt: 3, p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
          <ExtensionsEditor
            value={data.extensions || {}}
            onChange={(extensions) => onChange('extensions', extensions)}
            size={size}
          />
        </Box>
      </Box>
    </Box>
  );
};

