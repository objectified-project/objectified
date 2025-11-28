'use client';

import "../../globals.css";
import * as React from 'react';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { StudioProvider, useStudio } from './StudioContext';
import { useDialog } from '../../components/providers/DialogProvider';

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
import PropertyDialog from '@/app/components/ade/studio/PropertyDialog';
import {
  getPropertiesForProject,
  createProperty,
  updateProperty,
  deleteProperty,
  getClassesForVersion,
  createClass,
  updateClass,
  deleteClass,
  getPropertiesForClass,
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
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';

function StudioLayoutContent({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { data: session } = useSession();
  const { confirm: confirmDialog, alert: alertDialog } = useDialog();
  const currentTenantId = (session?.user as any)?.current_tenant_id;

  // Get selected project and version from context
  const { selectedProjectId, selectedVersionId, triggerCanvasRefresh, sidebarRefreshKey, isReadOnly } = useStudio();

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
        console.log('Loaded classes from database:', data);
        // Transform database format to ClassItem format
        const transformedClasses: ClassItem[] = data.map((cls: any) => ({
          id: cls.id,
          name: cls.name,
          description: cls.description,
          schema: cls.schema, // Include schema field
        }));
        console.log('Transformed classes:', transformedClasses);
        setClasses(transformedClasses);
      } catch (error) {
        console.error('Error loading classes:', error);
        setClasses([]);
      }
    };

    loadClasses();
  }, [selectedVersionId, refreshKey, sidebarRefreshKey]);

  // Dialog state for classes
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [classDialogMode, setClassDialogMode] = useState<'add' | 'edit'>('add');
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [className, setClassName] = useState('');
  const [classDescription, setClassDescription] = useState('');
  const [classAllOf, setClassAllOf] = useState<string[]>([]);
  const [classAnyOf, setClassAnyOf] = useState<string[]>([]);
  const [classOneOf, setClassOneOf] = useState<string[]>([]);
  const [classDiscriminatorProperty, setClassDiscriminatorProperty] = useState('');
  const [classDiscriminatorUseAuto, setClassDiscriminatorUseAuto] = useState(true);
  const [classAdditionalProperties, setClassAdditionalProperties] = useState<boolean | null>(null);
  const [classError, setClassError] = useState('');

  // Dialog state for properties
  const [propertyDialogOpen, setPropertyDialogOpen] = useState(false);
  const [propertyDialogMode, setPropertyDialogMode] = useState<'add' | 'edit'>('add');
  const [selectedProperty, setSelectedProperty] = useState<PropertyItem | null>(null);

  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'class' | 'property'; id: string } | null>(null);

  // Class callbacks
  const handleClassAdd = async () => {
    if (!selectedVersionId) {
      await alertDialog({
        message: 'Please select a version from the canvas first',
        variant: 'warning',
      });
      return;
    }
    if (isReadOnly) {
      await alertDialog({
        message: 'Cannot add classes to a published version. Please select an unpublished version to make changes.',
        variant: 'warning',
      });
      return;
    }
    setClassDialogMode('add');
    setClassName('');
    setClassDescription('');
    setClassAllOf([]);
    setClassAnyOf([]);
    setClassOneOf([]);
    setClassDiscriminatorProperty('');
    setClassDiscriminatorUseAuto(true);
    setClassAdditionalProperties(null);
    setClassError('');
    setSelectedClass(null);
    setClassDialogOpen(true);
  };

  const handleClassEdit = async (classItem: ClassItem) => {
    if (!selectedVersionId) {
      await alertDialog({
        message: 'Please select a version from the canvas first',
        variant: 'warning',
      });
      return;
    }
    if (isReadOnly) {
      await alertDialog({
        message: 'Cannot edit classes in a published version. Please select an unpublished version to make changes.',
        variant: 'warning',
      });
      return;
    }
    setClassDialogMode('edit');
    setSelectedClass(classItem);
    setClassName(classItem.name);
    setClassDescription(classItem.description || '');

    // Load composition arrays from schema if they exist
    const schema = typeof classItem.schema === 'string' ? JSON.parse(classItem.schema) : classItem.schema;

    console.log('Loading class for edit:', classItem.name);
    console.log('Schema:', schema);
    console.log('allOf from schema:', schema?.allOf);
    console.log('anyOf from schema:', schema?.anyOf);
    console.log('oneOf from schema:', schema?.oneOf);

    // Helper to extract class name from $ref or return as-is
    const extractClassName = (s: any) => {
      if (s.$ref) {
        // Extract class name from $ref path (e.g., "#/components/schemas/ClassName" -> "ClassName")
        const parts = s.$ref.split('/');
        return parts[parts.length - 1];
      }
      return JSON.stringify(s);
    };

    const allOfValues = schema?.allOf?.map(extractClassName) || [];
    const anyOfValues = schema?.anyOf?.map(extractClassName) || [];
    const oneOfValues = schema?.oneOf?.map(extractClassName) || [];

    console.log('Extracted allOf values:', allOfValues);
    console.log('Extracted anyOf values:', anyOfValues);
    console.log('Extracted oneOf values:', oneOfValues);

    setClassAllOf(allOfValues);
    setClassAnyOf(anyOfValues);
    setClassOneOf(oneOfValues);

    // Load discriminator if it exists
    if (schema?.discriminator) {
      setClassDiscriminatorProperty(schema.discriminator.propertyName || '');
      // Check if mapping exists and is automatic (uses class names)
      setClassDiscriminatorUseAuto(!schema.discriminator.mapping || Object.keys(schema.discriminator.mapping).length === 0);
    } else {
      setClassDiscriminatorProperty('');
      setClassDiscriminatorUseAuto(true);
    }

    // Load additionalProperties if it exists
    if (schema?.additionalProperties !== undefined) {
      setClassAdditionalProperties(schema.additionalProperties);
    } else {
      setClassAdditionalProperties(null);
    }

    setClassError('');
    setClassDialogOpen(true);
  };

  const handleClassDelete = async (classId: string) => {
    if (!selectedVersionId) {
      await alertDialog({
        message: 'Please select a version from the canvas first',
        variant: 'warning',
      });
      return;
    }
    if (isReadOnly) {
      await alertDialog({
        message: 'Cannot delete classes from a published version. Please select an unpublished version to make changes.',
        variant: 'warning',
      });
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

    // Validate class name contains only A-Za-z0-9_
    if (!/^[A-Za-z0-9_]+$/.test(className)) {
      setClassError('Class name can only contain letters, numbers, and underscores');
      return;
    }

    if (!selectedVersionId) {
      setClassError('No version selected');
      return;
    }

    // Build schema object with composition keywords
    // Note: properties and required are NOT stored here - they are managed in class_properties table
    const schema: any = {
      type: 'object'
    };

    // Add composition arrays if they have values
    if (classAllOf.length > 0) {
      schema.allOf = classAllOf.map(ref => {
        if (ref.startsWith('{')) return JSON.parse(ref);
        // Add full $ref path format if just class name provided
        const refPath = ref.startsWith('#') ? ref : `#/components/schemas/${ref}`;
        return { $ref: refPath };
      });
    }
    if (classAnyOf.length > 0) {
      schema.anyOf = classAnyOf.map(ref => {
        if (ref.startsWith('{')) return JSON.parse(ref);
        const refPath = ref.startsWith('#') ? ref : `#/components/schemas/${ref}`;
        return { $ref: refPath };
      });
    }
    if (classOneOf.length > 0) {
      schema.oneOf = classOneOf.map(ref => {
        if (ref.startsWith('{')) return JSON.parse(ref);
        const refPath = ref.startsWith('#') ? ref : `#/components/schemas/${ref}`;
        return { $ref: refPath };
      });
    }

    // Add discriminator if property name is set and class has composition
    if (classDiscriminatorProperty && classDiscriminatorProperty.trim()) {
      const hasComposition = classAllOf.length > 0 || classAnyOf.length > 0 || classOneOf.length > 0;
      if (hasComposition) {
        schema.discriminator = {
          propertyName: classDiscriminatorProperty.trim()
        };

        // Add automatic mapping if enabled
        if (classDiscriminatorUseAuto) {
          const allClasses = [...classAllOf, ...classAnyOf, ...classOneOf];
          if (allClasses.length > 0) {
            schema.discriminator.mapping = {};
            allClasses.forEach(ref => {
              // Extract class name if it's a full $ref path
              const className = ref.includes('/') ? ref.split('/').pop() : ref;
              if (className && !className.startsWith('{')) {
                schema.discriminator.mapping[className] = className;
              }
            });
          }
        }
      }
    }

    // Add additionalProperties if set (null means not specified, use default behavior)
    if (classAdditionalProperties !== null) {
      schema.additionalProperties = classAdditionalProperties;
    }

    try {
      let result;
      if (classDialogMode === 'add') {
        // Create new class
        result = await createClass(
          selectedVersionId,
          className,
          classDescription || null,
          schema
        );
      } else if (selectedClass) {
        // Update existing class
        result = await updateClass(
          selectedClass.id,
          className,
          classDescription || null,
          schema
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
  const handlePropertyAdd = async () => {
    if (!selectedProjectId) {
      await alertDialog({
        message: 'Please select a project from the canvas first',
        variant: 'warning',
      });
      return;
    }
    if (isReadOnly) {
      await alertDialog({
        message: 'Cannot add properties to a published version. Please select an unpublished version to make changes.',
        variant: 'warning',
      });
      return;
    }
    setPropertyDialogMode('add');
    setSelectedProperty(null);
    setPropertyDialogOpen(true);
  };

  const handlePropertyEdit = async (propertyItem: PropertyItem) => {
    if (!selectedProjectId) {
      await alertDialog({
        message: 'Please select a project from the canvas first',
        variant: 'warning',
      });
      return;
    }
    if (isReadOnly) {
      await alertDialog({
        message: 'Cannot edit properties in a published version. Please select an unpublished version to make changes.',
        variant: 'warning',
      });
      return;
    }
    setPropertyDialogMode('edit');
    setSelectedProperty(propertyItem);
    setPropertyDialogOpen(true);
  };

  const handlePropertyDelete = async (propertyId: string) => {
    if (!selectedProjectId) {
      await alertDialog({
        message: 'Please select a project from the canvas first',
        variant: 'warning',
      });
      return;
    }
    if (isReadOnly) {
      await alertDialog({
        message: 'Cannot delete properties from a published version. Please select an unpublished version to make changes.',
        variant: 'warning',
      });
      return;
    }
    setDeleteTarget({ type: 'property', id: propertyId });
    setDeleteDialogOpen(true);
  };

  const handlePropertySelect = (propertyItem: PropertyItem) => {
    console.log('Property selected:', propertyItem);
    // Handle property selection
  };

  const handlePropertySubmit = async (propertyData: {
    name: string;
    description: string | null;
    data: any;
  }) => {
    if (!selectedProjectId) {
      throw new Error('No project selected');
    }

    let result;
    if (propertyDialogMode === 'add') {
      // Create new property
      result = await createProperty(
        selectedProjectId,
        propertyData.name,
        propertyData.description,
        propertyData.data
      );
    } else if (selectedProperty) {
      // Update existing property
      result = await updateProperty(
        selectedProperty.id,
        propertyData.name,
        propertyData.description,
        propertyData.data
      );
    }

    const response = JSON.parse(result!);
    if (!response.success) {
      throw new Error(response.error || 'Failed to save property');
    }

    setPropertyDialogOpen(false);
    setRefreshKey(prev => prev + 1); // Trigger reload of properties
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
          await alertDialog({
            message: response.error || 'Failed to delete class',
            variant: 'error',
          });
          return;
        }
      } else {
        // Delete property from database
        const result = await deleteProperty(deleteTarget.id);
        const response = JSON.parse(result);

        if (!response.success) {
          console.error('Failed to delete property:', response.error);
          await alertDialog({
            message: response.error || 'Failed to delete property',
            variant: 'error',
          });
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
      await alertDialog({
        message: 'An error occurred while deleting',
        variant: 'error',
      });
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
      {/* Only show StudioSideNav after both a project and a version are selected */}
      {currentTenantId && selectedProjectId && selectedVersionId && (
        <StudioSideNav
          classes={classes}
          properties={properties}
          callbacks={callbacks}
          refreshKey={refreshKey}
          selectedProjectId={selectedProjectId}
          selectedVersionId={selectedVersionId}
          isReadOnly={isReadOnly}
        />
      )}

      <main style={{ flex: 1, overflow: "auto", position: "relative", zIndex: 100 }}>
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
            sx={{ mb: 3 }}
          />

          {/* Composition Keywords Section */}
          <Typography variant="subtitle2" sx={{ mb: 1, mt: 2 }}>
            Schema Composition (JSON Schema)
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Extend or combine this class with other classes using JSON Schema composition keywords
          </Typography>

          {/* allOf - Inheritance/Extension */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
              allOf (Inheritance)
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              This class must satisfy ALL of the referenced schemas (AND logic)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                select
                size="small"
                fullWidth
                value=""
                onChange={(e) => {
                  const value = e.target.value;
                  if (value && !classAllOf.includes(value)) {
                    setClassAllOf([...classAllOf, value]);
                  }
                }}
                SelectProps={{ native: true }}
              >
                <option value="">Select a class...</option>
                {classes.filter(c => c.name !== className).map((cls) => (
                  <option key={cls.id} value={cls.name}>
                    {cls.name}
                  </option>
                ))}
              </TextField>
            </Box>
            {classAllOf.length > 0 && (
              <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {classAllOf.map((ref, index) => (
                  <Chip
                    key={index}
                    label={ref}
                    size="small"
                    onDelete={() => setClassAllOf(classAllOf.filter((_, i) => i !== index))}
                    sx={{
                      bgcolor: 'primary.light',
                      color: 'primary.contrastText',
                      '& .MuiChip-deleteIcon': {
                        color: 'primary.contrastText',
                        '&:hover': {
                          color: 'primary.dark'
                        }
                      }
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>

          {/* anyOf - Alternatives */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
              anyOf (Alternatives)
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              This class must satisfy AT LEAST ONE of the referenced schemas (OR logic)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                select
                size="small"
                fullWidth
                value=""
                onChange={(e) => {
                  const value = e.target.value;
                  if (value && !classAnyOf.includes(value)) {
                    setClassAnyOf([...classAnyOf, value]);
                  }
                }}
                SelectProps={{ native: true }}
              >
                <option value="">Select a class...</option>
                {classes.filter(c => c.name !== className).map((cls) => (
                  <option key={cls.id} value={cls.name}>
                    {cls.name}
                  </option>
                ))}
              </TextField>
            </Box>
            {classAnyOf.length > 0 && (
              <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {classAnyOf.map((ref, index) => (
                  <Chip
                    key={index}
                    label={ref}
                    size="small"
                    onDelete={() => setClassAnyOf(classAnyOf.filter((_, i) => i !== index))}
                    sx={{
                      bgcolor: 'warning.light',
                      color: 'warning.contrastText',
                      '& .MuiChip-deleteIcon': {
                        color: 'warning.contrastText',
                        '&:hover': {
                          color: 'warning.dark'
                        }
                      }
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>

          {/* oneOf - Exclusive Alternatives */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
              oneOf (Exclusive)
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              This class must satisfy EXACTLY ONE of the referenced schemas (XOR logic)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                select
                size="small"
                fullWidth
                value=""
                onChange={(e) => {
                  const value = e.target.value;
                  if (value && !classOneOf.includes(value)) {
                    setClassOneOf([...classOneOf, value]);
                  }
                }}
                SelectProps={{ native: true }}
              >
                <option value="">Select a class...</option>
                {classes.filter(c => c.name !== className).map((cls) => (
                  <option key={cls.id} value={cls.name}>
                    {cls.name}
                  </option>
                ))}
              </TextField>
            </Box>
            {classOneOf.length > 0 && (
              <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {classOneOf.map((ref, index) => (
                  <Chip
                    key={index}
                    label={ref}
                    size="small"
                    onDelete={() => setClassOneOf(classOneOf.filter((_, i) => i !== index))}
                    sx={{
                      bgcolor: 'secondary.light',
                      color: 'secondary.contrastText',
                      '& .MuiChip-deleteIcon': {
                        color: 'secondary.contrastText',
                        '&:hover': {
                          color: 'secondary.dark'
                        }
                      }
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClassDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleClassDialogSubmit} variant="contained">
            {classDialogMode === 'add' ? 'Add' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Property Dialog */}
      <PropertyDialog
        open={propertyDialogOpen}
        onClose={() => setPropertyDialogOpen(false)}
        mode={propertyDialogMode}
        property={selectedProperty}
        onSubmit={handlePropertySubmit}
      />

      {/* Class Dialog */}
      <Dialog
        open={classDialogOpen}
        onClose={() => setClassDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{classDialogMode === 'add' ? 'Add Class' : 'Edit Class'}</DialogTitle>
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
            onChange={(e) => {
              // Only allow A-Za-z0-9_ characters
              const filteredValue = e.target.value.replace(/[^A-Za-z0-9_]/g, '');
              setClassName(filteredValue);
            }}
            helperText="Only letters, numbers, and underscores are allowed; recommend PascalCase class names."
            sx={{ mb: 2 }}
          />

          <TextField
            margin="dense"
            label="Description"
            type="text"
            fullWidth
            multiline
            rows={2}
            value={classDescription}
            onChange={(e) => setClassDescription(e.target.value)}
            sx={{ mb: 3 }}
          />

          {/* Composition Section */}
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Composition/Inheritance (Optional)
          </Typography>

          {/* allOf Section */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <TextField
                select
                size="small"
                label="Add allOf"
                value=""
                onChange={(e) => {
                  if (e.target.value && !classAllOf.includes(e.target.value)) {
                    setClassAllOf([...classAllOf, e.target.value]);
                  }
                }}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 200 }}
              >
                <option value="">Select class...</option>
                {classes.filter(c => c.name !== className).map((cls) => (
                  <option key={cls.id} value={cls.name}>
                    {cls.name}
                  </option>
                ))}
              </TextField>
              <Typography variant="caption" color="text.secondary">
                Must match all listed schemas
              </Typography>
            </Box>
            {classAllOf.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {classAllOf.map((ref, index) => (
                  <Chip
                    key={index}
                    label={ref}
                    size="small"
                    onDelete={() => setClassAllOf(classAllOf.filter((_, i) => i !== index))}
                    sx={{
                      bgcolor: 'primary.light',
                      color: 'primary.contrastText',
                      '& .MuiChip-deleteIcon': {
                        color: 'primary.contrastText',
                        '&:hover': {
                          color: 'primary.dark'
                        }
                      }
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>

          {/* anyOf Section */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <TextField
                select
                size="small"
                label="Add anyOf"
                value=""
                onChange={(e) => {
                  if (e.target.value && !classAnyOf.includes(e.target.value)) {
                    setClassAnyOf([...classAnyOf, e.target.value]);
                  }
                }}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 200 }}
              >
                <option value="">Select class...</option>
                {classes.filter(c => c.name !== className).map((cls) => (
                  <option key={cls.id} value={cls.name}>
                    {cls.name}
                  </option>
                ))}
              </TextField>
              <Typography variant="caption" color="text.secondary">
                Must match at least one listed schema
              </Typography>
            </Box>
            {classAnyOf.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {classAnyOf.map((ref, index) => (
                  <Chip
                    key={index}
                    label={ref}
                    size="small"
                    onDelete={() => setClassAnyOf(classAnyOf.filter((_, i) => i !== index))}
                    sx={{
                      bgcolor: 'info.light',
                      color: 'info.contrastText',
                      '& .MuiChip-deleteIcon': {
                        color: 'info.contrastText',
                        '&:hover': {
                          color: 'info.dark'
                        }
                      }
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>

          {/* oneOf Section */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <TextField
                select
                size="small"
                label="Add oneOf"
                value=""
                onChange={(e) => {
                  if (e.target.value && !classOneOf.includes(e.target.value)) {
                    setClassOneOf([...classOneOf, e.target.value]);
                  }
                }}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 200 }}
              >
                <option value="">Select class...</option>
                {classes.filter(c => c.name !== className).map((cls) => (
                  <option key={cls.id} value={cls.name}>
                    {cls.name}
                  </option>
                ))}
              </TextField>
              <Typography variant="caption" color="text.secondary">
                Must match exactly one listed schema
              </Typography>
            </Box>
            {classOneOf.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {classOneOf.map((ref, index) => (
                  <Chip
                    key={index}
                    label={ref}
                    size="small"
                    onDelete={() => setClassOneOf(classOneOf.filter((_, i) => i !== index))}
                    sx={{
                      bgcolor: 'secondary.light',
                      color: 'secondary.contrastText',
                      '& .MuiChip-deleteIcon': {
                        color: 'secondary.contrastText',
                        '&:hover': {
                          color: 'secondary.dark'
                        }
                      }
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>

          {/* Discriminator Section - Only show if composition exists */}
          {(classAllOf.length > 0 || classAnyOf.length > 0 || classOneOf.length > 0) && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Discriminator (Optional)
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                The discriminator helps deserializers determine which schema to use for polymorphic data.
                Useful for improving performance and error messages when using oneOf/anyOf/allOf.
              </Typography>

              <TextField
                margin="dense"
                label="Discriminator Property Name"
                type="text"
                fullWidth
                placeholder="e.g., type, petType, kind"
                value={classDiscriminatorProperty}
                onChange={(e) => setClassDiscriminatorProperty(e.target.value)}
                helperText="The property name that indicates which schema to use"
                sx={{ mb: 2 }}
              />

              {classDiscriminatorProperty && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={classDiscriminatorUseAuto}
                      onChange={(e) => setClassDiscriminatorUseAuto(e.target.checked)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2">Use automatic mapping</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Automatically map discriminator values to class names
                      </Typography>
                    </Box>
                  }
                />
              )}
            </Box>
          )}

          {/* Additional Properties Section */}
          <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Additional Properties
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Controls whether properties not explicitly defined in the schema are allowed.
            </Typography>

            <RadioGroup
              value={classAdditionalProperties === null ? 'default' : classAdditionalProperties === true ? 'allow' : 'disallow'}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'default') {
                  setClassAdditionalProperties(null);
                } else if (value === 'allow') {
                  setClassAdditionalProperties(true);
                } else if (value === 'disallow') {
                  setClassAdditionalProperties(false);
                }
              }}
            >
              <FormControlLabel
                value="default"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2">Not specified (default behavior)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Use JSON Schema default - typically allows additional properties
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="allow"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2">Allow additional properties</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Explicitly allow properties beyond those defined in the schema
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="disallow"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2">Disallow additional properties</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Only allow properties explicitly defined in the schema
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClassDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleClassDialogSubmit} variant="contained">
            {classDialogMode === 'add' ? 'Add' : 'Save'}
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
