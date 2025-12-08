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
import Box from '@mui/material/Box';
import { PropertyFormFields, PropertyFormData } from './PropertyFormFields';

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

interface PropertyDialogProps {
  open: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  property: PropertyItem | null;
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
  onSubmit,
}) => {
  const [viewMode, setViewMode] = useState<'form' | 'json'>('form');
  const [propertyName, setPropertyName] = useState('');
  const [propertyType, setPropertyType] = useState('string');
  const [propertyIsArray, setPropertyIsArray] = useState(false);
  const [propertyError, setPropertyError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use shared form data structure
  const [formData, setFormData] = useState<PropertyFormData>({});

  // Load property data when dialog opens in edit mode
  useEffect(() => {
    if (open && property && mode === 'edit') {
      setPropertyName(property.name);

      // Check if property is an array type
      const isArray = property.type === 'array';
      setPropertyIsArray(isArray);

      // Determine the actual type
      // Note: Actual $ref values (class references) are managed via canvas connections
      if (isArray && (property as any).items) {
        const items = (property as any).items;
        if (items.$ref) {
          // Has a $ref - this is a reference type
          setPropertyType('$ref');
        } else {
          setPropertyType(items.type || 'string');
        }
      } else if (property.$ref) {
        // Has a direct $ref - this is a reference type
        setPropertyType('$ref');
      } else {
        setPropertyType(property.type || 'string');
      }

      setFormData({
        title: property.title || '',
        description: property.description || '',
        format: property.format || '',
        pattern: property.pattern || '',
        minLength: property.minLength?.toString() || '',
        maxLength: property.maxLength?.toString() || '',
        minimum: property.minimum?.toString() || '',
        maximum: property.maximum?.toString() || '',
        exclusiveMinimum: property.exclusiveMinimum || false,
        exclusiveMaximum: property.exclusiveMaximum || false,
        multipleOf: property.multipleOf?.toString() || '',
        minItems: property.minItems?.toString() || '',
        maxItems: property.maxItems?.toString() || '',
        uniqueItems: property.uniqueItems || false,
        enum: property.enum || [],
        default: property.default?.toString() || '',
        required: property.required || false,
      });
      setPropertyError('');
    } else if (open && mode === 'add') {
      // Reset all fields for add mode
      setViewMode('form');
      setPropertyName('');
      setPropertyType('string');
      setPropertyIsArray(false);
      setFormData({});
      setPropertyError('');
    }
  }, [open, property, mode]);

  // Helper function to build JSON Schema definition from current form state
  const buildPropertyJsonSchema = () => {
    const schema: any = {};

    if (formData.title) schema.title = formData.title;
    if (formData.description) schema.description = formData.description;

    if (propertyIsArray) {
      schema.type = 'array';
      if (formData.minItems) schema.minItems = parseInt(formData.minItems);
      if (formData.maxItems) schema.maxItems = parseInt(formData.maxItems);
      if (formData.uniqueItems) schema.uniqueItems = true;

      const itemsSchema: any = {
        type: propertyType
      };
      if (formData.format) itemsSchema.format = formData.format;
      if (formData.pattern) itemsSchema.pattern = formData.pattern;
      if (formData.minLength) itemsSchema.minLength = parseInt(formData.minLength);
      if (formData.maxLength) itemsSchema.maxLength = parseInt(formData.maxLength);
      if (formData.minimum) {
        if (formData.exclusiveMinimum) {
          itemsSchema.exclusiveMinimum = parseFloat(formData.minimum);
        } else {
          itemsSchema.minimum = parseFloat(formData.minimum);
        }
      }
      if (formData.maximum) {
        if (formData.exclusiveMaximum) {
          itemsSchema.exclusiveMaximum = parseFloat(formData.maximum);
        } else {
          itemsSchema.maximum = parseFloat(formData.maximum);
        }
      }
      if (formData.multipleOf) itemsSchema.multipleOf = parseFloat(formData.multipleOf);
      if (formData.enum && formData.enum.length > 0) itemsSchema.enum = formData.enum;
      if (formData.default) itemsSchema.default = formData.default;

      schema.items = itemsSchema;
    } else {
      schema.type = propertyType;
      if (formData.format) schema.format = formData.format;
      if (formData.pattern) schema.pattern = formData.pattern;
      if (formData.minLength) schema.minLength = parseInt(formData.minLength);
      if (formData.maxLength) schema.maxLength = parseInt(formData.maxLength);
      if (formData.minimum) {
        if (formData.exclusiveMinimum) {
          schema.exclusiveMinimum = parseFloat(formData.minimum);
        } else {
          schema.minimum = parseFloat(formData.minimum);
        }
      }
      if (formData.maximum) {
        if (formData.exclusiveMaximum) {
          schema.exclusiveMaximum = parseFloat(formData.maximum);
        } else {
          schema.maximum = parseFloat(formData.maximum);
        }
      }
      if (formData.multipleOf) schema.multipleOf = parseFloat(formData.multipleOf);
      if (formData.enum && formData.enum.length > 0) schema.enum = formData.enum;
      if (formData.default) schema.default = formData.default;
    }

    return schema;
  };

  const handleSubmit = async () => {
    if (!propertyName.trim()) {
      setPropertyError('Property name is required');
      return;
    }

    // Validate property name contains only A-Za-z0-9_
    if (!/^[A-Za-z0-9_]+$/.test(propertyName)) {
      setPropertyError('Property name can only contain letters, numbers, and underscores');
      return;
    }

    setIsSubmitting(true);
    setPropertyError('');

    try {
      const dataObject: any = {
        required: formData.required,
      };

      if (formData.title) dataObject.title = formData.title;

      if (propertyIsArray) {
        dataObject.type = 'array';
        if (formData.minItems) dataObject.minItems = parseInt(formData.minItems);
        if (formData.maxItems) dataObject.maxItems = parseInt(formData.maxItems);
        if (formData.uniqueItems) dataObject.uniqueItems = true;

        const itemsSchema: any = {
          type: propertyType
        };
        if (formData.format) itemsSchema.format = formData.format;
        if (formData.pattern) itemsSchema.pattern = formData.pattern;
        if (formData.minLength) itemsSchema.minLength = parseInt(formData.minLength);
        if (formData.maxLength) itemsSchema.maxLength = parseInt(formData.maxLength);
        if (formData.minimum) {
          if (formData.exclusiveMinimum) {
            itemsSchema.exclusiveMinimum = parseFloat(formData.minimum);
          } else {
            itemsSchema.minimum = parseFloat(formData.minimum);
          }
        }
        if (formData.maximum) {
          if (formData.exclusiveMaximum) {
            itemsSchema.exclusiveMaximum = parseFloat(formData.maximum);
          } else {
            itemsSchema.maximum = parseFloat(formData.maximum);
          }
        }
        if (formData.multipleOf) itemsSchema.multipleOf = parseFloat(formData.multipleOf);
        if (formData.enum && formData.enum.length > 0) itemsSchema.enum = formData.enum;
        if (formData.default) itemsSchema.default = formData.default;

        dataObject.items = itemsSchema;
      } else {
        dataObject.type = propertyType;
        if (formData.format) dataObject.format = formData.format;
        if (formData.pattern) dataObject.pattern = formData.pattern;
        if (formData.minLength) dataObject.minLength = parseInt(formData.minLength);
        if (formData.maxLength) dataObject.maxLength = parseInt(formData.maxLength);
        if (formData.minimum) {
          if (formData.exclusiveMinimum) {
            dataObject.exclusiveMinimum = parseFloat(formData.minimum);
          } else {
            dataObject.minimum = parseFloat(formData.minimum);
          }
        }
        if (formData.maximum) {
          if (formData.exclusiveMaximum) {
            dataObject.exclusiveMaximum = parseFloat(formData.maximum);
          } else {
            dataObject.maximum = parseFloat(formData.maximum);
          }
        }
        if (formData.multipleOf) dataObject.multipleOf = parseFloat(formData.multipleOf);
        if (formData.enum && formData.enum.length > 0) dataObject.enum = formData.enum;
        if (formData.default) dataObject.default = formData.default;
      }

      await onSubmit({
        name: propertyName,
        description: formData.description || null,
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
            height: '90vh',
            maxHeight: '90vh',
          }
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{mode === 'add' ? 'Add Property' : 'Edit Property'}</span>
          <Box sx={{ display: 'flex', border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
            <Button
              size="small"
              variant={viewMode === 'form' ? 'contained' : 'text'}
              onClick={() => setViewMode('form')}
              sx={{ borderRadius: 0, minWidth: 'auto', px: 2 }}
            >
              Form
            </Button>
            <Box sx={{ width: '1px', bgcolor: 'divider' }} />
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
              onChange={(e) => {
                // Only allow A-Za-z0-9_ characters
                const filteredValue = e.target.value.replace(/[^A-Za-z0-9_]/g, '');
                setPropertyName(filteredValue);
              }}
              helperText="Only letters, numbers, and underscores are allowed. Suggest camelCase property names."
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
                }}
                SelectProps={{ native: true }}
                disabled={mode === 'edit'}
                helperText={mode === 'edit' ? 'Type cannot be changed after creation' : ''}
                sx={{ flex: 1 }}
              >
                <option value="string">string</option>
                <option value="number">number</option>
                <option value="integer">integer</option>
                <option value="boolean">boolean</option>
                <option value="object">object</option>
                <option value="null">null</option>
              </TextField>
            </Box>

            <PropertyFormFields
              baseType={propertyType}
              isArray={propertyIsArray}
              data={formData}
              onChange={(field, value) => {
                setFormData(prev => ({ ...prev, [field]: value }));
              }}
              showMetadata={true}
              showTitle={true}
              size="medium"
            />
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

