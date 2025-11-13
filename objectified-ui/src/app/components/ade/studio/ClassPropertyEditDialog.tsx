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
import Checkbox from '@mui/material/Checkbox';
import Radio from '@mui/material/Radio';
import FormControlLabel from '@mui/material/FormControlLabel';
import Alert from '@mui/material/Alert';
import { updateClassProperty } from '../../../../../lib/db/helper';

interface Props {
  open: boolean;
  onClose: () => void;
  editingClassProperty: any | null;
  // Callback to reload classes after a successful save
  onSaved?: () => Promise<void> | void;
}

export default function ClassPropertyEditDialog({ open, onClose, editingClassProperty, onSaved }: Props) {
  const [editPropName, setEditPropName] = useState('');
  const [editPropDescription, setEditPropDescription] = useState('');
  const [editPropRequired, setEditPropRequired] = useState(false);
  const [editPropDeprecated, setEditPropDeprecated] = useState(false);
  const [editPropReadOnly, setEditPropReadOnly] = useState(false);
  const [editPropWriteOnly, setEditPropWriteOnly] = useState(false);
  const [editPropExample, setEditPropExample] = useState('');
  const [editPropAdditionalProperties, setEditPropAdditionalProperties] = useState<'default' | 'true' | 'false'>('default');
  const [editPropertyError, setEditPropertyError] = useState('');

  // Initialize form when editingClassProperty changes
  useEffect(() => {
    if (!editingClassProperty) return;

    setEditPropName(editingClassProperty.name || '');
    setEditPropDescription(editingClassProperty.description || '');

    const propData = typeof editingClassProperty.data === 'string'
      ? JSON.parse(editingClassProperty.data)
      : (editingClassProperty.data || {});

    setEditPropRequired(!!propData.required);
    setEditPropDeprecated(!!propData.deprecated);
    setEditPropReadOnly(!!propData.readOnly);
    setEditPropWriteOnly(!!propData.writeOnly);
    setEditPropExample(propData.example ? JSON.stringify(propData.example) : '');

    // Handle additionalProperties - only relevant for object types
    if (propData.hasOwnProperty('additionalProperties')) {
      setEditPropAdditionalProperties(propData.additionalProperties === false ? 'false' : 'true');
    } else {
      setEditPropAdditionalProperties('default');
    }

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
        required: editPropRequired,
        deprecated: editPropDeprecated,
        readOnly: editPropReadOnly,
        writeOnly: editPropWriteOnly,
      };

      // Handle additionalProperties field
      if (editPropAdditionalProperties === 'true') {
        updatedData.additionalProperties = true;
      } else if (editPropAdditionalProperties === 'false') {
        updatedData.additionalProperties = false;
      } else {
        // 'default' - remove the field to use JSON Schema default behavior
        delete updatedData.additionalProperties;
      }

      if (editPropExample.trim()) {
        try {
          updatedData.example = JSON.parse(editPropExample);
        } catch (e) {
          updatedData.example = editPropExample;
        }
      } else {
        delete updatedData.example;
      }

      const result = await updateClassProperty(
        editingClassProperty.id,
        editPropName.trim(),
        editPropDescription || null,
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Property in Class</DialogTitle>
      <DialogContent>
        {editPropertyError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {editPropertyError}
          </Alert>
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

        <TextField
          margin="dense"
          label="Description"
          type="text"
          fullWidth
          multiline
          rows={2}
          value={editPropDescription}
          onChange={(e) => setEditPropDescription(e.target.value)}
          helperText="Optional description for this property in this class"
          sx={{ mb: 2 }}
        />

        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
          OpenAPI 3.1.0 Extensions
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={editPropRequired}
                onChange={(e) => setEditPropRequired(e.target.checked)}
              />
            }
            label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><span>Required</span><Typography variant="caption" color="text.secondary">- Must be present in the object</Typography></Box>}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={editPropDeprecated}
                onChange={(e) => setEditPropDeprecated(e.target.checked)}
              />
            }
            label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><span>Deprecated</span><Typography variant="caption" color="text.secondary">- Should be transitioned out of usage</Typography></Box>}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={editPropReadOnly}
                onChange={(e) => {
                  setEditPropReadOnly(e.target.checked);
                  if (e.target.checked) setEditPropWriteOnly(false);
                }}
              />
            }
            label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><span>Read Only</span><Typography variant="caption" color="text.secondary">- Only in responses (OpenAPI)</Typography></Box>}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={editPropWriteOnly}
                onChange={(e) => {
                  setEditPropWriteOnly(e.target.checked);
                  if (e.target.checked) setEditPropReadOnly(false);
                }}
              />
            }
            label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><span>Write Only</span><Typography variant="caption" color="text.secondary">- Only in requests (OpenAPI)</Typography></Box>}
          />
        </Box>

        {/* Show additionalProperties control only for object types */}
        {editingClassProperty && (() => {
          const propData = typeof editingClassProperty.data === 'string'
            ? JSON.parse(editingClassProperty.data)
            : (editingClassProperty.data || {});
          const isObjectType = propData.type === 'object' && !propData.$ref;

          if (isObjectType) {
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

        <TextField
          margin="dense"
          label="Example Value"
          type="text"
          fullWidth
          multiline
          rows={2}
          value={editPropExample}
          onChange={(e) => setEditPropExample(e.target.value)}
          helperText="Example value (JSON format)"
          sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
}

