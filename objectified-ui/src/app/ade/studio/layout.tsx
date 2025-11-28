'use client';

import "../../globals.css";
import * as React from 'react';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { StudioProvider, useStudio } from './StudioContext';
import { useDialog } from '../../components/providers/DialogProvider';

const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#666' }}>Loading editor...</div>
    </div>
  ),
});

import StudioSideNav, { ClassItem, PropertyItem, StudioSideNavCallbacks } from '@/app/components/ade/studio/StudioSideNav';
import PropertyDialog from '@/app/components/ade/studio/PropertyDialog';
import { getPropertiesForProject, createProperty, updateProperty, deleteProperty, getClassesForVersion, createClass, updateClass, deleteClass } from '../../../../lib/db/helper';
import { Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText, Button, TextField, Alert, FormControlLabel, Checkbox, Radio, RadioGroup, Typography, Chip, Box } from '@mui/material';

// Helper function to check permissions
const checkPermissions = async (condition: boolean, message: string, alertDialog: any) => {
  if (!condition) {
    await alertDialog({ message, variant: 'warning' });
    return false;
  }
  return true;
};

// Helper function to extract class name from $ref
const extractClassName = (s: any) => {
  if (s.$ref) {
    const parts = s.$ref.split('/');
    return parts[parts.length - 1];
  }
  return null; // Return null for non-$ref objects so they can be filtered out
};

function StudioLayoutContent({ children }: Readonly<{ children: React.ReactNode }>) {
  const { data: session } = useSession();
  const { confirm: confirmDialog, alert: alertDialog } = useDialog();
  const currentTenantId = (session?.user as any)?.current_tenant_id;
  const { selectedProjectId, selectedVersionId, triggerCanvasRefresh, sidebarRefreshKey, isReadOnly } = useStudio();

  // State
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoadingProperties, setIsLoadingProperties] = useState(false);

  // Dialog state
  const [classDialog, setClassDialog] = useState({ open: false, mode: 'add' as 'add' | 'edit', selectedClass: null as ClassItem | null });
  const [propertyDialog, setPropertyDialog] = useState({ open: false, mode: 'add' as 'add' | 'edit', selectedProperty: null as PropertyItem | null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, target: null as { type: 'class' | 'property'; id: string } | null });

  // Class form state
  const [classForm, setClassForm] = useState({
    name: '', description: '', allOf: [] as string[], anyOf: [] as string[], oneOf: [] as string[],
    discriminatorProperty: '', discriminatorUseAuto: true, additionalProperties: null as boolean | null, error: ''
  });

  // Load data effects
  React.useEffect(() => {
    const loadProperties = async () => {
      if (!selectedProjectId) {
        setProperties([]);
        return;
      }
      setIsLoadingProperties(true);
      try {
        const result = await getPropertiesForProject(selectedProjectId);
        const data = JSON.parse(result);
        const transformedProperties: PropertyItem[] = data.map((prop: any) => ({
          id: prop.id, name: prop.name, description: prop.description, ...prop.data
        }));
        setProperties(transformedProperties);
      } catch (error) {
        console.error('Error loading properties:', error);
        setProperties([]);
      } finally {
        setIsLoadingProperties(false);
      }
    };
    loadProperties();
  }, [selectedProjectId, refreshKey]);

  React.useEffect(() => {
    const loadClasses = async () => {
      if (!selectedVersionId) {
        setClasses([]);
        return;
      }
      try {
        const result = await getClassesForVersion(selectedVersionId);
        const data = JSON.parse(result);
        const transformedClasses: ClassItem[] = data.map((cls: any) => ({
          id: cls.id, name: cls.name, description: cls.description, schema: cls.schema
        }));
        setClasses(transformedClasses);
      } catch (error) {
        console.error('Error loading classes:', error);
        setClasses([]);
      }
    };
    loadClasses();
  }, [selectedVersionId, refreshKey, sidebarRefreshKey]);

  // Class handlers
  const handleClassAdd = async () => {
    if (!(await checkPermissions(!!selectedVersionId, 'Please select a version from the canvas first', alertDialog))) return;
    if (!(await checkPermissions(!isReadOnly, 'Cannot add classes to a published version. Please select an unpublished version to make changes.', alertDialog))) return;

    setClassForm({ name: '', description: '', allOf: [], anyOf: [], oneOf: [], discriminatorProperty: '', discriminatorUseAuto: true, additionalProperties: null, error: '' });
    setClassDialog({ open: true, mode: 'add', selectedClass: null });
  };

  const handleClassEdit = async (classItem: ClassItem) => {
    if (!(await checkPermissions(!!selectedVersionId, 'Please select a version from the canvas first', alertDialog))) return;
    if (!(await checkPermissions(!isReadOnly, 'Cannot edit classes in a published version. Please select an unpublished version to make changes.', alertDialog))) return;

    const schema = typeof classItem.schema === 'string' ? JSON.parse(classItem.schema) : classItem.schema;

    setClassForm({
      name: classItem.name,
      description: classItem.description || '',
      allOf: schema?.allOf?.map(extractClassName).filter(Boolean) || [],
      anyOf: schema?.anyOf?.map(extractClassName).filter(Boolean) || [],
      oneOf: schema?.oneOf?.map(extractClassName).filter(Boolean) || [],
      discriminatorProperty: schema?.discriminator?.propertyName || '',
      discriminatorUseAuto: !schema?.discriminator?.mapping || Object.keys(schema.discriminator.mapping).length === 0,
      additionalProperties: schema?.additionalProperties !== undefined ? schema.additionalProperties : null,
      error: ''
    });
    setClassDialog({ open: true, mode: 'edit', selectedClass: classItem });
  };

  const handleClassDelete = async (classId: string) => {
    if (!(await checkPermissions(!!selectedVersionId, 'Please select a version from the canvas first', alertDialog))) return;
    if (!(await checkPermissions(!isReadOnly, 'Cannot delete classes from a published version. Please select an unpublished version to make changes.', alertDialog))) return;

    setDeleteDialog({ open: true, target: { type: 'class', id: classId } });
  };

  const handleClassSubmit = async () => {
    if (!classForm.name.trim()) {
      setClassForm(prev => ({ ...prev, error: 'Class name is required' }));
      return;
    }
    if (!/^[A-Za-z0-9_]+$/.test(classForm.name)) {
      setClassForm(prev => ({ ...prev, error: 'Class name can only contain letters, numbers, and underscores' }));
      return;
    }

    // Build schema
    const schema: any = { type: 'object' };

    if (classForm.allOf.length > 0) {
      schema.allOf = classForm.allOf.map(ref => ref.startsWith('{') ? JSON.parse(ref) : { $ref: ref.startsWith('#') ? ref : `#/components/schemas/${ref}` });
    }
    if (classForm.anyOf.length > 0) {
      schema.anyOf = classForm.anyOf.map(ref => ref.startsWith('{') ? JSON.parse(ref) : { $ref: ref.startsWith('#') ? ref : `#/components/schemas/${ref}` });
    }
    if (classForm.oneOf.length > 0) {
      schema.oneOf = classForm.oneOf.map(ref => ref.startsWith('{') ? JSON.parse(ref) : { $ref: ref.startsWith('#') ? ref : `#/components/schemas/${ref}` });
    }

    if (classForm.discriminatorProperty?.trim() && (classForm.allOf.length > 0 || classForm.anyOf.length > 0 || classForm.oneOf.length > 0)) {
      schema.discriminator = { propertyName: classForm.discriminatorProperty.trim() };
      if (classForm.discriminatorUseAuto) {
        const allClasses = [...classForm.allOf, ...classForm.anyOf, ...classForm.oneOf];
        if (allClasses.length > 0) {
          schema.discriminator.mapping = {};
          allClasses.forEach(ref => {
            const className = ref.includes('/') ? ref.split('/').pop() : ref;
            if (className && !className.startsWith('{')) {
              schema.discriminator.mapping[className] = className;
            }
          });
        }
      }
    }

    if (classForm.additionalProperties !== null) {
      schema.additionalProperties = classForm.additionalProperties;
    }

    try {
      let result;
      if (classDialog.mode === 'add') {
        result = await createClass(selectedVersionId!, classForm.name, classForm.description || null, schema);
      } else if (classDialog.selectedClass) {
        result = await updateClass(classDialog.selectedClass.id, classForm.name, classForm.description || null, schema);
      }

      const response = JSON.parse(result!);
      if (!response.success) {
        setClassForm(prev => ({ ...prev, error: response.error || 'Failed to save class' }));
        return;
      }

      setClassDialog({ open: false, mode: 'add', selectedClass: null });
      setRefreshKey(prev => prev + 1);
      triggerCanvasRefresh();
    } catch (error) {
      console.error('Error saving class:', error);
      setClassForm(prev => ({ ...prev, error: 'An error occurred while saving the class' }));
    }
  };

  // Property handlers
  const handlePropertyAdd = async () => {
    if (!(await checkPermissions(!!selectedProjectId, 'Please select a project from the canvas first', alertDialog))) return;
    if (!(await checkPermissions(!isReadOnly, 'Cannot add properties to a published version. Please select an unpublished version to make changes.', alertDialog))) return;

    setPropertyDialog({ open: true, mode: 'add', selectedProperty: null });
  };

  const handlePropertyEdit = async (propertyItem: PropertyItem) => {
    if (!(await checkPermissions(!!selectedProjectId, 'Please select a project from the canvas first', alertDialog))) return;
    if (!(await checkPermissions(!isReadOnly, 'Cannot edit properties in a published version. Please select an unpublished version to make changes.', alertDialog))) return;

    setPropertyDialog({ open: true, mode: 'edit', selectedProperty: propertyItem });
  };

  const handlePropertyDelete = async (propertyId: string) => {
    if (!(await checkPermissions(!!selectedProjectId, 'Please select a project from the canvas first', alertDialog))) return;
    if (!(await checkPermissions(!isReadOnly, 'Cannot delete properties from a published version. Please select an unpublished version to make changes.', alertDialog))) return;

    setDeleteDialog({ open: true, target: { type: 'property', id: propertyId } });
  };

  const handlePropertySubmit = async (propertyData: { name: string; description: string | null; data: any }) => {
    if (!selectedProjectId) throw new Error('No project selected');

    let result;
    if (propertyDialog.mode === 'add') {
      result = await createProperty(selectedProjectId, propertyData.name, propertyData.description, propertyData.data);
    } else if (propertyDialog.selectedProperty) {
      result = await updateProperty(propertyDialog.selectedProperty.id, propertyData.name, propertyData.description, propertyData.data);
    }

    const response = JSON.parse(result!);
    if (!response.success) throw new Error(response.error || 'Failed to save property');

    setPropertyDialog({ open: false, mode: 'add', selectedProperty: null });
    setRefreshKey(prev => prev + 1);
  };

  // Delete handler
  const handleDeleteConfirm = async () => {
    if (!deleteDialog.target) return;

    try {
      const result = deleteDialog.target.type === 'class'
        ? await deleteClass(deleteDialog.target.id)
        : await deleteProperty(deleteDialog.target.id);

      const response = JSON.parse(result);
      if (!response.success) {
        await alertDialog({ message: response.error || `Failed to delete ${deleteDialog.target.type}`, variant: 'error' });
        return;
      }

      setDeleteDialog({ open: false, target: null });
      setRefreshKey(prev => prev + 1);
      if (deleteDialog.target.type === 'class') {
        triggerCanvasRefresh();
      }
    } catch (error) {
      console.error('Error deleting:', error);
      await alertDialog({ message: 'An error occurred while deleting', variant: 'error' });
    }
  };

  const callbacks: StudioSideNavCallbacks = {
    onClassAdd: handleClassAdd, onClassEdit: handleClassEdit, onClassDelete: handleClassDelete,
    onClassSelect: (classItem) => console.log('Class selected:', classItem),
    onPropertyAdd: handlePropertyAdd, onPropertyEdit: handlePropertyEdit, onPropertyDelete: handlePropertyDelete,
    onPropertySelect: (propertyItem) => console.log('Property selected:', propertyItem),
  };

  // Render composition chips
  const renderCompositionChips = (items: string[], color: string, onDelete: (index: number) => void) => (
    items.length > 0 && (
      <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {items.map((item, index) => (
          <Chip key={index} label={item} size="small" onDelete={() => onDelete(index)}
                sx={{ bgcolor: `${color}.light`, color: `${color}.contrastText`, '& .MuiChip-deleteIcon': { color: `${color}.contrastText`, '&:hover': { color: `${color}.dark` } } }} />
        ))}
      </Box>
    )
  );

  // Render composition selector
  const renderCompositionSelector = (label: string, description: string, items: string[], setItems: (items: string[]) => void, color: string) => (
    <Box sx={{ mb: 2 }}>
      <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>{label}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>{description}</Typography>
      <TextField select size="small" fullWidth value="" SelectProps={{ native: true }}
                 onChange={(e) => { const value = e.target.value; if (value && !items.includes(value)) setItems([...items, value]); }}>
        <option value="">Select a class...</option>
        {classes.filter(c => c.name !== classForm.name).map((cls) => (
          <option key={cls.id} value={cls.name}>{cls.name}</option>
        ))}
      </TextField>
      {renderCompositionChips(items, color, (index) => setItems(items.filter((_, i) => i !== index)))}
    </Box>
  );

  return (
    <div style={{ display: "flex", height: "calc(100vh - 48px)" }}>
      {currentTenantId && selectedProjectId && selectedVersionId && (
        <StudioSideNav classes={classes} properties={properties} callbacks={callbacks} refreshKey={refreshKey}
                       selectedProjectId={selectedProjectId} selectedVersionId={selectedVersionId} isReadOnly={isReadOnly} />
      )}

      <main style={{ flex: 1, overflow: "auto", position: "relative", zIndex: 100 }}>
        {children}
      </main>

      {/* Class Dialog */}
      <Dialog open={classDialog.open} onClose={() => setClassDialog({ open: false, mode: 'add', selectedClass: null })} maxWidth="md" fullWidth>
        <DialogTitle>{classDialog.mode === 'add' ? 'Add Class' : 'Edit Class'}</DialogTitle>
        <DialogContent>
          {classForm.error && <Alert severity="error" sx={{ mb: 2 }}>{classForm.error}</Alert>}

          <TextField autoFocus margin="dense" label="Class Name" fullWidth required value={classForm.name}
                     onChange={(e) => setClassForm(prev => ({ ...prev, name: e.target.value.replace(/[^A-Za-z0-9_]/g, '') }))}
                     helperText="Only letters, numbers, and underscores are allowed; recommend PascalCase class names." sx={{ mb: 2 }} />

          <TextField margin="dense" label="Description" fullWidth multiline rows={2} value={classForm.description}
                     onChange={(e) => setClassForm(prev => ({ ...prev, description: e.target.value }))} sx={{ mb: 3 }} />

          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Composition/Inheritance (Optional)</Typography>

          {renderCompositionSelector("allOf (Inheritance)", "Must match all listed schemas", classForm.allOf,
            (items) => setClassForm(prev => ({ ...prev, allOf: items })), "primary")}

          {renderCompositionSelector("anyOf (Alternatives)", "Must match at least one listed schema", classForm.anyOf,
            (items) => setClassForm(prev => ({ ...prev, anyOf: items })), "info")}

          {renderCompositionSelector("oneOf (Exclusive)", "Must match exactly one listed schema", classForm.oneOf,
            (items) => setClassForm(prev => ({ ...prev, oneOf: items })), "secondary")}

          {/* Discriminator and Additional Properties sections remain similar but condensed */}
          {(classForm.allOf.length > 0 || classForm.anyOf.length > 0 || classForm.oneOf.length > 0) && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Discriminator (Optional)</Typography>
              <TextField margin="dense" label="Discriminator Property Name" fullWidth placeholder="e.g., type, petType, kind"
                         value={classForm.discriminatorProperty} onChange={(e) => setClassForm(prev => ({ ...prev, discriminatorProperty: e.target.value }))}
                         helperText="Property name that indicates which schema variant to use for polymorphic objects.  This is used for (de)serialization operations."
                         sx={{ mb: 2 }} />
              {classForm.discriminatorProperty && (
                <FormControlLabel control={<Checkbox checked={classForm.discriminatorUseAuto}
                                                     onChange={(e) => setClassForm(prev => ({ ...prev, discriminatorUseAuto: e.target.checked }))} />}
                                  label="Use automatic mapping" />
              )}
            </Box>
          )}

          <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Additional Properties</Typography>
            <RadioGroup value={classForm.additionalProperties === null ? 'default' : classForm.additionalProperties === true ? 'allow' : 'disallow'}
                        onChange={(e) => {
                          const value = e.target.value;
                          setClassForm(prev => ({ ...prev, additionalProperties: value === 'default' ? null : value === 'allow' }));
                        }}>
              <FormControlLabel value="default" control={<Radio />} label="Not specified (default behavior - property omitted)" />
              <FormControlLabel value="allow" control={<Radio />} label="Allow additional properties (set true)" />
              <FormControlLabel value="disallow" control={<Radio />} label="Disallow additional properties (set false)" />
            </RadioGroup>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClassDialog({ open: false, mode: 'add', selectedClass: null })}>Cancel</Button>
          <Button onClick={handleClassSubmit} variant="contained">{classDialog.mode === 'add' ? 'Add' : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      {/* Property Dialog */}
      <PropertyDialog open={propertyDialog.open} onClose={() => setPropertyDialog({ open: false, mode: 'add', selectedProperty: null })}
                      mode={propertyDialog.mode} property={propertyDialog.selectedProperty} onSubmit={handlePropertySubmit} />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, target: null })}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete this {deleteDialog.target?.type}? This action cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, target: null })}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default function StudioLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <StudioProvider>
      <StudioLayoutContent>{children}</StudioLayoutContent>
    </StudioProvider>
  );
}
