'use client';

import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import { updateClassProperty } from '../../../../../lib/db/helper';
import { PropertyFormFields, PropertyFormData } from './PropertyFormFields';
import ExtractToClassDialog from './ExtractToClassDialog';
import CallSplitIcon from '@mui/icons-material/CallSplit';

interface Props {
  open: boolean;
  onClose: () => void;
  editingClassProperty: any | null;
  // Callback to reload classes after a successful save
  // applyLayout: optional parameter to trigger layout recalculation after reload
  onSaved?: (applyLayout?: boolean) => Promise<void> | void;
  // All properties from the parent class (to show nested properties)
  allClassProperties?: Array<{
    id: string;
    name: string;
    data: any;
    description?: string;
    parent_id?: string | null;
  }>;
  // For extract to class feature
  existingClassNames?: string[];
}

export default function ClassPropertyEditDialog({ open, onClose, editingClassProperty, onSaved, allClassProperties, existingClassNames = [] }: Props) {
  const [editPropName, setEditPropName] = useState('');
  const [editPropertyError, setEditPropertyError] = useState('');
  const [extractDialogOpen, setExtractDialogOpen] = useState(false);

  // Use shared form data structure
  const [formData, setFormData] = useState<PropertyFormData>({});

  // Helper to get property type display
  const getPropertyTypeInfo = () => {
    if (!editingClassProperty) return { type: 'unknown', baseType: 'unknown', isArray: false, isNullable: false };

    const propData = typeof editingClassProperty.data === 'string'
      ? JSON.parse(editingClassProperty.data)
      : (editingClassProperty.data || {});

    // Handle nullable type arrays (OpenAPI 3.1 style)
    let actualType = propData.type;
    let isNullable = false;
    if (Array.isArray(propData.type)) {
      isNullable = propData.type.includes('null');
      actualType = propData.type.find((t: string) => t !== 'null') || 'string';
    }

    // Also check for oneOf pattern with null (used for nullable references)
    if (propData.oneOf && Array.isArray(propData.oneOf)) {
      const hasNullType = propData.oneOf.some((item: any) => item.type === 'null');
      const hasRef = propData.oneOf.some((item: any) => item.$ref);
      if (hasNullType && hasRef) {
        isNullable = true;
      }
    }

    const isArray = actualType === 'array';
    const schema = isArray ? (propData.items || {}) : propData;

    let baseType = 'unknown';
    if (schema.$ref) {
      const refParts = schema.$ref.split('/');
      baseType = refParts[refParts.length - 1] || schema.$ref;
    } else {
      baseType = schema.type || 'object';
    }

    const nullableSuffix = isNullable ? '?' : '';
    return {
      type: isArray ? `${baseType}[]${nullableSuffix}` : `${baseType}${nullableSuffix}`,
      baseType,
      isArray,
      isNullable,
      hasRef: !!schema.$ref
    };
  };

  // Check if property can be extracted to a class
  const canExtractToClass = () => {
    if (!editingClassProperty) return false;

    const propData = typeof editingClassProperty.data === 'string'
      ? JSON.parse(editingClassProperty.data)
      : (editingClassProperty.data || {});

    const isDirectObject = propData.type === 'object' && !propData.$ref;
    const isArrayOfObjects = propData.type === 'array' && propData.items?.type === 'object' && !propData.items?.$ref;

    return isDirectObject || isArrayOfObjects;
  };

  const handleExtractSuccess = async (newClassId: string, newClassName: string) => {
    setExtractDialogOpen(false);
    // Reload classes with layout applied to properly position the new class
    if (onSaved) await onSaved(true); // Pass true to apply layout
    onClose();
  };

  // Initialize form when editingClassProperty changes
  useEffect(() => {
    if (!editingClassProperty) return;

    setEditPropName(editingClassProperty.name || '');

    const propData = typeof editingClassProperty.data === 'string'
      ? JSON.parse(editingClassProperty.data)
      : (editingClassProperty.data || {});

    // Detect nullable - can be from:
    // 1. Type array like ['string', 'null']
    // 2. oneOf pattern like [{ $ref: '...' }, { type: 'null' }] for references
    let isNullable = false;
    let actualType = propData.type;

    // Check for type array pattern
    if (Array.isArray(propData.type)) {
      isNullable = propData.type.includes('null');
      actualType = propData.type.find((t: string) => t !== 'null');
    }

    // Check for oneOf pattern with null (used for nullable references)
    if (propData.oneOf && Array.isArray(propData.oneOf)) {
      const hasNullType = propData.oneOf.some((item: any) => item.type === 'null');
      const hasRef = propData.oneOf.some((item: any) => item.$ref);
      if (hasNullType && hasRef) {
        isNullable = true;
      }
    }

    // Get the actual schema (handle array types)
    const schema = actualType === 'array' ? (propData.items || {}) : propData;


    // Determine additionalProperties value
    let additionalPropsValue: 'default' | 'true' | 'false' = 'default';
    if (schema.hasOwnProperty('additionalProperties')) {
      additionalPropsValue = schema.additionalProperties === false ? 'false' : 'true';
    }

    // Extract extensions (x- prefixed properties) from the property data
    const extensions: Record<string, any> = {};
    Object.keys(propData).forEach(key => {
      if (key.startsWith('x-')) {
        extensions[key] = propData[key];
      }
    });

    // Populate form data
    setFormData({
      description: editingClassProperty.description || '',
      required: !!propData.required,
      nullable: isNullable,
      deprecated: !!propData.deprecated,
      deprecationMessage: propData.deprecationMessage || '',
      readOnly: !!propData.readOnly,
      writeOnly: !!propData.writeOnly,
      examples: propData.examples ? propData.examples.map((ex: any) => JSON.stringify(ex)) : [],

      // String constraints
      minLength: schema.minLength?.toString() || '',
      maxLength: schema.maxLength?.toString() || '',
      pattern: schema.pattern || '',
      format: schema.format || '',

      // Number constraints - detect inclusive vs exclusive
      minimum: (schema.exclusiveMinimum !== undefined ? schema.exclusiveMinimum : schema.minimum)?.toString() || '',
      maximum: (schema.exclusiveMaximum !== undefined ? schema.exclusiveMaximum : schema.maximum)?.toString() || '',
      minimumType: schema.exclusiveMinimum !== undefined ? 'exclusive' as const : (schema.minimum !== undefined ? 'inclusive' as const : undefined),
      maximumType: schema.exclusiveMaximum !== undefined ? 'exclusive' as const : (schema.maximum !== undefined ? 'inclusive' as const : undefined),
      multipleOf: schema.multipleOf?.toString() || '',

      // Array constraints
      minItems: propData.minItems?.toString() || '',
      maxItems: propData.maxItems?.toString() || '',
      uniqueItems: !!propData.uniqueItems,
      contains: propData.contains ? JSON.stringify(propData.contains, null, 2) : '',
      minContains: propData.minContains?.toString() || '',
      maxContains: propData.maxContains?.toString() || '',

      // Tuple mode (OpenAPI 3.1)
      tupleMode: propData.prefixItems && Array.isArray(propData.prefixItems) ? true : false,
      prefixItems: propData.prefixItems || [],
      itemsSchema: propData.prefixItems && propData.items !== undefined ?
        (typeof propData.items === 'object' ?
          JSON.stringify(propData.items, null, 2) :
          String(propData.items)) : '',

      // unevaluatedItems (OpenAPI 3.1/JSON Schema 2020-12)
      unevaluatedItems: propData.unevaluatedItems === true ? 'allow' :
        propData.unevaluatedItems === false ? 'disallow' :
        (typeof propData.unevaluatedItems === 'object' ? 'schema' : 'default'),
      unevaluatedItemsSchema: typeof propData.unevaluatedItems === 'object' ?
        JSON.stringify(propData.unevaluatedItems, null, 2) : '',

      // Common constraints
      default: schema.default !== undefined ? JSON.stringify(schema.default) : '',
      const: schema.const !== undefined ? (typeof schema.const === 'string' ? schema.const : JSON.stringify(schema.const)) : '',
      enum: schema.enum || [],

      // Object constraints
      additionalProperties: additionalPropsValue,
      minProperties: schema.minProperties?.toString() || '',
      maxProperties: schema.maxProperties?.toString() || '',
      patternProperties: schema.patternProperties || undefined,

      // unevaluatedProperties (OpenAPI 3.1/JSON Schema 2020-12) - for objects
      unevaluatedProperties: schema.unevaluatedProperties === true ? 'allow' :
        schema.unevaluatedProperties === false ? 'disallow' :
        (typeof schema.unevaluatedProperties === 'object' ? 'schema' : 'default'),
      unevaluatedPropertiesSchema: typeof schema.unevaluatedProperties === 'object' ?
        JSON.stringify(schema.unevaluatedProperties, null, 2) : '',

      // Property Name Constraints (OpenAPI 3.1)
      propertyNamesPattern: schema.propertyNames?.pattern || '',
      propertyNamesMinLength: schema.propertyNames?.minLength?.toString() || '',
      propertyNamesMaxLength: schema.propertyNames?.maxLength?.toString() || '',

      // NOT composition (OpenAPI 3.1)
      not: schema.not ? JSON.stringify(schema.not, null, 2) : '',

      // Extensions (x- prefixed properties)
      extensions: extensions,

      // External Documentation
      externalDocsUrl: propData.externalDocs?.url || '',
      externalDocsDescription: propData.externalDocs?.description || '',
    });


    setEditPropertyError('');
  }, [editingClassProperty]);

  const handleSave = async () => {
    if (!editingClassProperty) {
      setEditPropertyError('No property selected for editing');
      return;
    }

    if (!editPropName.trim()) {
      setEditPropertyError('Property name is required');
      return;
    }

    try {
      const originalData = typeof editingClassProperty.data === 'string'
        ? JSON.parse(editingClassProperty.data)
        : (editingClassProperty.data || {});

      const updatedData: any = {
        ...originalData,
        required: formData.required,
        deprecated: formData.deprecated,
        readOnly: formData.readOnly,
        writeOnly: formData.writeOnly,
      };

      // Handle deprecationMessage
      if (formData.deprecated && formData.deprecationMessage?.trim()) {
        updatedData.deprecationMessage = formData.deprecationMessage.trim();
      } else {
        delete updatedData.deprecationMessage;
      }

      if (formData.examples && formData.examples.length > 0) {
        try {
          updatedData.examples = formData.examples.map((ex: string) => JSON.parse(ex));
        } catch (e) {
          updatedData.examples = formData.examples;
        }
      } else {
        delete updatedData.examples;
      }

      // Handle nullable - update type to be an array with 'null' (OpenAPI 3.1 style)
      // For properties with $ref, we need to use oneOf with null instead
      // For properties with type, we use type array like ['string', 'null']

      // Check if this is a reference type (has $ref at top level or in items for arrays)
      const hasDirectRef = updatedData.$ref && !updatedData.type;

      if (hasDirectRef) {
        // For direct references like { $ref: '...' }, use oneOf pattern for nullable
        if (formData.nullable) {
          // Convert to oneOf: [{ $ref: '...' }, { type: 'null' }]
          const refValue = updatedData.$ref;
          delete updatedData.$ref;
          updatedData.oneOf = [
            { $ref: refValue },
            { type: 'null' }
          ];
        } else {
          // If there's a oneOf with null, convert back to simple $ref
          if (updatedData.oneOf && Array.isArray(updatedData.oneOf)) {
            const refItem = updatedData.oneOf.find((item: any) => item.$ref);
            if (refItem) {
              delete updatedData.oneOf;
              updatedData.$ref = refItem.$ref;
            }
          }
        }
      } else {
        // For regular types (string, number, object, array, etc.)
        let currentBaseType = updatedData.type;
        if (Array.isArray(updatedData.type)) {
          currentBaseType = updatedData.type.find((t: string) => t !== 'null');
        }

        // Only set type if we have a valid base type
        if (currentBaseType) {
          if (formData.nullable) {
            updatedData.type = [currentBaseType, 'null'];
          } else {
            updatedData.type = currentBaseType;
          }
        }
      }

      // Determine where to apply constraints (array items vs direct)
      let currentBaseType = updatedData.type;
      if (Array.isArray(updatedData.type)) {
        currentBaseType = updatedData.type.find((t: string) => t !== 'null');
      }
      const isArray = currentBaseType === 'array';
      const targetSchema = isArray ? (updatedData.items || {}) : updatedData;

      // Handle additionalProperties field (apply to direct object or array items object)
      if (formData.additionalProperties === 'true') {
        targetSchema.additionalProperties = true;
      } else if (formData.additionalProperties === 'false') {
        targetSchema.additionalProperties = false;
      } else {
        delete targetSchema.additionalProperties;
      }

      // Handle minProperties and maxProperties for objects
      if (formData.minProperties) {
        targetSchema.minProperties = parseInt(formData.minProperties);
      } else {
        delete targetSchema.minProperties;
      }
      if (formData.maxProperties) {
        targetSchema.maxProperties = parseInt(formData.maxProperties);
      } else {
        delete targetSchema.maxProperties;
      }

      // Handle patternProperties
      if (formData.patternProperties && Object.keys(formData.patternProperties).length > 0) {
        targetSchema.patternProperties = formData.patternProperties;
      } else {
        delete targetSchema.patternProperties;
      }

      // Handle unevaluatedProperties (OpenAPI 3.1/JSON Schema 2020-12) - for objects
      if (formData.unevaluatedProperties === 'allow') {
        targetSchema.unevaluatedProperties = true;
      } else if (formData.unevaluatedProperties === 'disallow') {
        targetSchema.unevaluatedProperties = false;
      } else if (formData.unevaluatedProperties === 'schema' && formData.unevaluatedPropertiesSchema?.trim()) {
        try {
          targetSchema.unevaluatedProperties = JSON.parse(formData.unevaluatedPropertiesSchema);
        } catch (e) {
          // If not valid JSON, treat as a simple type
          targetSchema.unevaluatedProperties = { type: formData.unevaluatedPropertiesSchema };
        }
      } else {
        delete targetSchema.unevaluatedProperties;
      }

      // Handle propertyNames constraints (OpenAPI 3.1)
      const hasPropertyNamesConstraints = formData.propertyNamesPattern || formData.propertyNamesMinLength || formData.propertyNamesMaxLength;
      if (hasPropertyNamesConstraints) {
        targetSchema.propertyNames = { type: 'string' };
        if (formData.propertyNamesPattern) {
          targetSchema.propertyNames.pattern = formData.propertyNamesPattern;
        }
        if (formData.propertyNamesMinLength) {
          targetSchema.propertyNames.minLength = parseInt(formData.propertyNamesMinLength);
        }
        if (formData.propertyNamesMaxLength) {
          targetSchema.propertyNames.maxLength = parseInt(formData.propertyNamesMaxLength);
        }
      } else {
        delete targetSchema.propertyNames;
      }

      // String constraints
      if (formData.minLength) targetSchema.minLength = parseInt(formData.minLength);
      else delete targetSchema.minLength;

      if (formData.maxLength) targetSchema.maxLength = parseInt(formData.maxLength);
      else delete targetSchema.maxLength;

      if (formData.pattern) targetSchema.pattern = formData.pattern;
      else delete targetSchema.pattern;

      if (formData.format) targetSchema.format = formData.format;
      else delete targetSchema.format;

      // Number constraints - OpenAPI 3.1 style (numeric exclusive values)
      if (formData.minimum && formData.minimum.trim()) {
        const minValue = parseFloat(formData.minimum);
        if (!isNaN(minValue)) {
          if (formData.minimumType === 'exclusive') {
            targetSchema.exclusiveMinimum = minValue;
            delete targetSchema.minimum;
          } else {
            targetSchema.minimum = minValue;
            delete targetSchema.exclusiveMinimum;
          }
        }
      } else {
        delete targetSchema.minimum;
        delete targetSchema.exclusiveMinimum;
      }

      if (formData.maximum && formData.maximum.trim()) {
        const maxValue = parseFloat(formData.maximum);
        if (!isNaN(maxValue)) {
          if (formData.maximumType === 'exclusive') {
            targetSchema.exclusiveMaximum = maxValue;
            delete targetSchema.maximum;
          } else {
            targetSchema.maximum = maxValue;
            delete targetSchema.exclusiveMaximum;
          }
        }
      } else {
        delete targetSchema.maximum;
        delete targetSchema.exclusiveMaximum;
      }

      if (formData.multipleOf && formData.multipleOf.trim()) {
        const multipleOfValue = parseFloat(formData.multipleOf);
        if (!isNaN(multipleOfValue) && multipleOfValue > 0) {
          targetSchema.multipleOf = multipleOfValue;
        }
      } else {
        delete targetSchema.multipleOf;
      }

      // Array constraints (on array itself, not items)
      if (isArray) {
        if (formData.minItems) updatedData.minItems = parseInt(formData.minItems);
        else delete updatedData.minItems;

        if (formData.maxItems) updatedData.maxItems = parseInt(formData.maxItems);
        else delete updatedData.maxItems;

        if (formData.uniqueItems) updatedData.uniqueItems = true;
        else delete updatedData.uniqueItems;

        // Handle contains schema (OpenAPI 3.1)
        if (formData.contains && formData.contains.trim()) {
          try {
            updatedData.contains = JSON.parse(formData.contains);
          } catch (e) {
            // If not valid JSON, treat as a simple type string
            updatedData.contains = { type: formData.contains };
          }

          // Handle minContains and maxContains (only valid when contains is set)
          if (formData.minContains) {
            const minContainsValue = parseInt(formData.minContains);
            if (!isNaN(minContainsValue) && minContainsValue >= 1) {
              updatedData.minContains = minContainsValue;
            }
          } else {
            delete updatedData.minContains;
          }

          if (formData.maxContains) {
            const maxContainsValue = parseInt(formData.maxContains);
            if (!isNaN(maxContainsValue) && maxContainsValue >= 1) {
              updatedData.maxContains = maxContainsValue;
            }
          } else {
            delete updatedData.maxContains;
          }
        } else {
          delete updatedData.contains;
          delete updatedData.minContains;
          delete updatedData.maxContains;
        }

        // Handle Tuple Mode (OpenAPI 3.1 prefixItems)
        if (formData.tupleMode && formData.prefixItems && formData.prefixItems.length > 0) {
          updatedData.prefixItems = formData.prefixItems;

          // Handle items schema for positions beyond prefix
          if (formData.itemsSchema && formData.itemsSchema.trim()) {
            try {
              updatedData.items = JSON.parse(formData.itemsSchema);
            } catch (e) {
              // If not valid JSON, treat as boolean or simple type
              updatedData.items = formData.itemsSchema === 'true' ? true :
                                  formData.itemsSchema === 'false' ? false :
                                  { type: formData.itemsSchema };
            }
          } else {
            // Default to allowing any type for items beyond prefix
            updatedData.items = true;
          }
        } else {
          // Not in tuple mode - delete prefixItems if present
          delete updatedData.prefixItems;
        }

        // Handle unevaluatedItems (OpenAPI 3.1/JSON Schema 2020-12)
        if (formData.unevaluatedItems === 'allow') {
          updatedData.unevaluatedItems = true;
        } else if (formData.unevaluatedItems === 'disallow') {
          updatedData.unevaluatedItems = false;
        } else if (formData.unevaluatedItems === 'schema' && formData.unevaluatedItemsSchema?.trim()) {
          try {
            updatedData.unevaluatedItems = JSON.parse(formData.unevaluatedItemsSchema);
          } catch (e) {
            // If not valid JSON, treat as a simple type
            updatedData.unevaluatedItems = { type: formData.unevaluatedItemsSchema };
          }
        } else {
          delete updatedData.unevaluatedItems;
        }
      }

      // Enum values and const (mutually exclusive)
      if (formData.const && formData.const.trim()) {
        try {
          targetSchema.const = JSON.parse(formData.const);
        } catch (e) {
          // If not valid JSON, use as string
          targetSchema.const = formData.const;
        }
        delete targetSchema.enum;
      } else {
        delete targetSchema.const;
        if (formData.enum && formData.enum.length > 0) {
          targetSchema.enum = formData.enum;
        } else {
          delete targetSchema.enum;
        }
      }

      // Default value
      if (formData.default?.trim()) {
        try {
          targetSchema.default = JSON.parse(formData.default);
        } catch (e) {
          targetSchema.default = formData.default;
        }
      } else {
        delete targetSchema.default;
      }

      // NOT composition (OpenAPI 3.1)
      if (formData.not && formData.not.trim()) {
        try {
          targetSchema.not = JSON.parse(formData.not);
        } catch (e) {
          // If not valid JSON, treat as a simple type
          targetSchema.not = { type: formData.not };
        }
      } else {
        delete targetSchema.not;
      }

      // Update items if it's an array (but not if tuple mode is active - already set above)
      if (isArray && !formData.tupleMode) {
        updatedData.items = targetSchema;
        // Ensure additionalProperties isn't left on the array level
        delete updatedData.additionalProperties;
      }

      // Handle extensions (x- prefixed properties)
      // First, remove any existing x- properties from updatedData
      Object.keys(updatedData).forEach(key => {
        if (key.startsWith('x-')) {
          delete updatedData[key];
        }
      });
      // Then merge in the current extensions
      if (formData.extensions && Object.keys(formData.extensions).length > 0) {
        Object.assign(updatedData, formData.extensions);
      }

      // Handle externalDocs
      if (formData.externalDocsUrl?.trim()) {
        updatedData.externalDocs = {
          url: formData.externalDocsUrl.trim()
        };
        if (formData.externalDocsDescription?.trim()) {
          updatedData.externalDocs.description = formData.externalDocsDescription.trim();
        }
      } else {
        delete updatedData.externalDocs;
      }

      const result = await updateClassProperty(
        editingClassProperty.id,
        editPropName.trim(),
        formData.description || null,
        updatedData
      );

      const response = JSON.parse(result);
      if (response.success) {
        // Notify parent to reload
        if (onSaved) await onSaved();
        onClose();
      } else {
        setEditPropertyError(response.error || 'Failed to update property');
      }
    } catch (error) {
      console.error('Error updating class property:', error);
      setEditPropertyError('An error occurred while updating the property');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Property in Class</DialogTitle>
      <DialogContent>
        {editPropertyError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {editPropertyError}
          </Alert>
        )}

        <Alert severity="info" sx={{ mb: 2 }}>
          When editing a property that is a member of a class, only the name and constraints can be modified. The type and base type are read-only.
        </Alert>

        {/* Type Information - Read Only */}
        {editingClassProperty && (
          <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1, border: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Property Type (Read-Only)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Chip
                label={getPropertyTypeInfo().type}
                color="primary"
                size="small"
                sx={{ fontFamily: 'monospace' }}
              />
              {getPropertyTypeInfo().hasRef && (
                <Typography variant="caption" color="text.secondary">
                  (References another class)
                </Typography>
              )}
            </Box>
          </Box>
        )}

        <TextField
          autoFocus
          margin="dense"
          label="Property Name"
          type="text"
          fullWidth
          required
          value={editPropName}
          onChange={(e) => setEditPropName(e.target.value)}
          sx={{ mb: 2 }}
        />


        {/* Constraints Section */}
        {editingClassProperty && (() => {
          const typeInfo = getPropertyTypeInfo();
          const propData = typeof editingClassProperty.data === 'string'
            ? JSON.parse(editingClassProperty.data)
            : (editingClassProperty.data || {});
          const schema = typeInfo.isArray ? (propData.items || {}) : propData;
          const baseType = schema.$ref ? 'reference' : (schema.type || 'object');


          // Only show constraints for non-reference types
          if (schema.$ref) return null;

          return (
            <>
              <Typography variant="subtitle2" sx={{ mt: 3, mb: 1, fontWeight: 600 }}>
                Property Details
              </Typography>

              <PropertyFormFields
                baseType={baseType}
                isArray={typeInfo.isArray}
                data={formData}
                onChange={(field, value) => {
                  setFormData(prev => ({ ...prev, [field]: value }));
                }}
                showMetadata={true}
                showTitle={false}
                size="small"
                nestedProperties={
                  baseType === 'object'
                    ? (allClassProperties || []).filter(p => p.parent_id === editingClassProperty.id)
                    : undefined
                }
              />
            </>
          );
        })()}
      </DialogContent>
      <DialogActions>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <Box>
            {canExtractToClass() && (
              <Button
                onClick={() => setExtractDialogOpen(true)}
                startIcon={<CallSplitIcon />}
                color="secondary"
                variant="outlined"
              >
                Extract to Class
              </Button>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} variant="contained">Save</Button>
          </Box>
        </Box>
      </DialogActions>

      {/* Extract to Class Dialog */}
      <ExtractToClassDialog
        open={extractDialogOpen}
        onClose={() => setExtractDialogOpen(false)}
        classProperty={editingClassProperty}
        existingClassNames={existingClassNames}
        onSuccess={handleExtractSuccess}
      />
    </Dialog>
  );
}
