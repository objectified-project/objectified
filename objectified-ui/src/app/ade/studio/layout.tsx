'use client';

import "../../globals.css";
import * as React from 'react';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { StudioProvider, useStudio } from './StudioContext';
import { useDialog } from '../../components/providers/DialogProvider';

import StudioSideNav, { ClassItem, PropertyItem, StudioSideNavCallbacks } from '@/app/components/ade/studio/StudioSideNav';
import PropertyDialog from '@/app/components/ade/studio/PropertyDialog';
import ClassEditDialog from '@/app/components/ade/studio/ClassEditDialog';
import { getPropertiesForProject, createProperty, updateProperty, deleteProperty, getClassesForVersion, deleteClass, getTagsForProject } from '../../../../lib/db/helper';
import { Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText, Button } from '@mui/material';

// Helper function to check permissions
const checkPermissions = async (condition: boolean, message: string, alertDialog: any) => {
  if (!condition) {
    await alertDialog({ message, variant: 'warning' });
    return false;
  }
  return true;
};

function StudioLayoutContent({ children }: Readonly<{ children: React.ReactNode }>) {
  const { data: session } = useSession();
  const { confirm: confirmDialog, alert: alertDialog } = useDialog();
  const currentTenantId = (session?.user as any)?.current_tenant_id;
  const { selectedProjectId, selectedVersionId, triggerCanvasRefresh, sidebarRefreshKey, isReadOnly } = useStudio();

  // State
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [projectTags, setProjectTags] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoadingProperties, setIsLoadingProperties] = useState(false);

  // Dialog state
  const [classDialog, setClassDialog] = useState({ open: false, selectedClass: null as ClassItem | null });
  const [propertyDialog, setPropertyDialog] = useState({ open: false, mode: 'add' as 'add' | 'edit', selectedProperty: null as PropertyItem | null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, target: null as { type: 'class' | 'property'; id: string } | null });


  // Load project tags
  React.useEffect(() => {
    const loadProjectTags = async () => {
      if (!selectedProjectId) {
        setProjectTags([]);
        return;
      }
      try {
        const result = await getTagsForProject(selectedProjectId);
        const tags = JSON.parse(result);
        setProjectTags(tags);
      } catch (error) {
        console.error('Failed to load project tags:', error);
        setProjectTags([]);
      }
    };
    loadProjectTags();
  }, [selectedProjectId]);

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

  // Expose handleClassEdit via ref for canvas to trigger
  const handleClassEditRef = React.useRef<((classItem: ClassItem) => Promise<void>) | null>(null);
  React.useEffect(() => {
    (window as any).__studioHandleClassEdit = handleClassEditRef.current;
  }, []);

  // Class handlers
  const handleClassAdd = async () => {
    if (!(await checkPermissions(!!selectedVersionId, 'Please select a version from the canvas first', alertDialog))) return;
    if (!(await checkPermissions(!isReadOnly, 'Cannot add classes to a published version. Please select an unpublished version to make changes.', alertDialog))) return;

    // Open dialog with null class data (add mode)
    setClassDialog({ open: true, selectedClass: null });
  };

  const handleClassEdit = async (classItem: ClassItem) => {
    if (!(await checkPermissions(!!selectedVersionId, 'Please select a version from the canvas first', alertDialog))) return;
    if (!(await checkPermissions(!isReadOnly, 'Cannot edit classes in a published version. Please select an unpublished version to make changes.', alertDialog))) return;

    // Open dialog with class data (edit mode)
    setClassDialog({ open: true, selectedClass: classItem });
  };

  // Keep ref updated
  React.useEffect(() => {
    handleClassEditRef.current = handleClassEdit;
    (window as any).__studioHandleClassEdit = handleClassEdit;
  }, [handleClassEdit]);

  const handleClassDelete = async (classId: string) => {
    if (!(await checkPermissions(!!selectedVersionId, 'Please select a version from the canvas first', alertDialog))) return;
    if (!(await checkPermissions(!isReadOnly, 'Cannot delete classes from a published version. Please select an unpublished version to make changes.', alertDialog))) return;

    setDeleteDialog({ open: true, target: { type: 'class', id: classId } });
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

  // Convert classes to nodes format expected by ClassEditDialog
  const classNodes = React.useMemo(() => {
    return classes.map(cls => ({
      id: cls.id,
      type: 'classNode',
      position: { x: 0, y: 0 },
      data: {
        id: cls.id,
        name: cls.name,
        description: cls.description,
        schema: cls.schema
      }
    }));
  }, [classes]);

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
      <ClassEditDialog
        open={classDialog.open}
        onClose={() => {
          setClassDialog({ open: false, selectedClass: null });
        }}
        editingClassData={classDialog.selectedClass}
        nodes={classNodes}
        isReadOnly={isReadOnly}
        onSave={() => {
          setRefreshKey(prev => prev + 1);
          triggerCanvasRefresh();
        }}
        projectId={selectedProjectId || ''}
        versionId={selectedVersionId || ''}
        projectTags={projectTags}
      />

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
