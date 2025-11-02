'use client';

import "../../globals.css";
import * as React from 'react';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { StudioProvider, useStudio } from './StudioContext';

// Dynamically import Monaco Editor with SSR disabled
const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#666' }}>Loading editor...</div>
    </div>
  ),
});
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
  getClassesForVersion,
  createClass,
  updateClass,
  deleteClass,
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
import Typography from '@mui/material/Typography';
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
  // Get selected project and version from context
  const { selectedProjectId, selectedVersionId, triggerCanvasRefresh } = useStudio();

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

  // Load classes when version is selected or refreshKey changes
  React.useEffect(() => {
    const loadClasses = async () => {
      if (!selectedVersionId) {
        setClasses([]);
        return;
      }

      try {
        const result = await getClassesForVersion(selectedVersionId);
        const data = JSON.parse(result);
        // Transform database format to ClassItem format
        const transformedClasses: ClassItem[] = data.map((cls: any) => ({
          id: cls.id,
          name: cls.name,
          description: cls.description,
        }));
        setClasses(transformedClasses);
      } catch (error) {
        console.error('Error loading classes:', error);
        setClasses([]);
      }
    };

    loadClasses();
  }, [selectedVersionId, refreshKey]);

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
  const [propertyViewMode, setPropertyViewMode] = useState<'form' | 'json'>('form');
  const [selectedProperty, setSelectedProperty] = useState<PropertyItem | null>(null);
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
  const [propertyMinItems, setPropertyMinItems] = useState('');
  const [propertyMaxItems, setPropertyMaxItems] = useState('');
  const [propertyEnum, setPropertyEnum] = useState<string[]>([]);
  const [propertyEnumInput, setPropertyEnumInput] = useState('');
  const [propertyEnumError, setPropertyEnumError] = useState('');
  const [propertyDefault, setPropertyDefault] = useState('');
  const [propertyRequired, setPropertyRequired] = useState(false);
  const [propertyError, setPropertyError] = useState('');

  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'class' | 'property'; id: string } | null>(null);

  // Class callbacks
  const handleClassAdd = () => {
    if (!selectedVersionId) {
      alert('Please select a version from the canvas first');
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
    if (!selectedVersionId) {
      alert('Please select a version from the canvas first');
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
    if (!selectedVersionId) {
      alert('Please select a version from the canvas first');
      return;
    }
    setDeleteTarget({ type: 'class', id: classId });
    setDeleteDialogOpen(true);
  };

  const handleClassSelect = (classItem: ClassItem) => {
    console.log('Class selected:', classItem);
    // Handle class selection (e.g., show in canvas)
  };

  const handleClassDialogSubmit = async () => {
    if (!className.trim()) {
      setClassError('Class name is required');
      return;
    }

    if (!selectedVersionId) {
      setClassError('No version selected');
      return;
    }

    // Build a default schema object
    const defaultSchema = {
      type: 'object',
      properties: {},
      required: []
    };

    try {
      let result;
      if (classDialogMode === 'add') {
        // Create new class
        result = await createClass(
          selectedVersionId,
          className,
          classDescription || null,
          defaultSchema
        );
      } else if (selectedClass) {
        // Update existing class
        result = await updateClass(
          selectedClass.id,
          className,
          classDescription || null,
          defaultSchema
        );
      }

      const response = JSON.parse(result!);
      if (!response.success) {
        setClassError(response.error || 'Failed to save class');
        return;
      }

      setClassDialogOpen(false);
      setRefreshKey(prev => prev + 1); // Trigger reload of classes in sidebar
      triggerCanvasRefresh(); // Trigger reload of classes in canvas
    } catch (error) {
      console.error('Error saving class:', error);
      setClassError('An error occurred while saving the class');
    }
  };

  // Property callbacks
  const handlePropertyAdd = () => {
    if (!selectedProjectId) {
      alert('Please select a project from the canvas first');
      return;
    }
    setPropertyDialogMode('add');
    setPropertyViewMode('form');
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
    setPropertyMinItems('');
    setPropertyMaxItems('');
    setPropertyEnum([]);
    setPropertyEnumInput('');
    setPropertyEnumError('');
    setPropertyDefault('');
    setPropertyRequired(false);
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
    setPropertyViewMode('form');
    setSelectedProperty(propertyItem);
    setPropertyName(propertyItem.name);

    // Check if property is an array type (has type: "array" and items field)
    // Note: This assumes the property data structure stores items as a sub-object
    const isArray = propertyItem.type === 'array';
    setPropertyIsArray(isArray);

    // If property has $ref, set type to '$ref', otherwise use the type field
    // If it's an array, we need to look at items.type or items.$ref
    if (propertyItem.$ref) {
      setPropertyType('$ref');
      setPropertyRef(propertyItem.$ref);
    } else if (isArray && (propertyItem as any).items) {
      // For array types, extract the items type
      const items = (propertyItem as any).items;
      if (items.$ref) {
        setPropertyType('$ref');
        setPropertyRef(items.$ref);
      } else {
        setPropertyType(items.type || 'string');
        setPropertyRef('');
      }
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

  // Helper function to build JSON Schema 2020-12 definition from current form state
  const buildPropertyJsonSchema = () => {
    const schema: any = {};

    // Add title if provided
    if (propertyTitle) {
      schema.title = propertyTitle;
    }

    // Add description if provided
    if (propertyDescription) {
      schema.description = propertyDescription;
    }

    // Handle array checkbox - if checked, wrap the type in an items schema
    if (propertyIsArray) {
      schema.type = 'array';

      // Array-specific validation
      if (propertyMinItems) schema.minItems = parseInt(propertyMinItems);
      if (propertyMaxItems) schema.maxItems = parseInt(propertyMaxItems);

      // Build the items schema
      const itemsSchema: any = {};

      if (propertyType === '$ref') {
        itemsSchema.$ref = propertyRef;
      } else {
        itemsSchema.type = propertyType;

        // Add type-specific validations
        if (propertyFormat) itemsSchema.format = propertyFormat;
        if (propertyPattern) itemsSchema.pattern = propertyPattern;
        if (propertyMinLength) itemsSchema.minLength = parseInt(propertyMinLength);
        if (propertyMaxLength) itemsSchema.maxLength = parseInt(propertyMaxLength);
        if (propertyMinimum) itemsSchema.minimum = parseFloat(propertyMinimum);
        if (propertyMaximum) itemsSchema.maximum = parseFloat(propertyMaximum);
        if (propertyEnum.length > 0) itemsSchema.enum = propertyEnum;
        if (propertyDefault) itemsSchema.default = propertyDefault;
      }

      schema.items = itemsSchema;
    } else {
      // Not an array - direct type/validation
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
        if (propertyEnum.length > 0) schema.enum = propertyEnum;
        if (propertyDefault) schema.default = propertyDefault;
      }
    }

    return schema;
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
    };

    // Add title to data object if provided
    if (propertyTitle) {
      dataObject.title = propertyTitle;
    }

    // Handle array checkbox - if checked, wrap the type in an items schema
    if (propertyIsArray) {
      dataObject.type = 'array';

      // Array-specific validation
      if (propertyMinItems) dataObject.minItems = parseInt(propertyMinItems);
      if (propertyMaxItems) dataObject.maxItems = parseInt(propertyMaxItems);

      // Build the items schema based on the selected type
      const itemsSchema: any = {};

      if (propertyType === '$ref') {
        itemsSchema.$ref = propertyRef;
      } else {
        itemsSchema.type = propertyType;

        // Add type-specific validations to items schema
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
      // Not an array - direct type/validation
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
        // Delete class from database
        const result = await deleteClass(deleteTarget.id);
        const response = JSON.parse(result);

        if (!response.success) {
          console.error('Failed to delete class:', response.error);
          alert(response.error || 'Failed to delete class');
          return;
        }
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
      setRefreshKey(prev => prev + 1); // Trigger reload in sidebar
      if (deleteTarget.type === 'class') {
        triggerCanvasRefresh(); // Trigger reload of classes in canvas
      }
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
        selectedVersionId={selectedVersionId}
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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{propertyDialogMode === 'add' ? 'Add Property' : 'Edit Property'}</span>
            <Box sx={{ display: 'flex', gap: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              <Button
                size="small"
                variant={propertyViewMode === 'form' ? 'contained' : 'text'}
                onClick={() => setPropertyViewMode('form')}
                sx={{ borderRadius: 0, minWidth: 'auto', px: 2 }}
              >
                Form
              </Button>
              <Button
                size="small"
                variant={propertyViewMode === 'json' ? 'contained' : 'text'}
                onClick={() => setPropertyViewMode('json')}
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

          {propertyViewMode === 'form' ? (
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

          {/* Type Selector with Array Checkbox - inline layout */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', mb: 2 }}>
            {/* Array Checkbox with dynamic label */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={propertyIsArray}
                  onChange={(e) => setPropertyIsArray(e.target.checked)}
                  disabled={propertyDialogMode === 'edit'}
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
                // Clear $ref when switching away from $ref type
                if (newType !== '$ref') {
                  setPropertyRef('');
                }
              }}
              SelectProps={{ native: true }}
              disabled={propertyDialogMode === 'edit'}
              helperText={propertyDialogMode === 'edit' ? 'Type cannot be changed after creation' : undefined}
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
            </>
          )}

          {/* Array-specific fields */}
          {propertyIsArray && (
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
          )}

          {/* Enum values editor - only for string, number, and integer types */}
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

          {/* Default value - applicable for string, number, integer, boolean */}
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

          {/* Note about default values for arrays */}
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

