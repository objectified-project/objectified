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

  const handlePropertyDialogSubmit = () => {
    if (!propertyName.trim()) {
      setPropertyError('Property name is required');
      return;
    }

    // Validate that a schema reference is selected when type is $ref
    if (propertyType === '$ref' && !propertyRef) {
      setPropertyError('Schema reference is required when type is $ref');
      return;
    }

    const propertyData: PropertyItem = {
      id: propertyDialogMode === 'add' ? Date.now().toString() : selectedProperty!.id,
      name: propertyName,
      title: propertyTitle || undefined,
      description: propertyDescription || undefined,
      required: propertyRequired,
      readOnly: propertyReadOnly,
      writeOnly: propertyWriteOnly,
    };

    // If type is $ref, use $ref field instead of type
    if (propertyType === '$ref') {
      propertyData.$ref = propertyRef;
    } else {
      // Otherwise use type and validation fields
      propertyData.type = propertyType;
      propertyData.format = propertyFormat || undefined;
      propertyData.pattern = propertyPattern || undefined;
      propertyData.minLength = propertyMinLength ? parseInt(propertyMinLength) : undefined;
      propertyData.maxLength = propertyMaxLength ? parseInt(propertyMaxLength) : undefined;
      propertyData.minimum = propertyMinimum ? parseFloat(propertyMinimum) : undefined;
      propertyData.maximum = propertyMaximum ? parseFloat(propertyMaximum) : undefined;
      propertyData.minItems = propertyMinItems ? parseInt(propertyMinItems) : undefined;
      propertyData.maxItems = propertyMaxItems ? parseInt(propertyMaxItems) : undefined;
      propertyData.enum = propertyEnum.length > 0 ? propertyEnum : undefined;
      propertyData.default = propertyDefault || undefined;
    }

    if (propertyDialogMode === 'add') {
      setProperties([...properties, propertyData]);
    } else if (selectedProperty) {
      setProperties(properties.map(prop =>
        prop.id === selectedProperty.id ? propertyData : prop
      ));
    }

    setPropertyDialogOpen(false);
    setRefreshKey(prev => prev + 1);
  };

  // Delete confirmation
  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'class') {
      setClasses(classes.filter(cls => cls.id !== deleteTarget.id));
    } else {
      setProperties(properties.filter(prop => prop.id !== deleteTarget.id));
    }

    setDeleteDialogOpen(false);
    setDeleteTarget(null);
    setRefreshKey(prev => prev + 1);
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
            sx={{ mb: 2 }}
          >
            <option value="string">string</option>
            <option value="number">number</option>
            <option value="integer">integer</option>
            <option value="boolean">boolean</option>
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
              helperText="Select a class to reference as this property's schema"
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

          {/* Enum values editor - not applicable for $ref */}
          {propertyType !== '$ref' && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <TextField
                  margin="dense"
                  label="Add Enumeration"
                  type="text"
                  fullWidth
                  placeholder="Enter a value"
                  value={propertyEnumInput}
                  onChange={(e) => setPropertyEnumInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && propertyEnumInput.trim()) {
                      e.preventDefault();
                      if (!propertyEnum.includes(propertyEnumInput.trim())) {
                        setPropertyEnum([...propertyEnum, propertyEnumInput.trim()]);
                        setPropertyEnumInput('');
                      }
                    }
                  }}
                  helperText="Press Enter or click + to add"
                  sx={{ flex: 1 }}
                />
                <IconButton
                  color="primary"
                  onClick={() => {
                    if (propertyEnumInput.trim() && !propertyEnum.includes(propertyEnumInput.trim())) {
                      setPropertyEnum([...propertyEnum, propertyEnumInput.trim()]);
                      setPropertyEnumInput('');
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

          {/* Default value - not applicable for $ref */}
          {propertyType !== '$ref' && (
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

