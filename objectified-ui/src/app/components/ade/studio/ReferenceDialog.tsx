'use client';

import React, { useState, useEffect } from 'react';
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
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormHelperText from '@mui/material/FormHelperText';

export interface ClassItem {
  id: string;
  name: string;
  description?: string;
}

interface ReferenceDialogProps {
  open: boolean;
  onClose: () => void;
  classes: ClassItem[];
  onSubmit: (referenceData: {
    name: string;
    description: string | null;
    isArray: boolean;
    targetClassId: string | null;
    minItems?: number;
    maxItems?: number;
    uniqueItems?: boolean;
  }) => Promise<void>;
}

export const ReferenceDialog: React.FC<ReferenceDialogProps> = ({
  open,
  onClose,
  classes,
  onSubmit,
}) => {
  const [referenceName, setReferenceName] = useState('');
  const [referenceDescription, setReferenceDescription] = useState('');
  const [isArray, setIsArray] = useState(false);
  const [targetClassId, setTargetClassId] = useState<string>('');
  const [minItems, setMinItems] = useState('');
  const [maxItems, setMaxItems] = useState('');
  const [uniqueItems, setUniqueItems] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setReferenceName('');
      setReferenceDescription('');
      setIsArray(false);
      setTargetClassId('');
      setMinItems('');
      setMaxItems('');
      setUniqueItems(false);
      setError('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!referenceName.trim()) {
      setError('Reference name is required');
      return;
    }

    // Validate reference name contains only A-Za-z0-9_
    if (!/^[A-Za-z0-9_]+$/.test(referenceName)) {
      setError('Reference name can only contain letters, numbers, and underscores');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit({
        name: referenceName,
        description: referenceDescription || null,
        isArray,
        targetClassId: targetClassId || null,
        minItems: minItems ? parseInt(minItems) : undefined,
        maxItems: maxItems ? parseInt(maxItems) : undefined,
        uniqueItems: isArray ? uniqueItems : undefined,
      });

      onClose();
    } catch (err) {
      console.error('Error creating reference:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while creating the reference');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Create Reference</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Create a reference property that links to another class. You can set the target class now or connect it later using the canvas.
        </Typography>

        <TextField
          autoFocus
          margin="dense"
          label="Reference Name"
          type="text"
          fullWidth
          required
          value={referenceName}
          onChange={(e) => {
            // Only allow A-Za-z0-9_ characters
            const filteredValue = e.target.value.replace(/[^A-Za-z0-9_]/g, '');
            setReferenceName(filteredValue);
          }}
          helperText="Only letters, numbers, and underscores are allowed. Suggest camelCase names."
          sx={{ mb: 2 }}
        />

        <TextField
          margin="dense"
          label="Description"
          type="text"
          fullWidth
          multiline
          rows={2}
          value={referenceDescription}
          onChange={(e) => setReferenceDescription(e.target.value)}
          helperText="Optional description of this reference"
          sx={{ mb: 2 }}
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={isArray}
              onChange={(e) => setIsArray(e.target.checked)}
            />
          }
          label="Array of references"
          sx={{ mb: 2 }}
        />

        {isArray && (
          <Box sx={{ pl: 4, mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Array constraints:
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
              <TextField
                margin="dense"
                label="Min Items"
                type="number"
                size="small"
                value={minItems}
                onChange={(e) => setMinItems(e.target.value)}
                helperText="Minimum number of items"
              />
              <TextField
                margin="dense"
                label="Max Items"
                type="number"
                size="small"
                value={maxItems}
                onChange={(e) => setMaxItems(e.target.value)}
                helperText="Maximum number of items"
              />
            </Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={uniqueItems}
                  onChange={(e) => setUniqueItems(e.target.checked)}
                />
              }
              label="Unique items (all array elements must be distinct)"
            />
          </Box>
        )}

        <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
          <InputLabel id="target-class-label">Target Class (Optional)</InputLabel>
          <Select
            labelId="target-class-label"
            label="Target Class (Optional)"
            value={targetClassId}
            onChange={(e) => setTargetClassId(e.target.value)}
          >
            <MenuItem value="">
              <em>No target (set later)</em>
            </MenuItem>
            {classes.map((cls) => (
              <MenuItem key={cls.id} value={cls.id}>
                {cls.name}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>Select a class to reference, or leave empty to set later via canvas connections</FormHelperText>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isSubmitting}>
          Create Reference
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReferenceDialog;

