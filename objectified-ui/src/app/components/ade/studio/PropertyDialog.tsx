'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Box from '@mui/material/Box';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

// Dynamically import Monaco Editor with SSR disabled
const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#666' }}>Loading editor...</div>
    </div>
  ),
});

export interface PropertyItem {
  id: string;
  name: string;
  type?: string;
  $ref?: string;
  title?: string;
  description?: string;
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: boolean;
  exclusiveMaximum?: boolean;
  multipleOf?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  enum?: string[];
  default?: any;
  required?: boolean;
}

export interface ClassItem {
  id: string;
  name: string;
  description?: string;
  schema?: any;
}

interface PropertyDialogProps {
  open: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  property: PropertyItem | null;
  classes: ClassItem[];
  onSubmit: (propertyData: {
    name: string;
    description: string | null;
    data: any;
  }) => Promise<void>;
}

export const PropertyDialog: React.FC<PropertyDialogProps> = ({
  open,
  onClose,
  mode,
  property,
  classes,
  onSubmit,
}) => {
  const [viewMode, setViewMode] = useState<'form' | 'json'>('form');
  const [propertyName, setPropertyName] = useState('');
  const [propertyType, setPropertyType] = useState('string');
  const [propertyIsArray, setPropertyIsArray] = useState(false);
  const [propertyRef, setPropertyRef] = useState('');
  const [propertyTitle, setPropertyTitle] = useState('');
  const [propertyDescription, setPropertyDescription] = useState('');
  const [propertyFormat, setPropertyFormat] = useState('');
  const [propertyPattern, setPropertyPattern] = useState('');
  const [propertyMinLength, setPropertyMinLength] = useState('');
  const [propertyMaxLength, setPropertyMaxLength] = useState('');
  const [propertyMinimum, setPropertyMinimum] = useState('');
  const [propertyMaximum, setPropertyMaximum] = useState('');
  const [propertyExclusiveMinimum, setPropertyExclusiveMinimum] = useState(false);
  const [propertyExclusiveMaximum, setPropertyExclusiveMaximum] = useState(false);
  const [propertyMultipleOf, setPropertyMultipleOf] = useState('');
  const [propertyMinItems, setPropertyMinItems] = useState('');
  const [propertyMaxItems, setPropertyMaxItems] = useState('');
  const [propertyUniqueItems, setPropertyUniqueItems] = useState(false);
  const [propertyEnum, setPropertyEnum] = useState<string[]>([]);
  const [propertyEnumInput, setPropertyEnumInput] = useState('');
  const [propertyEnumError, setPropertyEnumError] = useState('');
  const [propertyDefault, setPropertyDefault] = useState('');
  const [propertyRequired, setPropertyRequired] = useState(false);
  const [propertyError, setPropertyError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load property data when dialog opens in edit mode
  useEffect(() => {
    if (open && property && mode === 'edit') {
      setPropertyName(property.name);

      // Check if property is an array type
      const isArray = property.type === 'array';
      setPropertyIsArray(isArray);

      // Determine the actual type
      if (property.$ref) {
        setPropertyType('$ref');
        setPropertyRef(property.$ref);
      } else if (isArray && (property as any).items) {
        const items = (property as any).items;
        if (items.$ref) {
          setPropertyType('$ref');
          setPropertyRef(items.$ref);
        } else {
          setPropertyType(items.type || 'string');
          setPropertyRef('');
        }
      } else {
        setPropertyType(property.type || 'string');
        setPropertyRef('');
      }

      setPropertyTitle(property.title || '');
      setPropertyDescription(property.description || '');
      setPropertyFormat(property.format || '');
      setPropertyPattern(property.pattern || '');
      setPropertyMinLength(property.minLength?.toString() || '');
      setPropertyMaxLength(property.maxLength?.toString() || '');
      setPropertyMinimum(property.minimum?.toString() || '');
      setPropertyMaximum(property.maximum?.toString() || '');
      setPropertyExclusiveMinimum(property.exclusiveMinimum || false);
      setPropertyExclusiveMaximum(property.exclusiveMaximum || false);
      setPropertyMultipleOf(property.multipleOf?.toString() || '');
      setPropertyMinItems(property.minItems?.toString() || '');
      setPropertyMaxItems(property.maxItems?.toString() || '');
      setPropertyUniqueItems(property.uniqueItems || false);
      setPropertyEnum(property.enum || []);
      setPropertyDefault(property.default?.toString() || '');
      setPropertyRequired(property.required || false);
      setPropertyError('');
      setPropertyEnumInput('');
      setPropertyEnumError('');
    } else if (open && mode === 'add') {
      // Reset all fields for add mode
      setViewMode('form');
      setPropertyName('');
      setPropertyType('string');
      setPropertyIsArray(false);
      setPropertyRef('');
      setPropertyTitle('');
      setPropertyDescription('');
      setPropertyFormat('');
      setPropertyPattern('');
      setPropertyMinLength('');
      setPropertyMaxLength('');
      setPropertyMinimum('');
      setPropertyMaximum('');
      setPropertyExclusiveMinimum(false);
      setPropertyExclusiveMaximum(false);
      setPropertyMultipleOf('');
      setPropertyMinItems('');
      setPropertyMaxItems('');
      setPropertyUniqueItems(false);
      setPropertyEnum([]);
      setPropertyEnumInput('');
      setPropertyEnumError('');
      setPropertyDefault('');
      setPropertyRequired(false);
      setPropertyError('');
    }
  }, [open, property, mode]);

  // Helper function to build JSON Schema definition from current form state
  const buildPropertyJsonSchema = () => {
    const schema: any = {};

    if (propertyTitle) schema.title = propertyTitle;
    if (propertyDescription) schema.description = propertyDescription;

    if (propertyIsArray) {
      schema.type = 'array';
      if (propertyMinItems) schema.minItems = parseInt(propertyMinItems);
      if (propertyMaxItems) schema.maxItems = parseInt(propertyMaxItems);
      if (propertyUniqueItems) schema.uniqueItems = true;

      const itemsSchema: any = {};
      if (propertyType === '$ref') {
        itemsSchema.$ref = propertyRef;
      } else {
        itemsSchema.type = propertyType;
        if (propertyFormat) itemsSchema.format = propertyFormat;
        if (propertyPattern) itemsSchema.pattern = propertyPattern;
        if (propertyMinLength) itemsSchema.minLength = parseInt(propertyMinLength);
        if (propertyMaxLength) itemsSchema.maxLength = parseInt(propertyMaxLength);
        if (propertyMinimum) itemsSchema.minimum = parseFloat(propertyMinimum);
        if (propertyMaximum) itemsSchema.maximum = parseFloat(propertyMaximum);
        if (propertyExclusiveMinimum) itemsSchema.exclusiveMinimum = parseFloat(propertyMinimum);
        if (propertyExclusiveMaximum) itemsSchema.exclusiveMaximum = parseFloat(propertyMaximum);
        if (propertyMultipleOf) itemsSchema.multipleOf = parseFloat(propertyMultipleOf);
        if (propertyEnum.length > 0) itemsSchema.enum = propertyEnum;
        if (propertyDefault) itemsSchema.default = propertyDefault;
      }
      schema.items = itemsSchema;
    } else {
      if (propertyType === '$ref') {
        schema.$ref = propertyRef;
      } else {
        schema.type = propertyType;
        if (propertyFormat) schema.format = propertyFormat;
        if (propertyPattern) schema.pattern = propertyPattern;
        if (propertyMinLength) schema.minLength = parseInt(propertyMinLength);
        if (propertyMaxLength) schema.maxLength = parseInt(propertyMaxLength);
        if (propertyMinimum) schema.minimum = parseFloat(propertyMinimum);
        if (propertyMaximum) schema.maximum = parseFloat(propertyMaximum);
        if (propertyExclusiveMinimum) schema.exclusiveMinimum = parseFloat(propertyMinimum);
        if (propertyExclusiveMaximum) schema.exclusiveMaximum = parseFloat(propertyMaximum);
        if (propertyMultipleOf) schema.multipleOf = parseFloat(propertyMultipleOf);
        if (propertyEnum.length > 0) schema.enum = propertyEnum;
        if (propertyDefault) schema.default = propertyDefault;
      }
    }

    return schema;
  };

  const handleSubmit = async () => {
    if (!propertyName.trim()) {
      setPropertyError('Property name is required');
      return;
    }

    if (propertyType === '$ref' && !propertyRef) {
      setPropertyError('Schema reference is required when type is $ref');
      return;
    }

    setIsSubmitting(true);
    setPropertyError('');

    try {
      const dataObject: any = {
        required: propertyRequired,
      };

      if (propertyTitle) dataObject.title = propertyTitle;

      if (propertyIsArray) {
        dataObject.type = 'array';
        if (propertyMinItems) dataObject.minItems = parseInt(propertyMinItems);
        if (propertyMaxItems) dataObject.maxItems = parseInt(propertyMaxItems);

        const itemsSchema: any = {};
        if (propertyType === '$ref') {
          itemsSchema.$ref = propertyRef;
        } else {
          itemsSchema.type = propertyType;
          if (propertyFormat) itemsSchema.format = propertyFormat;
          if (propertyPattern) itemsSchema.pattern = propertyPattern;
          if (propertyMinLength) itemsSchema.minLength = parseInt(propertyMinLength);
          if (propertyMaxLength) itemsSchema.maxLength = parseInt(propertyMaxLength);
          if (propertyMinimum) itemsSchema.minimum = parseFloat(propertyMinimum);
          if (propertyMaximum) itemsSchema.maximum = parseFloat(propertyMaximum);
          if (propertyEnum.length > 0) itemsSchema.enum = propertyEnum;
          if (propertyDefault) itemsSchema.default = propertyDefault;
        }
        dataObject.items = itemsSchema;
      } else {
        if (propertyType === '$ref') {
          dataObject.$ref = propertyRef;
        } else {
          dataObject.type = propertyType;
          if (propertyFormat) dataObject.format = propertyFormat;
          if (propertyPattern) dataObject.pattern = propertyPattern;
          if (propertyMinLength) dataObject.minLength = parseInt(propertyMinLength);
          if (propertyMaxLength) dataObject.maxLength = parseInt(propertyMaxLength);
          if (propertyMinimum) dataObject.minimum = parseFloat(propertyMinimum);
          if (propertyMaximum) dataObject.maximum = parseFloat(propertyMaximum);
          if (propertyEnum.length > 0) dataObject.enum = propertyEnum;
          if (propertyDefault) dataObject.default = propertyDefault;
        }
      }

      await onSubmit({
        name: propertyName,
        description: propertyDescription || null,
        data: dataObject,
      });

      onClose();
    } catch (error) {
      console.error('Error submitting property:', error);
      setPropertyError(error instanceof Error ? error.message : 'An error occurred while saving the property');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            height: '80vh',
            maxHeight: '700px',
          }
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{mode === 'add' ? 'Add Property' : 'Edit Property'}</span>
          <Box sx={{ display: 'flex', gap: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
            <Button
              size="small"
              variant={viewMode === 'form' ? 'contained' : 'text'}
              onClick={() => setViewMode('form')}
              sx={{ borderRadius: 0, minWidth: 'auto', px: 2 }}
            >
              Form
            </Button>
            <Button
              size="small"
              variant={viewMode === 'json' ? 'contained' : 'text'}
              onClick={() => setViewMode('json')}
              sx={{ borderRadius: 0, minWidth: 'auto', px: 2 }}
            >
              JSON
            </Button>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent
        sx={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
        }}
      >
        {propertyError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {propertyError}
          </Alert>
        )}

        {viewMode === 'form' ? (
          <>
            {/* Basic Information */}
            <TextField
              autoFocus
              margin="dense"
              label="Property Name"
              type="text"
              fullWidth
              required
              value={propertyName}
              onChange={(e) => setPropertyName(e.target.value)}
              sx={{ mb: 2 }}
            />

            <TextField
              margin="dense"
              label="Title"
              type="text"
              fullWidth
              placeholder="Short, human-readable title"
              value={propertyTitle}
              onChange={(e) => setPropertyTitle(e.target.value)}
              helperText="A short, descriptive title for this property"
              sx={{ mb: 2 }}
            />

            {/* Type Selector with Array Checkbox */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', mb: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={propertyIsArray}
                    onChange={(e) => setPropertyIsArray(e.target.checked)}
                    disabled={mode === 'edit'}
                  />
                }
                label={'An array of ...'}
                sx={{ mt: 1, whiteSpace: 'nowrap' }}
              />

              <TextField
                select
                margin="dense"
                label="Type"
                required
                value={propertyType}
                onChange={(e) => {
                  const newType = e.target.value;
                  setPropertyType(newType);
                  if (newType !== '$ref') {
                    setPropertyRef('');
                  }
                }}
                SelectProps={{ native: true }}
                disabled={mode === 'edit'}
                helperText={mode === 'edit' ? 'Type cannot be changed after creation' : undefined}
                sx={{ flex: 1 }}
              >
                <option value="string">string</option>
                <option value="number">number</option>
                <option value="integer">integer</option>
                <option value="boolean">boolean</option>
                <option value="object">object</option>
                <option value="null">null</option>
                <option value="$ref">$ref (reference to class)</option>
              </TextField>
            </Box>

            {/* Schema Reference */}
            {propertyType === '$ref' && (
              <TextField
                select
                margin="dense"
                label="Schema Reference"
                fullWidth
                required
                value={propertyRef}
                onChange={(e) => setPropertyRef(e.target.value)}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true }}
                disabled={mode === 'edit'}
                helperText={mode === 'edit' ? 'Schema reference cannot be changed after creation' : 'Select a class to reference as this property\'s schema'}
                sx={{ mb: 2 }}
              >
                <option value="">Select a class...</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={`#/components/schemas/${cls.name}`}>
                    {cls.name}
                  </option>
                ))}
              </TextField>
            )}

            <TextField
              margin="dense"
              label="Description"
              type="text"
              fullWidth
              multiline
              rows={2}
              value={propertyDescription}
              onChange={(e) => setPropertyDescription(e.target.value)}
              sx={{ mb: 2 }}
            />

            {/* String-specific fields */}
            {propertyType === 'string' && (
              <>
                {propertyIsArray && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    These constraints apply to each string item in the array
                  </Typography>
                )}
                <TextField
                  select
                  margin="dense"
                  label="Format"
                  fullWidth
                  value={propertyFormat}
                  onChange={(e) => setPropertyFormat(e.target.value)}
                  SelectProps={{ native: true }}
                  InputLabelProps={{ shrink: true }}
                  helperText="Standard JSON Schema string formats"
                  sx={{ mb: 2 }}
                >
                  <option value="">No formatting applied</option>
                  <option value="date">date (RFC 3339 full-date)</option>
                  <option value="time">time (RFC 3339 full-time)</option>
                  <option value="date-time">date-time (RFC 3339 date-time)</option>
                  <option value="duration">duration (RFC 3339 duration)</option>
                  <option value="email">email (RFC 5321 email address)</option>
                  <option value="idn-email">idn-email (RFC 6531 internationalized email)</option>
                  <option value="hostname">hostname (RFC 1123 hostname)</option>
                  <option value="idn-hostname">idn-hostname (RFC 5890 internationalized hostname)</option>
                  <option value="ipv4">ipv4 (RFC 2673 IPv4 address)</option>
                  <option value="ipv6">ipv6 (RFC 2373 IPv6 address)</option>
                  <option value="uri">uri (RFC 3986 URI)</option>
                  <option value="uri-reference">uri-reference (RFC 3986 URI reference)</option>
                  <option value="iri">iri (RFC 3987 IRI)</option>
                  <option value="iri-reference">iri-reference (RFC 3987 IRI reference)</option>
                  <option value="uri-template">uri-template (RFC 6570 URI template)</option>
                  <option value="json-pointer">json-pointer (RFC 6901 JSON pointer)</option>
                  <option value="relative-json-pointer">relative-json-pointer (Relative JSON pointer)</option>
                  <option value="regex">regex (ECMA-262 regular expression)</option>
                  <option value="uuid">uuid (RFC 4122 UUID)</option>
                </TextField>

                <TextField
                  margin="dense"
                  label="Pattern (regex)"
                  type="text"
                  fullWidth
                  placeholder="e.g., ^[A-Z]{3}$"
                  value={propertyPattern}
                  onChange={(e) => setPropertyPattern(e.target.value)}
                  helperText="Regular expression pattern for validation"
                  sx={{ mb: 2 }}
                />

                <div style={{ display: 'flex', gap: '16px' }}>
                  <TextField
                    margin="dense"
                    label="Min Length"
                    type="number"
                    fullWidth
                    value={propertyMinLength}
                    onChange={(e) => setPropertyMinLength(e.target.value)}
                    sx={{ mb: 2 }}
                  />

                  <TextField
                    margin="dense"
                    label="Max Length"
                    type="number"
                    fullWidth
                    value={propertyMaxLength}
                    onChange={(e) => setPropertyMaxLength(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                </div>
              </>
            )}

            {/* Number/Integer-specific fields */}
            {(propertyType === 'number' || propertyType === 'integer') && (
              <>
                {propertyIsArray && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    These constraints apply to each {propertyType} item in the array
                  </Typography>
                )}
                <div style={{ display: 'flex', gap: '16px' }}>
                  <TextField
                    margin="dense"
                    label="Minimum"
                    type="number"
                    fullWidth
                    value={propertyMinimum}
                    onChange={(e) => setPropertyMinimum(e.target.value)}
                    sx={{ mb: 2 }}
                  />

                  <TextField
                    margin="dense"
                    label="Maximum"
                    type="number"
                    fullWidth
                    value={propertyMaximum}
                    onChange={(e) => setPropertyMaximum(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={propertyExclusiveMinimum}
                        onChange={(e) => setPropertyExclusiveMinimum(e.target.checked)}
                        disabled={!propertyMinimum}
                      />
                    }
                    label="Exclusive Minimum"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={propertyExclusiveMaximum}
                        onChange={(e) => setPropertyExclusiveMaximum(e.target.checked)}
                        disabled={!propertyMaximum}
                      />
                    }
                    label="Exclusive Maximum"
                  />
                </div>

                <TextField
                  margin="dense"
                  label="Multiple Of"
                  type="number"
                  fullWidth
                  value={propertyMultipleOf}
                  onChange={(e) => setPropertyMultipleOf(e.target.value)}
                  helperText="Value must be a multiple of this number"
                  sx={{ mb: 2 }}
                />
              </>
            )}

            {/* Array-specific fields */}
            {propertyIsArray && (
              <>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <TextField
                    margin="dense"
                    label="Min Items"
                    type="number"
                    fullWidth
                    value={propertyMinItems}
                    onChange={(e) => setPropertyMinItems(e.target.value)}
                    helperText="Minimum number of items in array"
                    sx={{ mb: 2 }}
                  />

                  <TextField
                    margin="dense"
                    label="Max Items"
                    type="number"
                    fullWidth
                    value={propertyMaxItems}
                    onChange={(e) => setPropertyMaxItems(e.target.value)}
                    helperText="Maximum number of items"
                    sx={{ mb: 2 }}
                  />
                </div>

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={propertyUniqueItems}
                      onChange={(e) => setPropertyUniqueItems(e.target.checked)}
                    />
                  }
                  label="Unique Items (all array elements must be distinct)"
                  sx={{ mb: 2 }}
                />
              </>
            )}

            {/* Enum values editor */}
            {(propertyType === 'string' || propertyType === 'number' || propertyType === 'integer') && (
              <Box sx={{ mb: 2 }}>
                {propertyIsArray && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Enumeration applies to each item - each array element must be one of these values
                  </Typography>
                )}
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <TextField
                    margin="dense"
                    label="Add Enumeration"
                    type="text"
                    fullWidth
                    placeholder="Enter a value"
                    value={propertyEnumInput}
                    onChange={(e) => {
                      setPropertyEnumInput(e.target.value);
                      setPropertyEnumError('');
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && propertyEnumInput.trim()) {
                        e.preventDefault();
                        const trimmedValue = propertyEnumInput.trim();

                        if (propertyType === 'number' || propertyType === 'integer') {
                          const numValue = Number(trimmedValue);
                          if (isNaN(numValue)) {
                            setPropertyEnumError(`Value must be a valid ${propertyType}`);
                            return;
                          }
                          if (propertyType === 'integer' && !Number.isInteger(numValue)) {
                            setPropertyEnumError('Value must be an integer (no decimals)');
                            return;
                          }
                        }

                        if (!propertyEnum.includes(trimmedValue)) {
                          setPropertyEnum([...propertyEnum, trimmedValue]);
                          setPropertyEnumInput('');
                          setPropertyEnumError('');
                        } else {
                          setPropertyEnumError('This value already exists in the enumeration');
                        }
                      }
                    }}
                    error={!!propertyEnumError}
                    helperText={propertyEnumError || "Press Enter or click + to add"}
                    sx={{ flex: 1 }}
                  />
                  <IconButton
                    color="primary"
                    onClick={() => {
                      const trimmedValue = propertyEnumInput.trim();
                      if (!trimmedValue) return;

                      if (propertyType === 'number' || propertyType === 'integer') {
                        const numValue = Number(trimmedValue);
                        if (isNaN(numValue)) {
                          setPropertyEnumError(`Value must be a valid ${propertyType}`);
                          return;
                        }
                        if (propertyType === 'integer' && !Number.isInteger(numValue)) {
                          setPropertyEnumError('Value must be an integer (no decimals)');
                          return;
                        }
                      }

                      if (!propertyEnum.includes(trimmedValue)) {
                        setPropertyEnum([...propertyEnum, trimmedValue]);
                        setPropertyEnumInput('');
                        setPropertyEnumError('');
                      } else {
                        setPropertyEnumError('This value already exists in the enumeration');
                      }
                    }}
                    disabled={!propertyEnumInput.trim()}
                    sx={{ mt: 1 }}
                  >
                    <AddIcon />
                  </IconButton>
                </Box>

                {propertyEnum.length > 0 && (
                  <Box sx={{
                    mt: 1,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    maxHeight: '200px',
                    overflow: 'auto'
                  }}>
                    <List dense disablePadding>
                      {propertyEnum.map((value, index) => (
                        <ListItem
                          key={index}
                          secondaryAction={
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={() => {
                                setPropertyEnum(propertyEnum.filter((_, i) => i !== index));
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          }
                          sx={{
                            borderBottom: index < propertyEnum.length - 1 ? 1 : 0,
                            borderColor: 'divider'
                          }}
                        >
                          <ListItemText
                            primary={value}
                            primaryTypographyProps={{
                              variant: 'body2',
                              sx: { fontFamily: 'monospace' }
                            }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </Box>
            )}

            {/* Default value */}
            {!propertyIsArray && (propertyType === 'string' || propertyType === 'number' || propertyType === 'integer' || propertyType === 'boolean') && (
              <TextField
                margin="dense"
                label="Default Value"
                type="text"
                fullWidth
                value={propertyDefault}
                onChange={(e) => setPropertyDefault(e.target.value)}
                helperText="Default value for this property"
                sx={{ mb: 2 }}
              />
            )}

            {propertyIsArray && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Note: Default values for arrays are not currently supported in this interface
              </Typography>
            )}

            {/* Boolean flags */}
            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={propertyRequired}
                    onChange={(e) => setPropertyRequired(e.target.checked)}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <span>Required</span>
                    <Typography variant="caption" color="text.secondary">
                      - Must be present in the object
                    </Typography>
                  </Box>
                }
              />
            </Box>
          </>
        ) : (
          /* JSON View */
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              JSON Schema 2020-12 Definition
            </Typography>
            <Box
              sx={{
                flex: 1,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                overflow: 'hidden',
                minHeight: '300px',
              }}
            >
              <Editor
                height="100%"
                defaultLanguage="json"
                value={JSON.stringify(buildPropertyJsonSchema(), null, 2)}
                theme="vs-light"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  lineNumbers: 'on',
                  renderWhitespace: 'none',
                  automaticLayout: true,
                  wordWrap: 'on',
                  folding: true,
                  contextmenu: false,
                  selectOnLineNumbers: true,
                  roundedSelection: false,
                  cursorStyle: 'line',
                  scrollbar: {
                    vertical: 'auto',
                    horizontal: 'auto',
                  },
                }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5 }}>
              This is the JSON Schema representation of your property definition. Switch back to Form view to make changes.
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isSubmitting}>
          {mode === 'add' ? 'Add' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PropertyDialog;

