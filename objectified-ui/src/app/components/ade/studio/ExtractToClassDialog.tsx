'use client';

import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { extractObjectPropertyToClass } from '../../../../../lib/db/helper';

interface Props {
  open: boolean;
  onClose: () => void;
  classProperty: any | null;
  existingClassNames: string[];
  onSuccess?: (newClassId: string, newClassName: string) => void;
}

export default function ExtractToClassDialog({
  open,
  onClose,
  classProperty,
  existingClassNames,
  onSuccess
}: Props) {
  const [className, setClassName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (classProperty && open) {
      // Generate a default class name based on the property name
      const propertyName = classProperty.name || '';
      const defaultName = propertyName.charAt(0).toUpperCase() + propertyName.slice(1);
      setClassName(defaultName);
      setDescription(`Extracted from ${propertyName}`);
      setError('');
    }
  }, [classProperty, open]);

  const validateClassName = (name: string): string | null => {
    if (!name.trim()) {
      return 'Class name is required';
    }

    // Check for duplicates (case-insensitive)
    const nameLower = name.trim().toLowerCase();
    if (existingClassNames.some(existing => existing.toLowerCase() === nameLower)) {
      return `A class named "${name.trim()}" already exists`;
    }

    // Validate format (should be a valid identifier)
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name.trim())) {
      return 'Class name must start with a letter and contain only letters, numbers, and underscores';
    }

    return null;
  };

  const handleSubmit = async () => {
    if (!classProperty) return;

    const validationError = validateClassName(className);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const result = await extractObjectPropertyToClass(
        classProperty.id,
        className.trim(),
        description.trim() || null
      );

      const response = JSON.parse(result);
      if (response.success) {
        if (onSuccess) {
          onSuccess(response.newClassId, response.newClassName);
        }
        onClose();
      } else {
        setError(response.error || 'Failed to extract property to class');
      }
    } catch (err: any) {
      console.error('Error extracting to class:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPropertyTypeDisplay = () => {
    if (!classProperty) return '';

    const propData = typeof classProperty.data === 'string'
      ? JSON.parse(classProperty.data)
      : classProperty.data;

    if (propData.type === 'array' && propData.items?.type === 'object') {
      return 'object[]';
    }
    return 'object';
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Extract Property to Class</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Alert severity="info" sx={{ mb: 3 }}>
          This will create a new class with the object structure and update this property to reference it using <code>$ref</code>.
        </Alert>

        {classProperty && (
          <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Source Property
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                {classProperty.name}
              </Typography>
              <Chip
                label={getPropertyTypeDisplay()}
                size="small"
                color="primary"
                sx={{ fontFamily: 'monospace' }}
              />
            </Box>
            {classProperty.description && (
              <Typography variant="caption" color="text.secondary">
                {classProperty.description}
              </Typography>
            )}
          </Box>
        )}

        <TextField
          autoFocus
          label="New Class Name"
          fullWidth
          required
          value={className}
          onChange={(e) => {
            setClassName(e.target.value);
            setError('');
          }}
          onBlur={() => {
            const validationError = validateClassName(className);
            if (validationError) {
              setError(validationError);
            }
          }}
          helperText="Must be unique and start with a letter"
          sx={{ mb: 2 }}
          disabled={isSubmitting}
        />

        <TextField
          label="Description"
          fullWidth
          multiline
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          helperText="Optional description for the new class"
          disabled={isSubmitting}
        />

        <Alert severity="warning" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Note:</strong> After extraction, the original property will reference the new class.
            Any nested properties will be moved to the new class.
          </Typography>
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isSubmitting || !className.trim()}
        >
          {isSubmitting ? 'Extracting...' : 'Extract to Class'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

