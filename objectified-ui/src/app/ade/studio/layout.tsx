'use client';

import "../../globals.css";
import * as React from 'react';
import { useState } from 'react';
import { StudioProvider, useStudio } from './StudioContext';
import StudioSideNav, {
  ClassItem,
  PropertyItem,
  StudioSideNavCallbacks
} from '@/app/components/ade/studio/StudioSideNav';
import {
  getPropertiesForProject,
  createProperty,
  updateProperty,
  deleteProperty,
} from '../../../../lib/db/helper';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import DialogContentText from '@mui/material/DialogContentText';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Box from '@mui/material/Box';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

function StudioLayoutContent({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get selected project from context
  const { selectedProjectId } = useStudio();

  // State for classes and properties
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoadingProperties, setIsLoadingProperties] = useState(false);

  // Load properties when project is selected or refreshKey changes
  React.useEffect(() => {
    const loadProps = async () => {
      if (!selectedProjectId) {
        setProperties([]);
        return;
      }

      setIsLoadingProperties(true);
      try {
        const result = await getPropertiesForProject(selectedProjectId);
        const data = JSON.parse(result);
        // Transform database format to PropertyItem format
        const transformedProperties: PropertyItem[] = data.map((prop: any) => ({
          id: prop.id,
          name: prop.name,
          description: prop.description,
          ...prop.data, // Spread the JSON data which contains type, title, format, etc.
        }));
        setProperties(transformedProperties);
      } catch (error) {
        console.error('Error loading properties:', error);
        setProperties([]);
      } finally {
        setIsLoadingProperties(false);
      }
    };

    loadProps();
  }, [selectedProjectId, refreshKey]);

  // Dialog state for classes
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [classDialogMode, setClassDialogMode] = useState<'add' | 'edit'>('add');
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [className, setClassName] = useState('');
  const [classDescription, setClassDescription] = useState('');
  const [classError, setClassError] = useState('');

  // Dialog state for properties
  const [propertyDialogOpen, setPropertyDialogOpen] = useState(false);
  const [propertyDialogMode, setPropertyDialogMode] = useState<'add' | 'edit'>('add');
  const [selectedProperty, setSelectedProperty] = useState<PropertyItem | null>(null);
  const [propertyName, setPropertyName] = useState('');
  const [propertyType, setPropertyType] = useState('string');
  const [propertyRef, setPropertyRef] = useState('');
  const [propertyTitle, setPropertyTitle] = useState('');
  const [propertyDescription, setPropertyDescription] = useState('');
  const [propertyFormat, setPropertyFormat] = useState('');
  const [propertyPattern, setPropertyPattern] = useState('');
  const [propertyMinLength, setPropertyMinLength] = useState('');
  const [propertyMaxLength, setPropertyMaxLength] = useState('');
  const [propertyMinimum, setPropertyMinimum] = useState('');
  const [propertyMaximum, setPropertyMaximum] = useState('');
  const [propertyMinItems, setPropertyMinItems] = useState('');
  const [propertyMaxItems, setPropertyMaxItems] = useState('');
  const [propertyEnum, setPropertyEnum] = useState<string[]>([]);
  const [propertyEnumInput, setPropertyEnumInput] = useState('');
  const [propertyEnumError, setPropertyEnumError] = useState('');
  const [propertyDefault, setPropertyDefault] = useState('');
  const [propertyRequired, setPropertyRequired] = useState(false);
  const [propertyReadOnly, setPropertyReadOnly] = useState(false);
  const [propertyWriteOnly, setPropertyWriteOnly] = useState(false);
  const [propertyError, setPropertyError] = useState('');

  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'class' | 'property'; id: string } | null>(null);

  // Class callbacks
  const handleClassAdd = () => {
    if (!selectedProjectId) {
      alert('Please select a project from the canvas first');
      return;
    }
    setClassDialogMode('add');
    setClassName('');
    setClassDescription('');
    setClassError('');
    setSelectedClass(null);
    setClassDialogOpen(true);
  };

  const handleClassEdit = (classItem: ClassItem) => {
    if (!selectedProjectId) {
      alert('Please select a project from the canvas first');
      return;
    }
    setClassDialogMode('edit');
    setSelectedClass(classItem);
    setClassName(classItem.name);
    setClassDescription(classItem.description || '');
    setClassError('');
    setClassDialogOpen(true);
  };

  const handleClassDelete = (classId: string) => {
    if (!selectedProjectId) {
      alert('Please select a project from the canvas first');
      return;
    }
    setDeleteTarget({ type: 'class', id: classId });
    setDeleteDialogOpen(true);
  };

  const handleClassSelect = (classItem: ClassItem) => {
    console.log('Class selected:', classItem);
    // Handle class selection (e.g., show in canvas)
  };

  const handleClassDialogSubmit = () => {
    if (!className.trim()) {
      setClassError('Class name is required');
      return;
    }

    if (classDialogMode === 'add') {
      const newClass: ClassItem = {
        id: Date.now().toString(),
        name: className,
        description: classDescription,
      };
      setClasses([...classes, newClass]);
    } else if (selectedClass) {
      setClasses(classes.map(cls =>
        cls.id === selectedClass.id
          ? { ...cls, name: className, description: classDescription }
          : cls
      ));
    }

    setClassDialogOpen(false);
    setRefreshKey(prev => prev + 1);
  };

  // Property callbacks
  const handlePropertyAdd = () => {
    if (!selectedProjectId) {
      alert('Please select a project from the canvas first');
      return;
    }
    setPropertyDialogMode('add');
    setPropertyName('');
    setPropertyType('string');
    setPropertyRef('');
    setPropertyTitle('');
    setPropertyDescription('');
    setPropertyFormat('');
    setPropertyPattern('');
    setPropertyMinLength('');
    setPropertyMaxLength('');
    setPropertyMinimum('');
    setPropertyMaximum('');
    setPropertyMinItems('');
    setPropertyMaxItems('');
    setPropertyEnum([]);
    setPropertyEnumInput('');
    setPropertyEnumError('');
    setPropertyDefault('');
    setPropertyRequired(false);
    setPropertyReadOnly(false);
    setPropertyWriteOnly(false);
    setPropertyError('');
    setSelectedProperty(null);
    setPropertyDialogOpen(true);
  };

  const handlePropertyEdit = (propertyItem: PropertyItem) => {
    if (!selectedProjectId) {
      alert('Please select a project from the canvas first');
      return;
    }
    setPropertyDialogMode('edit');
    setSelectedProperty(propertyItem);
    setPropertyName(propertyItem.name);

    // If property has $ref, set type to '$ref', otherwise use the type field
    if (propertyItem.$ref) {
      setPropertyType('$ref');
      setPropertyRef(propertyItem.$ref);
    } else {
      setPropertyType(propertyItem.type || 'string');
      setPropertyRef('');
    }

    setPropertyTitle(propertyItem.title || '');
    setPropertyDescription(propertyItem.description || '');
    setPropertyFormat(propertyItem.format || '');
    setPropertyPattern(propertyItem.pattern || '');
    setPropertyMinLength(propertyItem.minLength?.toString() || '');
    setPropertyMaxLength(propertyItem.maxLength?.toString() || '');
    setPropertyMinimum(propertyItem.minimum?.toString() || '');
    setPropertyMaximum(propertyItem.maximum?.toString() || '');
    setPropertyMinItems(propertyItem.minItems?.toString() || '');
    setPropertyMaxItems(propertyItem.maxItems?.toString() || '');
    setPropertyEnum(propertyItem.enum || []);
    setPropertyEnumInput('');
    setPropertyEnumError('');
    setPropertyDefault(propertyItem.default?.toString() || '');
    setPropertyRequired(propertyItem.required || false);
    setPropertyReadOnly(propertyItem.readOnly || false);
    setPropertyWriteOnly(propertyItem.writeOnly || false);
    setPropertyError('');
    setPropertyDialogOpen(true);
  };

  const handlePropertyDelete = (propertyId: string) => {
    if (!selectedProjectId) {
      alert('Please select a project from the canvas first');
      return;
    }
    setDeleteTarget({ type: 'property', id: propertyId });
    setDeleteDialogOpen(true);
  };

  const handlePropertySelect = (propertyItem: PropertyItem) => {
    console.log('Property selected:', propertyItem);
    // Handle property selection
  };

  const handlePropertyDialogSubmit = async () => {
    if (!propertyName.trim()) {
      setPropertyError('Property name is required');
      return;
    }

    // Validate that a schema reference is selected when type is $ref
    if (propertyType === '$ref' && !propertyRef) {
      setPropertyError('Schema reference is required when type is $ref');
      return;
    }

    if (!selectedProjectId) {
      setPropertyError('No project selected');
      return;
    }

    // Build the data object that will be stored in the JSONB column
    const dataObject: any = {
      required: propertyRequired,
      readOnly: propertyReadOnly,
      writeOnly: propertyWriteOnly,
    };

    // Add title to data object if provided
    if (propertyTitle) {
      dataObject.title = propertyTitle;
    }

    // If type is $ref, use $ref field instead of type
    if (propertyType === '$ref') {
      dataObject.$ref = propertyRef;
    } else {
      // Otherwise use type and validation fields
      dataObject.type = propertyType;
      if (propertyFormat) dataObject.format = propertyFormat;
      if (propertyPattern) dataObject.pattern = propertyPattern;
      if (propertyMinLength) dataObject.minLength = parseInt(propertyMinLength);
      if (propertyMaxLength) dataObject.maxLength = parseInt(propertyMaxLength);
      if (propertyMinimum) dataObject.minimum = parseFloat(propertyMinimum);
      if (propertyMaximum) dataObject.maximum = parseFloat(propertyMaximum);
      if (propertyMinItems) dataObject.minItems = parseInt(propertyMinItems);
      if (propertyMaxItems) dataObject.maxItems = parseInt(propertyMaxItems);
      if (propertyEnum.length > 0) dataObject.enum = propertyEnum;
      if (propertyDefault) dataObject.default = propertyDefault;
    }

    try {
      let result;
      if (propertyDialogMode === 'add') {
        // Create new property
        result = await createProperty(
          selectedProjectId,
          propertyName,
          propertyDescription || null,
          dataObject
        );
      } else if (selectedProperty) {
        // Update existing property
        result = await updateProperty(
          selectedProperty.id,
          propertyName,
          propertyDescription || null,
          dataObject
        );
      }

      const response = JSON.parse(result!);
      if (!response.success) {
        setPropertyError(response.error || 'Failed to save property');
        return;
      }

      setPropertyDialogOpen(false);
      setRefreshKey(prev => prev + 1); // Trigger reload of properties
    } catch (error) {
      console.error('Error saving property:', error);
      setPropertyError('An error occurred while saving the property');
    }
  };

  // Delete confirmation
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === 'class') {
        // TODO: Implement class deletion with helper
        setClasses(classes.filter(cls => cls.id !== deleteTarget.id));
      } else {
        // Delete property from database
        const result = await deleteProperty(deleteTarget.id);
        const response = JSON.parse(result);

        if (!response.success) {
          console.error('Failed to delete property:', response.error);
          alert(response.error || 'Failed to delete property');
          return;
        }
      }

      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      setRefreshKey(prev => prev + 1); // Trigger reload of properties
    } catch (error) {
      console.error('Error deleting:', error);
      alert('An error occurred while deleting');
    }
  };

  const callbacks: StudioSideNavCallbacks = {
    onClassAdd: handleClassAdd,
    onClassEdit: handleClassEdit,
    onClassDelete: handleClassDelete,
    onClassSelect: handleClassSelect,
    onPropertyAdd: handlePropertyAdd,
    onPropertyEdit: handlePropertyEdit,
    onPropertyDelete: handlePropertyDelete,
    onPropertySelect: handlePropertySelect,
  };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 48px)" }}>
      <StudioSideNav
        classes={classes}
        properties={properties}
        callbacks={callbacks}
        refreshKey={refreshKey}
        selectedProjectId={selectedProjectId}
      />

      <main style={{ flex: 1, overflow: "auto" }}>
        {children}
      </main>

      {/* Class Dialog */}
      <Dialog
        open={classDialogOpen}
        onClose={() => setClassDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {classDialogMode === 'add' ? 'Add Class' : 'Edit Class'}
        </DialogTitle>
        <DialogContent>
          {classError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {classError}
            </Alert>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Class Name"
            type="text"
            fullWidth
            required
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description"
            type="text"
            fullWidth
            multiline
            rows={3}
            value={classDescription}
            onChange={(e) => setClassDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClassDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleClassDialogSubmit} variant="contained">
            {classDialogMode === 'add' ? 'Add' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Property Dialog */}
      <Dialog
        open={propertyDialogOpen}
        onClose={() => setPropertyDialogOpen(false)}
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
          {propertyDialogMode === 'add' ? 'Add Property' : 'Edit Property'}
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

          {/* Type Selector - includes $ref as an option */}
          <TextField
            select
            margin="dense"
            label="Type"
            fullWidth
            required
            value={propertyType}
            onChange={(e) => {
              const newType = e.target.value;
              setPropertyType(newType);
              // Clear $ref when switching away from $ref type
              if (newType !== '$ref') {
                setPropertyRef('');
              }
            }}
            SelectProps={{ native: true }}
            disabled={propertyDialogMode === 'edit'}
            helperText={propertyDialogMode === 'edit' ? 'Type cannot be changed after creation' : undefined}
            sx={{ mb: 2 }}
          >
            <option value="string">string</option>
            <option value="number">number</option>
            <option value="integer">integer</option>
            <option value="boolean">boolean</option>
            <option value="object">object</option>
            <option value="array">array</option>
            <option value="null">null</option>
            <option value="$ref">$ref (reference to class)</option>
          </TextField>

          {/* Schema Reference - only show when type is $ref */}
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
              disabled={propertyDialogMode === 'edit'}
              helperText={propertyDialogMode === 'edit' ? 'Schema reference cannot be changed after creation' : 'Select a class to reference as this property\'s schema'}
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
          )}

          {/* Array-specific fields */}
          {propertyType === 'array' && (
            <div style={{ display: 'flex', gap: '16px' }}>
              <TextField
                margin="dense"
                label="Min Items"
                type="number"
                fullWidth
                value={propertyMinItems}
                onChange={(e) => setPropertyMinItems(e.target.value)}
                helperText="Minimum number of items"
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
          )}

          {/* Enum values editor - only for string, number, and integer types */}
          {(propertyType === 'string' || propertyType === 'number' || propertyType === 'integer') && (
            <Box sx={{ mb: 2 }}>
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
                    setPropertyEnumError(''); // Clear error when typing
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && propertyEnumInput.trim()) {
                      e.preventDefault();
                      const trimmedValue = propertyEnumInput.trim();

                      // Validate based on property type
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

                    // Validate based on property type
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

          {/* Default value - applicable for string, number, integer, boolean, and array */}
          {(propertyType === 'string' || propertyType === 'number' || propertyType === 'integer' || propertyType === 'boolean' || propertyType === 'array') && (
            <TextField
              margin="dense"
              label="Default Value"
              type="text"
              fullWidth
              value={propertyDefault}
              onChange={(e) => setPropertyDefault(e.target.value)}
              sx={{ mb: 2 }}
            />
          )}

          {/* Boolean flags */}
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={propertyRequired}
                  onChange={(e) => setPropertyRequired(e.target.checked)}
                />
              }
              label="Required"
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={propertyReadOnly}
                  onChange={(e) => setPropertyReadOnly(e.target.checked)}
                />
              }
              label="Read Only"
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={propertyWriteOnly}
                  onChange={(e) => setPropertyWriteOnly(e.target.checked)}
                />
              }
              label="Write Only"
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPropertyDialogOpen(false)}>Cancel</Button>
          <Button onClick={handlePropertyDialogSubmit} variant="contained">
            {propertyDialogMode === 'add' ? 'Add' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this {deleteTarget?.type}?
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default function StudioLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <StudioProvider>
      <StudioLayoutContent>{children}</StudioLayoutContent>
    </StudioProvider>
  );
}

