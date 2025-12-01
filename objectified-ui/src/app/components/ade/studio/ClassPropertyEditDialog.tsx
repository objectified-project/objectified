'use client';

import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Radio from '@mui/material/Radio';
import FormControlLabel from '@mui/material/FormControlLabel';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import { updateClassProperty } from '../../../../../lib/db/helper';
import { PropertyFormFields, PropertyFormData } from './PropertyFormFields';

interface Props {
  open: boolean;
  onClose: () => void;
  editingClassProperty: any | null;
  // Callback to reload classes after a successful save
  onSaved?: () => Promise<void> | void;
  // All properties from the parent class (to show nested properties)
  allClassProperties?: Array<{
    id: string;
    name: string;
    data: any;
    description?: string;
    parent_id?: string | null;
  }>;
}

export default function ClassPropertyEditDialog({ open, onClose, editingClassProperty, onSaved, allClassProperties }: Props) {
  const [editPropName, setEditPropName] = useState('');
  const [editPropAdditionalProperties, setEditPropAdditionalProperties] = useState<'default' | 'true' | 'false'>('default');
  const [editPropertyError, setEditPropertyError] = useState('');

  // Use shared form data structure
  const [formData, setFormData] = useState<PropertyFormData>({});

  // Helper to get property type display
  const getPropertyTypeInfo = () => {
    if (!editingClassProperty) return { type: 'unknown', baseType: 'unknown', isArray: false };

    const propData = typeof editingClassProperty.data === 'string'
      ? JSON.parse(editingClassProperty.data)
      : (editingClassProperty.data || {});

    const isArray = propData.type === 'array';
    const schema = isArray ? (propData.items || {}) : propData;

    let baseType = 'unknown';
    if (schema.$ref) {
      const refParts = schema.$ref.split('/');
      baseType = refParts[refParts.length - 1] || schema.$ref;
    } else {
      baseType = schema.type || 'object';
    }

    return {
      type: isArray ? `${baseType}[]` : baseType,
      baseType,
      isArray,
      hasRef: !!schema.$ref
    };
  };

  // Initialize form when editingClassProperty changes
  useEffect(() => {
    if (!editingClassProperty) return;

    setEditPropName(editingClassProperty.name || '');

    const propData = typeof editingClassProperty.data === 'string'
      ? JSON.parse(editingClassProperty.data)
      : (editingClassProperty.data || {});

    // Handle additionalProperties - relevant for direct object or array items object
    const isArrayInlineObject = propData.type === 'array' && propData.items && propData.items.type === 'object' && !propData.items.$ref;
    const additionalPropsSource = isArrayInlineObject ? propData.items : propData;
    if (additionalPropsSource.hasOwnProperty('additionalProperties')) {
      setEditPropAdditionalProperties(additionalPropsSource.additionalProperties === false ? 'false' : 'true');
    } else {
      setEditPropAdditionalProperties('default');
    }

    // Get the actual schema (handle array types)
    const schema = propData.type === 'array' ? (propData.items || {}) : propData;

    // Populate form data
    setFormData({
      description: editingClassProperty.description || '',
      required: !!propData.required,
      deprecated: !!propData.deprecated,
      readOnly: !!propData.readOnly,
      writeOnly: !!propData.writeOnly,
      example: propData.example ? JSON.stringify(propData.example) : '',

      // String constraints
      minLength: schema.minLength?.toString() || '',
      maxLength: schema.maxLength?.toString() || '',
      pattern: schema.pattern || '',
      format: schema.format || '',

      // Number constraints
      minimum: schema.minimum?.toString() || '',
      maximum: schema.maximum?.toString() || '',
      exclusiveMinimum: !!schema.exclusiveMinimum,
      exclusiveMaximum: !!schema.exclusiveMaximum,
      multipleOf: schema.multipleOf?.toString() || '',

      // Array constraints
      minItems: propData.minItems?.toString() || '',
      maxItems: propData.maxItems?.toString() || '',
      uniqueItems: !!propData.uniqueItems,

      // Common constraints
      default: schema.default !== undefined ? JSON.stringify(schema.default) : '',
      enum: schema.enum || [],
    });

    setEditPropertyError('');
  }, [editingClassProperty]);

  const handleSave = async () => {
    if (!editingClassProperty) {
      setEditPropertyError('No property selected for editing');
      return;
    }

    if (!editPropName.trim()) {
      setEditPropertyError('Property name is required');
      return;
    }

    try {
      const originalData = typeof editingClassProperty.data === 'string'
        ? JSON.parse(editingClassProperty.data)
        : (editingClassProperty.data || {});

      const updatedData: any = {
        ...originalData,
        required: formData.required,
        deprecated: formData.deprecated,
        readOnly: formData.readOnly,
        writeOnly: formData.writeOnly,
      };

      if (formData.example?.trim()) {
        try {
          updatedData.example = JSON.parse(formData.example);
        } catch (e) {
          updatedData.example = formData.example;
        }
      } else {
        delete updatedData.example;
      }

      // Determine where to apply constraints (array items vs direct)
      const isArray = updatedData.type === 'array';
      const targetSchema = isArray ? (updatedData.items || {}) : updatedData;

      // Handle additionalProperties field (apply to direct object or array items object)
      const isArrayInlineObject = isArray && targetSchema && targetSchema.type === 'object' && !targetSchema.$ref;
      if (editPropAdditionalProperties === 'true') {
        targetSchema.additionalProperties = true;
      } else if (editPropAdditionalProperties === 'false') {
        targetSchema.additionalProperties = false;
      } else {
        delete targetSchema.additionalProperties;
      }

      // String constraints
      if (formData.minLength) targetSchema.minLength = parseInt(formData.minLength);
      else delete targetSchema.minLength;

      if (formData.maxLength) targetSchema.maxLength = parseInt(formData.maxLength);
      else delete targetSchema.maxLength;

      if (formData.pattern) targetSchema.pattern = formData.pattern;
      else delete targetSchema.pattern;

      if (formData.format) targetSchema.format = formData.format;
      else delete targetSchema.format;

      // Number constraints
      if (formData.minimum) {
        if (formData.exclusiveMinimum) {
          targetSchema.exclusiveMinimum = parseFloat(formData.minimum);
          delete targetSchema.minimum;
        } else {
          targetSchema.minimum = parseFloat(formData.minimum);
          delete targetSchema.exclusiveMinimum;
        }
      } else {
        delete targetSchema.minimum;
        delete targetSchema.exclusiveMinimum;
      }

      if (formData.maximum) {
        if (formData.exclusiveMaximum) {
          targetSchema.exclusiveMaximum = parseFloat(formData.maximum);
          delete targetSchema.maximum;
        } else {
          targetSchema.maximum = parseFloat(formData.maximum);
          delete targetSchema.exclusiveMaximum;
        }
      } else {
        delete targetSchema.maximum;
        delete targetSchema.exclusiveMaximum;
      }

      if (formData.multipleOf) targetSchema.multipleOf = parseFloat(formData.multipleOf);
      else delete targetSchema.multipleOf;

      // Array constraints (on array itself, not items)
      if (isArray) {
        if (formData.minItems) updatedData.minItems = parseInt(formData.minItems);
        else delete updatedData.minItems;

        if (formData.maxItems) updatedData.maxItems = parseInt(formData.maxItems);
        else delete updatedData.maxItems;

        if (formData.uniqueItems) updatedData.uniqueItems = true;
        else delete updatedData.uniqueItems;
      }

      // Enum values
      if (formData.enum && formData.enum.length > 0) targetSchema.enum = formData.enum;
      else delete targetSchema.enum;

      // Default value
      if (formData.default?.trim()) {
        try {
          targetSchema.default = JSON.parse(formData.default);
        } catch (e) {
          targetSchema.default = formData.default;
        }
      } else {
        delete targetSchema.default;
      }

      // Update items if it's an array
      if (isArray) {
        updatedData.items = targetSchema;
        // Ensure additionalProperties isn't left on the array level
        delete updatedData.additionalProperties;
      }

      const result = await updateClassProperty(
        editingClassProperty.id,
        editPropName.trim(),
        formData.description || null,
        updatedData
      );

      const response = JSON.parse(result);
      if (response.success) {
        // Notify parent to reload
        if (onSaved) await onSaved();
        onClose();
      } else {
        setEditPropertyError(response.error || 'Failed to update property');
      }
    } catch (error) {
      console.error('Error updating class property:', error);
      setEditPropertyError('An error occurred while updating the property');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Property in Class</DialogTitle>
      <DialogContent>
        {editPropertyError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {editPropertyError}
          </Alert>
        )}

        <Alert severity="info" sx={{ mb: 2 }}>
          When editing a property that is a member of a class, only the name and constraints can be modified. The type and base type are read-only.
        </Alert>

        {/* Type Information - Read Only */}
        {editingClassProperty && (
          <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1, border: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Property Type (Read-Only)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Chip
                label={getPropertyTypeInfo().type}
                color="primary"
                size="small"
                sx={{ fontFamily: 'monospace' }}
              />
              {getPropertyTypeInfo().hasRef && (
                <Typography variant="caption" color="text.secondary">
                  (References another class)
                </Typography>
              )}
            </Box>
          </Box>
        )}

        <TextField
          autoFocus
          margin="dense"
          label="Property Name"
          type="text"
          fullWidth
          required
          value={editPropName}
          onChange={(e) => setEditPropName(e.target.value)}
          sx={{ mb: 2 }}
        />

        {/* Show additionalProperties control for object types or arrays with inline object items */}
        {editingClassProperty && (() => {
          const propData = typeof editingClassProperty.data === 'string'
            ? JSON.parse(editingClassProperty.data)
            : (editingClassProperty.data || {});
          const isDirectObject = propData.type === 'object' && !propData.$ref;
          const isArrayInlineObject = propData.type === 'array' && propData.items && propData.items.type === 'object' && !propData.items.$ref;

          if (isDirectObject || isArrayInlineObject) {
            return (
              <>
                <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
                  Object Schema Settings
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Additional Properties
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, ml: 2 }}>
                    <FormControlLabel
                      control={
                        <Radio
                          checked={editPropAdditionalProperties === 'default'}
                          onChange={() => setEditPropAdditionalProperties('default')}
                          value="default"
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <span>Default</span>
                          <Typography variant="caption" color="text.secondary">
                            - Use JSON Schema default (allows additional properties)
                          </Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Radio
                          checked={editPropAdditionalProperties === 'true'}
                          onChange={() => setEditPropAdditionalProperties('true')}
                          value="true"
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <span>Allow Additional</span>
                          <Typography variant="caption" color="text.secondary">
                            - Explicitly allow any additional properties
                          </Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Radio
                          checked={editPropAdditionalProperties === 'false'}
                          onChange={() => setEditPropAdditionalProperties('false')}
                          value="false"
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <span>Strict Schema</span>
                          <Typography variant="caption" color="text.secondary">
                            - Only defined properties allowed (additionalProperties: false)
                          </Typography>
                        </Box>
                      }
                    />
                  </Box>
                </Box>
              </>
            );
          }
          return null;
        })()}

        {/* Constraints Section */}
        {editingClassProperty && (() => {
          const typeInfo = getPropertyTypeInfo();
          const propData = typeof editingClassProperty.data === 'string'
            ? JSON.parse(editingClassProperty.data)
            : (editingClassProperty.data || {});
          const schema = typeInfo.isArray ? (propData.items || {}) : propData;
          const baseType = schema.$ref ? 'reference' : (schema.type || 'object');

          // Only show constraints for non-reference types
          if (schema.$ref) return null;

          return (
            <>
              <Typography variant="subtitle2" sx={{ mt: 3, mb: 1, fontWeight: 600 }}>
                Property Details
              </Typography>

              <PropertyFormFields
                baseType={baseType}
                isArray={typeInfo.isArray}
                data={formData}
                onChange={(field, value) => {
                  setFormData(prev => ({ ...prev, [field]: value }));
                }}
                showMetadata={true}
                showTitle={false}
                size="small"
                nestedProperties={
                  baseType === 'object'
                    ? (allClassProperties || []).filter(p => p.parent_id === editingClassProperty.id)
                    : undefined
                }
              />
            </>
          );
        })()}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
}
