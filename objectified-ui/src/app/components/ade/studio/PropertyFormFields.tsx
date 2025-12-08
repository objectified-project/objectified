'use client';

import React from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import InputAdornment from '@mui/material/InputAdornment';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import Collapse from '@mui/material/Collapse';
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
  const [objectPropsExpanded, setObjectPropsExpanded] = React.useState(false);

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
            exampleValue = parseFloat(data.minimum) + (data.exclusiveMinimum ? 0.1 : 0);
          } else if (data.maximum) {
            exampleValue = parseFloat(data.maximum) - (data.exclusiveMaximum ? 0.1 : 0);
          } else {
            exampleValue = 42.5;
          }
          break;

        case 'integer':
          if (data.minimum) {
            exampleValue = Math.ceil(parseFloat(data.minimum) + (data.exclusiveMinimum ? 1 : 0));
          } else if (data.maximum) {
            exampleValue = Math.floor(parseFloat(data.maximum) - (data.exclusiveMaximum ? 1 : 0));
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
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 0 }}>
      {/* LEFT COLUMN: Standard Fields */}
      <Box sx={{ pr: 3 }}>
        {/* Section Header */}
        <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
          Standard Fields
        </Typography>

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
          rows={3}
          value={data.description || ''}
          onChange={(e) => onChange('description', e.target.value)}
          helperText="Optional description for the property"
          sx={{ mb: 2 }}
        />

        {/* Object Properties Section */}
        {baseType === 'object' && (
          <Box sx={{ mb: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 1.5,
                bgcolor: 'action.hover',
                borderRadius: 1,
                cursor: nestedProperties && nestedProperties.length > 0 ? 'pointer' : 'default',
              }}
              onClick={() => {
                if (nestedProperties && nestedProperties.length > 0) {
                  setObjectPropsExpanded(!objectPropsExpanded);
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                  Object Properties
                </Typography>
                <Chip
                  label={nestedProperties ? nestedProperties.length : 0}
                  size="small"
                  color={nestedProperties && nestedProperties.length > 0 ? 'primary' : 'default'}
                  sx={{ height: 20, fontSize: '0.75rem' }}
                />
              </Box>
              {nestedProperties && nestedProperties.length > 0 && (
                <IconButton size="small" sx={{ p: 0 }}>
                  {objectPropsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              )}
            </Box>

            {isArray && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, ml: 1 }}>
                This object type is the item type of an array
              </Typography>
            )}

            {nestedProperties && nestedProperties.length > 0 && (
              <Collapse in={objectPropsExpanded}>
                <Box sx={{ mt: 2, pl: 2, borderLeft: 2, borderColor: 'divider' }}>
                  <List dense>
                    {nestedProperties.map((prop) => {
                      const propData = typeof prop.data === 'string'
                        ? JSON.parse(prop.data)
                        : (prop.data || {});

                      // Determine type display
                      let typeDisplay = propData.type || 'any';
                      if (propData.$ref) {
                        const refParts = propData.$ref.split('/');
                        typeDisplay = refParts[refParts.length - 1] || propData.$ref;
                      } else if (propData.type === 'array' && propData.items) {
                        if (propData.items.$ref) {
                          const refParts = propData.items.$ref.split('/');
                          typeDisplay = `${refParts[refParts.length - 1] || propData.items.$ref}[]`;
                        } else {
                          typeDisplay = `${propData.items.type || 'any'}[]`;
                        }
                      }

                      return (
                        <ListItem
                          key={prop.id}
                          sx={{
                            py: 0.5,
                            px: 1,
                            bgcolor: 'background.paper',
                            borderRadius: 0.5,
                            mb: 0.5,
                          }}
                        >
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography
                                  variant="body2"
                                  sx={{ fontFamily: 'monospace', fontWeight: 500 }}
                                >
                                  {prop.name}
                                </Typography>
                                <Chip
                                  label={typeDisplay}
                                  size="small"
                                  variant="outlined"
                                  sx={{ height: 18, fontSize: '0.7rem' }}
                                />
                              </Box>
                            }
                            secondary={
                              prop.description && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ display: 'block', mt: 0.5 }}
                                >
                                  {prop.description}
                                </Typography>
                              )
                            }
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                </Box>
              </Collapse>
            )}

            {(!nestedProperties || nestedProperties.length === 0) && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, ml: 1 }}>
                No properties defined for this object
              </Typography>
            )}
          </Box>
        )}

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
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end" sx={{ alignSelf: 'flex-start', mt: 1 }}>
                    <Tooltip title="Generate example based on property schema">
                      <IconButton
                        onClick={generateExample}
                        size="small"
                        edge="end"
                        sx={{ color: 'primary.main' }}
                      >
                        <AutoAwesomeIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        )}
      </Box>

      {/* VERTICAL DIVIDER */}
      <Box sx={{ bgcolor: 'divider' }} />

      {/* RIGHT COLUMN: Constraints & Options */}
      <Box sx={{ pl: 3 }}>
        {/* Section Header */}
        <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
          Constraints
        </Typography>
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
        {(baseType === 'string' || baseType === 'number' || baseType === 'integer') && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Allowed Values (Enum)
              </Typography>
              {data.enum && data.enum.length > 1 && (
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Tooltip title="Sort A-Z (ascending)">
                    <IconButton
                      onClick={handleSortEnumAZ}
                      size="small"
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 0.5,
                      }}
                    >
                      <SortByAlphaIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Sort Z-A (descending)">
                    <IconButton
                      onClick={handleSortEnumZA}
                      size="small"
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 0.5,
                        transform: 'scaleY(-1)',
                      }}
                    >
                      <SortByAlphaIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
            </Box>
            {isArray && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Enum values apply to each item in the array
              </Typography>
            )}

            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField
                label="Add Enum Value"
                size={size}
                fullWidth
                type={baseType === 'string' ? 'text' : 'number'}
                value={enumInput}
                onChange={(e) => {
                  setEnumInput(e.target.value);
                  setEnumError('');
                }}
                onKeyDown={handleEnumKeyPress}
                error={!!enumError}
                helperText={enumError || `Enter a ${baseType} value and press Enter`}
                placeholder={
                  baseType === 'integer' ? 'e.g., 1, 2, 3' :
                  baseType === 'number' ? 'e.g., 1.5, 2.0, 3.14' :
                  'e.g., "active", "pending"'
                }
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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleEnumDragEnd}
            >
              <List
                dense
                sx={{
                  bgcolor: 'action.hover',
                  borderRadius: 1,
                  maxHeight: 200,
                  overflow: 'auto',
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                <SortableContext
                  items={data.enum}
                  strategy={verticalListSortingStrategy}
                >
                  {data.enum.map((value, index) => (
                    <SortableEnumItem
                      key={value}
                      id={value}
                      value={value}
                      onDelete={handleRemoveEnum}
                    />
                  ))}
                </SortableContext>
              </List>
            </DndContext>
          )}
          </Box>
        )}
      </Box>
    </Box>
  );
};

