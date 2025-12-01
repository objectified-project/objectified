'use client';

import React from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { RegexTester } from './RegexTester';

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
  exclusiveMinimum?: boolean;
  exclusiveMaximum?: boolean;
  multipleOf?: string;

  // Array constraints
  minItems?: string;
  maxItems?: string;
  uniqueItems?: boolean;

  // Common constraints
  enum?: string[];
  default?: string;

  // Metadata
  required?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;
  example?: string;
}

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
}

export const PropertyFormFields: React.FC<PropertyFormFieldsProps> = ({
  baseType,
  isArray,
  data,
  onChange,
  showMetadata = true,
  showTitle = true,
  size = 'medium',
}) => {
  const [enumInput, setEnumInput] = React.useState('');
  const [enumError, setEnumError] = React.useState('');

  const handleAddEnum = () => {
    if (!enumInput.trim()) {
      setEnumError('Enum value cannot be empty');
      return;
    }

    if (data.enum?.includes(enumInput.trim())) {
      setEnumError('This value already exists');
      return;
    }

    onChange('enum', [...(data.enum || []), enumInput.trim()]);
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

  return (
    <Box>
      {/* Basic Fields */}
      {showTitle && (
        <TextField
          label="Title"
          size={size}
          fullWidth
          value={data.title || ''}
          onChange={(e) => onChange('title', e.target.value)}
          helperText="Optional display title for the property"
          sx={{ mb: 2 }}
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
        helperText="Optional description for the property"
        sx={{ mb: 2 }}
      />

      {/* String Constraints */}
      {baseType === 'string' && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            String Constraints
          </Typography>
          {isArray && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              These constraints apply to each string item in the array
            </Typography>
          )}

          <TextField
            label="Format"
            size={size}
            fullWidth
            value={data.format || ''}
            onChange={(e) => onChange('format', e.target.value)}
            helperText="e.g., date, date-time, email, uri, uuid"
            sx={{ mb: 2 }}
          />

          <TextField
            label="Pattern (Regex)"
            size={size}
            fullWidth
            value={data.pattern || ''}
            onChange={(e) => onChange('pattern', e.target.value)}
            placeholder="e.g., ^[A-Z]{3}$"
            helperText="Regular expression pattern for validation"
            sx={{ mb: 2 }}
          />

          <RegexTester pattern={data.pattern || ''} />

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
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
      )}

      {/* Number/Integer Constraints */}
      {(baseType === 'number' || baseType === 'integer') && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Numeric Constraints
          </Typography>
          {isArray && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              These constraints apply to each {baseType} item in the array
            </Typography>
          )}

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
            <Box>
              <TextField
                label="Minimum"
                type="number"
                size={size}
                fullWidth
                value={data.minimum || ''}
                onChange={(e) => onChange('minimum', e.target.value)}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={data.exclusiveMinimum || false}
                    onChange={(e) => onChange('exclusiveMinimum', e.target.checked)}
                    disabled={!data.minimum}
                    size={size}
                  />
                }
                label={<Typography>Exclusive Minimum</Typography>}
                sx={{ mt: 0.5 }}
              />
            </Box>
            <Box>
              <TextField
                label="Maximum"
                type="number"
                size={size}
                fullWidth
                value={data.maximum || ''}
                onChange={(e) => onChange('maximum', e.target.value)}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={data.exclusiveMaximum || false}
                    onChange={(e) => onChange('exclusiveMaximum', e.target.checked)}
                    disabled={!data.maximum}
                    size={size}
                  />
                }
                label={<Typography>Exclusive Maximum</Typography>}
                sx={{ mt: 0.5 }}
              />
            </Box>
          </Box>

          <TextField
            label="Multiple Of"
            type="number"
            size={size}
            fullWidth
            value={data.multipleOf || ''}
            onChange={(e) => onChange('multipleOf', e.target.value)}
            helperText="Value must be a multiple of this number"
            sx={{ mb: 2 }}
          />
        </Box>
      )}

      {/* Array Constraints */}
      {isArray && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Array Constraints
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
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
          </Box>

          <FormControlLabel
            control={
              <Checkbox
                checked={data.uniqueItems || false}
                onChange={(e) => onChange('uniqueItems', e.target.checked)}
                size={size}
              />
            }
            label="Unique Items (no duplicates)"
          />
        </Box>
      )}

      {/* Enum Values */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Allowed Values (Enum)
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <TextField
            label="Add Enum Value"
            size={size}
            fullWidth
            value={enumInput}
            onChange={(e) => {
              setEnumInput(e.target.value);
              setEnumError('');
            }}
            onKeyDown={handleEnumKeyPress}
            error={!!enumError}
            helperText={enumError || 'Press Enter to add'}
          />
          <IconButton
            onClick={handleAddEnum}
            color="primary"
            disabled={!enumInput.trim()}
          >
            <AddIcon />
          </IconButton>
        </Box>

        {data.enum && data.enum.length > 0 && (
          <List dense sx={{ bgcolor: 'action.hover', borderRadius: 1, maxHeight: 150, overflow: 'auto' }}>
            {data.enum.map((value, index) => (
              <ListItem
                key={index}
                secondaryAction={
                  <IconButton edge="end" onClick={() => handleRemoveEnum(value)} size="small">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
                sx={{
                  borderBottom: index < data.enum!.length - 1 ? 1 : 0,
                  borderColor: 'divider'
                }}
              >
                <ListItemText
                  primary={value}
                  primaryTypographyProps={{
                    fontFamily: 'monospace',
                    fontSize: '0.875rem'
                  }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* Default Value */}
      <TextField
        label="Default Value"
        size={size}
        fullWidth
        value={data.default || ''}
        onChange={(e) => onChange('default', e.target.value)}
        helperText="JSON value for default"
        sx={{ mb: 2 }}
      />

      {/* Metadata Fields */}
      {showMetadata && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Metadata
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={data.required || false}
                  onChange={(e) => onChange('required', e.target.checked)}
                  size={size}
                />
              }
              label="Required"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={data.readOnly || false}
                  onChange={(e) => {
                    onChange('readOnly', e.target.checked);
                    if (e.target.checked) onChange('writeOnly', false);
                  }}
                  size={size}
                />
              }
              label="Read Only"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={data.writeOnly || false}
                  onChange={(e) => {
                    onChange('writeOnly', e.target.checked);
                    if (e.target.checked) onChange('readOnly', false);
                  }}
                  size={size}
                />
              }
              label="Write Only"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={data.deprecated || false}
                  onChange={(e) => onChange('deprecated', e.target.checked)}
                  size={size}
                />
              }
              label="Deprecated"
            />
          </Box>

          <TextField
            label="Example"
            size={size}
            fullWidth
            multiline
            rows={2}
            value={data.example || ''}
            onChange={(e) => onChange('example', e.target.value)}
            helperText="JSON example value"
            sx={{ mt: 2 }}
          />
        </Box>
      )}
    </Box>
  );
};

