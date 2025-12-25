'use client';

import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
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

type JSONSchema = { type?: string | string[]; [k: string]: any };

interface PrefixItemsEditorProps {
  value?: JSONSchema[];
  onChange: (items: JSONSchema[]) => void;
}

interface SortableItemProps {
  id: string;
  index: number;
  schema: JSONSchema;
  onUpdate: (index: number, schema: JSONSchema) => void;
  onRemove: (index: number) => void;
}

const SortableItem: React.FC<SortableItemProps> = ({ id, index, schema, onUpdate, onRemove }) => {
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

  const [description, setDescription] = useState<string>(schema?.description || '');
  const [examplesText, setExamplesText] = useState<string>(
    schema?.examples ? schema.examples.map((e: any) => typeof e === 'string' ? e : JSON.stringify(e)).join(', ') : ''
  );

  // Sync fields when schema prop changes (e.g., when loading existing data)
  useEffect(() => {
    setDescription(schema?.description || '');
    setExamplesText(
      schema?.examples ? schema.examples.map((e: any) => typeof e === 'string' ? e : JSON.stringify(e)).join(', ') : ''
    );
  }, [schema]);

  const handleTypeChange = (newType: string) => {
    const updated = { ...schema, type: newType || undefined };
    onUpdate(index, updated);
  };

  const handleDescriptionChange = (newDescription: string) => {
    setDescription(newDescription);
    const updated = { ...schema };
    if (newDescription.trim()) {
      updated.description = newDescription;
    } else {
      delete updated.description;
    }
    onUpdate(index, updated);
  };

  const handleExamplesChange = (value: string) => {
    setExamplesText(value);
    const updated = { ...schema };

    if (value.trim()) {
      // Parse examples based on type
      const type = getType();
      const parts = value.split(',').map(s => s.trim()).filter(Boolean);

      updated.examples = parts.map(part => {
        // Try to parse based on type
        if (type === 'number' || type === 'integer') {
          const num = Number(part);
          return isNaN(num) ? part : num;
        } else if (type === 'boolean') {
          if (part.toLowerCase() === 'true') return true;
          if (part.toLowerCase() === 'false') return false;
          return part;
        } else if (type === 'object' || type === 'array') {
          try {
            return JSON.parse(part);
          } catch {
            return part;
          }
        }
        return part;
      });
    } else {
      delete updated.examples;
    }
    onUpdate(index, updated);
  };

  const getType = () => {
    if (!schema || !schema.type) return '';
    return Array.isArray(schema.type) ? schema.type[0] : schema.type;
  };

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      sx={{
        mb: 1,
        p: 2,
        backgroundColor: 'background.default',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Box
          {...attributes}
          {...listeners}
          sx={{
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            color: 'text.secondary',
            '&:active': { cursor: 'grabbing' },
          }}
        >
          <DragIndicatorIcon />
        </Box>

        <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 80 }}>
          Position {index}
        </Typography>

        <TextField
          select
          size="small"
          value={getType()}
          onChange={(e) => handleTypeChange(e.target.value)}
          sx={{ minWidth: 140 }}
          label="Type"
        >
          <MenuItem value="">Any</MenuItem>
          <MenuItem value="string">string</MenuItem>
          <MenuItem value="number">number</MenuItem>
          <MenuItem value="integer">integer</MenuItem>
          <MenuItem value="boolean">boolean</MenuItem>
          <MenuItem value="object">object</MenuItem>
          <MenuItem value="array">array</MenuItem>
          <MenuItem value="null">null</MenuItem>
        </TextField>

        <Box sx={{ flex: 1 }} />

        <IconButton
          size="small"
          onClick={() => onRemove(index)}
          color="error"
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Description field */}
      <TextField
        fullWidth
        size="small"
        value={description}
        onChange={(e) => handleDescriptionChange(e.target.value)}
        placeholder="Description for this position (e.g., X coordinate, Name column)"
        label="Description"
        sx={{ mb: 1.5 }}
      />

      {/* Examples field */}
      <TextField
        fullWidth
        size="small"
        value={examplesText}
        onChange={(e) => handleExamplesChange(e.target.value)}
        placeholder={getType() === 'number' ? 'e.g., 10.5, 20.3' : getType() === 'boolean' ? 'e.g., true, false' : 'e.g., value1, value2'}
        label="Examples (comma-separated)"
        helperText={`Example values for this ${getType() || 'position'}`}
      />
    </Paper>
  );
};

export const PrefixItemsEditor: React.FC<PrefixItemsEditorProps> = ({ value = [], onChange }) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = value.findIndex((_, i) => `prefix-${i}` === active.id);
      const newIndex = value.findIndex((_, i) => `prefix-${i}` === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        onChange(arrayMove(value, oldIndex, newIndex));
      }
    }
  };

  const handleUpdate = (index: number, schema: JSONSchema) => {
    const updated = [...value];
    updated[index] = schema;
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    const updated = value.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleAdd = () => {
    onChange([...value, { type: 'string' }]);
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Define schemas for specific array positions. Items beyond these positions will use the regular <code>items</code> schema.
      </Typography>

      {value.length === 0 && (
        <Box
          sx={{
            p: 3,
            mb: 2,
            textAlign: 'center',
            color: 'text.secondary',
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 1,
          }}
        >
          No prefix items defined. Click "Add Position" to define schemas for specific array positions.
        </Box>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={value.map((_, i) => `prefix-${i}`)}
          strategy={verticalListSortingStrategy}
        >
          {value.map((schema, index) => (
            <SortableItem
              key={`prefix-${index}`}
              id={`prefix-${index}`}
              index={index}
              schema={schema}
              onUpdate={handleUpdate}
              onRemove={handleRemove}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button
        startIcon={<AddIcon />}
        variant="outlined"
        onClick={handleAdd}
        fullWidth
        sx={{ mt: 1 }}
      >
        Add Position
      </Button>

      {value.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          <strong>Example:</strong> For a tuple like <code>[string, number, boolean]</code>,
          define 3 positions with types string, number, and boolean respectively.
        </Typography>
      )}
    </Box>
  );
};

