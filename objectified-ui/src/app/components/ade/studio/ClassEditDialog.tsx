'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Autocomplete from '@mui/material/Autocomplete';
import { useColorScheme } from '@mui/material/styles';
import { Copy, Download, RefreshCw, Check, Tag as TagIcon, ExternalLink, Settings, Layers, FileText, AlertTriangle, Code, Plus, Trash2, Regex } from 'lucide-react';
import YAML from 'yaml';
import jsf from 'json-schema-faker';
import { generateClassOpenApiSpec } from '../../../utils/openapi';
import { createClass, updateClass, assignTagToClass, removeTagFromClass, getTagsForClass } from '../../../../../lib/db/helper';
import Chip from '@mui/material/Chip';
import { ExtensionsEditor } from './ExtensionsEditor';
import ConditionalSchemaBuilder, {
  ConditionalRule,
  conditionalRulesToJsonSchema,
  jsonSchemaToConditionalRules
} from './ConditionalSchemaBuilder';

// Dynamically import Monaco Editor with SSR disabled
const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <div className="text-gray-500 dark:text-gray-400">Loading editor...</div>
    </div>
  ),
});

interface ClassEditDialogProps {
  open: boolean;
  onClose: () => void;
  editingClassData: any;
  nodes: any[];
  isReadOnly?: boolean;
  onSave?: () => void;
  projectId?: string;
  versionId?: string;
  projectTags?: any[];
  projectMetadata?: {
    summary?: string;
    termsOfService?: string;
    contact?: {
      name?: string;
      url?: string;
      email?: string;
    };
    license?: {
      name?: string;
      identifier?: string;
      url?: string;
    };
  };
}

const ClassEditDialog = ({ open, onClose, editingClassData, nodes, isReadOnly = false, onSave, projectId = '', versionId = '', projectTags = [], projectMetadata }: ClassEditDialogProps) => {
  const { mode: colorMode, systemMode } = useColorScheme();
  const isDark = colorMode === 'dark' || (colorMode === 'system' && systemMode === 'dark');

  const [tabValue, setTabValue] = useState(0);
  const [exampleRefreshKey, setExampleRefreshKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openApiDoc, setOpenApiDoc] = useState<any>(null);
  const [loadingOpenApiDoc, setLoadingOpenApiDoc] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    allOf: [] as string[],
    anyOf: [] as string[],
    oneOf: [] as string[],
    discriminatorProperty: '',
    discriminatorUseAuto: true,
    discriminatorMapping: {} as Record<string, string>, // Maps property value to schema name
    additionalProperties: null as boolean | null,
    additionalPropertiesType: 'default' as 'default' | 'allow' | 'disallow' | 'schema',
    additionalPropertiesSchema: '', // Class name reference for "Must Match Schema" option
    patternProperties: [] as Array<{ pattern: string; schemaType: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'ref'; schemaRef: string }>,
    deprecated: false,
    deprecationMessage: '',
    selectedTags: [] as string[],
    extensions: {} as Record<string, any>,
    externalDocsUrl: '',
    externalDocsDescription: '',
    conditionalRules: [] as ConditionalRule[],
    error: ''
  });

  // Reset view and form when dialog opens
  useEffect(() => {
    if (open) {
      setTabValue(0);
      setExampleRefreshKey(0);

      if (editingClassData) {
        // Edit mode - populate form with existing class data
        const schema = typeof editingClassData.schema === 'string'
          ? JSON.parse(editingClassData.schema)
          : editingClassData.schema || {};

        const allOf = schema.allOf?.map((item: any) => item.$ref?.split('/').pop()).filter(Boolean) || [];
        const anyOf = schema.anyOf?.map((item: any) => item.$ref?.split('/').pop()).filter(Boolean) || [];
        const oneOf = schema.oneOf?.map((item: any) => item.$ref?.split('/').pop()).filter(Boolean) || [];

        // Extract discriminator mapping if present
        const discriminatorMapping: Record<string, string> = {};
        if (schema.discriminator?.mapping) {
          Object.entries(schema.discriminator.mapping).forEach(([key, value]) => {
            // Extract schema name from reference (e.g., "#/components/schemas/Dog" -> "Dog")
            const schemaName = typeof value === 'string' ? value.split('/').pop() || '' : '';
            if (schemaName) {
              discriminatorMapping[key] = schemaName;
            }
          });
        }

        // Extract extensions (x- prefixed properties)
        const extensions: Record<string, any> = {};
        Object.keys(schema).forEach(key => {
          if (key.startsWith('x-')) {
            extensions[key] = schema[key];
          }
        });

        // Extract conditional rules (if/then/else) from schema
        let conditionalRules: ConditionalRule[] = [];
        // Check for if/then/else in allOf array
        if (schema.allOf && Array.isArray(schema.allOf)) {
          conditionalRules = jsonSchemaToConditionalRules(schema.allOf);
        }
        // Also check for top-level if/then/else
        if (schema.if) {
          const topLevelRules = jsonSchemaToConditionalRules([{
            if: schema.if,
            then: schema.then,
            else: schema.else
          }]);
          conditionalRules.push(...topLevelRules);
        }

        // Load tags for this class
        const loadTags = async () => {
          try {
            const result = await getTagsForClass(editingClassData.id);
            const classTags = JSON.parse(result);
            const tagIds = classTags.map((ct: any) => ct.tag_id);

            // Determine additionalProperties type and schema
            let additionalPropsType: 'default' | 'allow' | 'disallow' | 'schema' = 'default';
            let additionalPropsSchema = '';
            if (schema.additionalProperties !== undefined) {
              if (schema.additionalProperties === true) {
                additionalPropsType = 'allow';
              } else if (schema.additionalProperties === false) {
                additionalPropsType = 'disallow';
              } else if (typeof schema.additionalProperties === 'object' && schema.additionalProperties.$ref) {
                additionalPropsType = 'schema';
                additionalPropsSchema = schema.additionalProperties.$ref.split('/').pop() || '';
              }
            }

            // Extract patternProperties
            const patternPropsArray: Array<{ pattern: string; schemaType: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'ref'; schemaRef: string }> = [];
            if (schema.patternProperties && typeof schema.patternProperties === 'object') {
              Object.entries(schema.patternProperties).forEach(([pattern, schemaValue]: [string, any]) => {
                if (schemaValue.$ref) {
                  patternPropsArray.push({ pattern, schemaType: 'ref', schemaRef: schemaValue.$ref.split('/').pop() || '' });
                } else if (schemaValue.type) {
                  patternPropsArray.push({ pattern, schemaType: schemaValue.type, schemaRef: '' });
                } else {
                  patternPropsArray.push({ pattern, schemaType: 'string', schemaRef: '' });
                }
              });
            }

            setFormData({
              name: editingClassData.name || '',
              description: editingClassData.description || '',
              allOf,
              anyOf,
              oneOf,
              discriminatorProperty: schema.discriminator?.propertyName || '',
              discriminatorUseAuto: !schema.discriminator?.mapping,
              discriminatorMapping,
              additionalProperties: schema.additionalProperties !== undefined ? schema.additionalProperties : null,
              additionalPropertiesType: additionalPropsType,
              additionalPropertiesSchema: additionalPropsSchema,
              patternProperties: patternPropsArray,
              deprecated: schema.deprecated || false,
              deprecationMessage: schema.deprecationMessage || '',
              selectedTags: tagIds,
              extensions,
              externalDocsUrl: schema.externalDocs?.url || '',
              externalDocsDescription: schema.externalDocs?.description || '',
              conditionalRules,
              error: ''
            });
          } catch (error) {
            console.error('Error loading tags:', error);
            // Determine additionalProperties type and schema for error case
            let additionalPropsType: 'default' | 'allow' | 'disallow' | 'schema' = 'default';
            let additionalPropsSchema = '';
            if (schema.additionalProperties !== undefined) {
              if (schema.additionalProperties === true) {
                additionalPropsType = 'allow';
              } else if (schema.additionalProperties === false) {
                additionalPropsType = 'disallow';
              } else if (typeof schema.additionalProperties === 'object' && schema.additionalProperties.$ref) {
                additionalPropsType = 'schema';
                additionalPropsSchema = schema.additionalProperties.$ref.split('/').pop() || '';
              }
            }
            // Extract patternProperties for error case
            const patternPropsArrayError: Array<{ pattern: string; schemaType: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'ref'; schemaRef: string }> = [];
            if (schema.patternProperties && typeof schema.patternProperties === 'object') {
              Object.entries(schema.patternProperties).forEach(([pattern, schemaValue]: [string, any]) => {
                if (schemaValue.$ref) {
                  patternPropsArrayError.push({ pattern, schemaType: 'ref', schemaRef: schemaValue.$ref.split('/').pop() || '' });
                } else if (schemaValue.type) {
                  patternPropsArrayError.push({ pattern, schemaType: schemaValue.type, schemaRef: '' });
                } else {
                  patternPropsArrayError.push({ pattern, schemaType: 'string', schemaRef: '' });
                }
              });
            }
            setFormData({
              name: editingClassData.name || '',
              description: editingClassData.description || '',
              allOf,
              anyOf,
              oneOf,
              discriminatorProperty: schema.discriminator?.propertyName || '',
              discriminatorUseAuto: !schema.discriminator?.mapping,
              discriminatorMapping,
              additionalProperties: schema.additionalProperties !== undefined ? schema.additionalProperties : null,
              additionalPropertiesType: additionalPropsType,
              additionalPropertiesSchema: additionalPropsSchema,
              patternProperties: patternPropsArrayError,
              deprecated: schema.deprecated || false,
              deprecationMessage: schema.deprecationMessage || '',
              selectedTags: [],
              extensions,
              externalDocsUrl: schema.externalDocs?.url || '',
              externalDocsDescription: schema.externalDocs?.description || '',
              conditionalRules,
              error: ''
            });
          }
        };

        loadTags();
      } else {
        // Add mode - reset form to empty state
        setFormData({
          name: '',
          description: '',
          allOf: [],
          anyOf: [],
          oneOf: [],
          discriminatorProperty: '',
          discriminatorUseAuto: true,
          discriminatorMapping: {},
          additionalProperties: null,
          additionalPropertiesType: 'default',
          additionalPropertiesSchema: '',
          patternProperties: [],
          deprecated: false,
          deprecationMessage: '',
          selectedTags: [],
          extensions: {},
          externalDocsUrl: '',
          externalDocsDescription: '',
          conditionalRules: [],
          error: ''
        });
      }
    }
  }, [open, editingClassData]);

  // Helper function to build schema from form data
  const buildSchemaFromFormData = () => {
    const schema: any = { type: 'object', properties: {} };

    // Add composition types
    if (formData.allOf.length > 0) {
      schema.allOf = formData.allOf.map(name => ({ $ref: `#/components/schemas/${name}` }));
    }
    if (formData.anyOf.length > 0) {
      schema.anyOf = formData.anyOf.map(name => ({ $ref: `#/components/schemas/${name}` }));
    }
    if (formData.oneOf.length > 0) {
      schema.oneOf = formData.oneOf.map(name => ({ $ref: `#/components/schemas/${name}` }));
    }

    // Add discriminator if specified
    if (formData.discriminatorProperty && (formData.allOf.length > 0 || formData.anyOf.length > 0 || formData.oneOf.length > 0)) {
      schema.discriminator = { propertyName: formData.discriminatorProperty };
      if (!formData.discriminatorUseAuto && Object.keys(formData.discriminatorMapping).length > 0) {
        // Use custom mapping
        schema.discriminator.mapping = {};
        Object.entries(formData.discriminatorMapping).forEach(([propertyValue, schemaName]) => {
          schema.discriminator.mapping[propertyValue] = `#/components/schemas/${schemaName}`;
        });
      }
    }

    // Add additionalProperties based on the selected type
    if (formData.additionalPropertiesType === 'allow') {
      schema.additionalProperties = true;
    } else if (formData.additionalPropertiesType === 'disallow') {
      schema.additionalProperties = false;
    } else if (formData.additionalPropertiesType === 'schema' && formData.additionalPropertiesSchema) {
      schema.additionalProperties = { $ref: `#/components/schemas/${formData.additionalPropertiesSchema}` };
    }
    // 'default' means no additionalProperties field is added

    // Add patternProperties if defined
    if (formData.patternProperties.length > 0) {
      schema.patternProperties = {};
      formData.patternProperties.forEach(({ pattern, schemaType, schemaRef }) => {
        if (pattern.trim()) {
          if (schemaType === 'ref' && schemaRef) {
            schema.patternProperties[pattern] = { $ref: `#/components/schemas/${schemaRef}` };
          } else {
            schema.patternProperties[pattern] = { type: schemaType };
          }
        }
      });
      // Remove patternProperties if empty after filtering
      if (Object.keys(schema.patternProperties).length === 0) {
        delete schema.patternProperties;
      }
    }

    // Add deprecated if true
    if (formData.deprecated) {
      schema.deprecated = true;
      if (formData.deprecationMessage.trim()) {
        schema.deprecationMessage = formData.deprecationMessage.trim();
      }
    }

    // Add externalDocs if URL is provided
    if (formData.externalDocsUrl.trim()) {
      schema.externalDocs = {
        url: formData.externalDocsUrl.trim()
      };
      if (formData.externalDocsDescription.trim()) {
        schema.externalDocs.description = formData.externalDocsDescription.trim();
      }
    }

    // Add extensions (x- prefixed properties)
    Object.keys(formData.extensions).forEach(key => {
      if (key.startsWith('x-')) {
        schema[key] = formData.extensions[key];
      }
    });

    // Add conditional rules (if/then/else)
    if (formData.conditionalRules.length > 0) {
      const conditionalSchemas = conditionalRulesToJsonSchema(formData.conditionalRules);
      if (conditionalSchemas.length === 1) {
        // Single rule: add at top level
        schema.if = conditionalSchemas[0].if;
        schema.then = conditionalSchemas[0].then;
        if (conditionalSchemas[0].else) {
          schema.else = conditionalSchemas[0].else;
        }
      } else if (conditionalSchemas.length > 1) {
        // Multiple rules: add to allOf array
        if (!schema.allOf) {
          schema.allOf = [];
        }
        schema.allOf.push(...conditionalSchemas);
      }
    }

    return schema;
  };

  // Generate OpenAPI doc asynchronously
  useEffect(() => {
    const generateOpenApiDocAsync = async () => {
      if (!open) return;

      setLoadingOpenApiDoc(true);
      try {
        const allClasses = nodes.map(node => node.data).filter(data => data && data.name);

        const previewClassData = editingClassData || {
          name: formData.name || 'NewClass',
          description: formData.description,
          schema: buildSchemaFromFormData()
        };

        const doc = await generateClassOpenApiSpec(previewClassData, allClasses, {
          title: `${previewClassData.name} Schema`,
          version: '1.0.0',
          description: 'OpenAPI 3.1.0 schema definition',
          metadata: projectMetadata
        });

        setOpenApiDoc(doc);
      } catch (error) {
        console.error('Failed to generate OpenAPI doc:', error);
        setOpenApiDoc(null);
      } finally {
        setLoadingOpenApiDoc(false);
      }
    };

    generateOpenApiDocAsync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingClassData, formData.name, formData.description, formData.allOf, formData.anyOf, formData.oneOf, formData.discriminatorProperty, formData.discriminatorUseAuto, formData.additionalProperties, nodes]);

  // Get all available class names for composition selectors (excluding current class)
  const availableClasses = nodes
    .map(node => node.data)
    .filter(data => data && data.name && (!editingClassData || data.name !== editingClassData.name))
    .map(data => data.name);

  // Save handler
  const handleSave = async () => {
    if (!formData.name.trim()) {
      setFormData(prev => ({ ...prev, error: 'Class name is required' }));
      return;
    }

    // For create mode, versionId is required
    if (!editingClassData && !versionId) {
      setFormData(prev => ({ ...prev, error: 'Version ID is required to create a class' }));
      return;
    }

    setSaving(true);
    setFormData(prev => ({ ...prev, error: '' }));

    try {
      // Build schema from form data
      const schema = buildSchemaFromFormData();

      let result: string;
      let classId: string;

      if (editingClassData) {
        // Update existing class
        result = await updateClass(
          editingClassData.id,
          formData.name,
          formData.description || null,
          schema
        );
        classId = editingClassData.id;
      } else {
        // Create new class
        result = await createClass(
          versionId!,
          formData.name,
          formData.description || null,
          schema
        );
        const response = JSON.parse(result);
        if (response.success && response.class) {
          classId = response.class.id;
        } else {
          setFormData(prev => ({ ...prev, error: response.error || 'Failed to create class' }));
          setSaving(false);
          return;
        }
      }

      const response = JSON.parse(result);
      if (!response.success) {
        setFormData(prev => ({ ...prev, error: response.error || 'Failed to save class' }));
        setSaving(false);
        return;
      }

      // Update tag assignments
      if (projectId && classId!) {
        try {
          // Get current tags
          const currentTagsResult = await getTagsForClass(classId);
          const currentTags = JSON.parse(currentTagsResult);
          const currentTagIds = currentTags.map((ct: any) => ct.tag_id);

          // Find tags to add and remove
          const tagsToAdd = formData.selectedTags.filter(id => !currentTagIds.includes(id));
          const tagsToRemove = currentTagIds.filter((id: string) => !formData.selectedTags.includes(id));

          // Add new tags
          for (const tagId of tagsToAdd) {
            await assignTagToClass(classId, tagId);
          }

          // Remove old tags
          for (const tagId of tagsToRemove) {
            await removeTagFromClass(classId, tagId);
          }
        } catch (error) {
          console.error('Error updating tags:', error);
          // Don't fail the whole save if tag update fails
        }
      }

      // Success - call onSave callback and close
      if (onSave) {
        onSave();
      }
      onClose();
    } catch (error) {
      console.error('Error saving class:', error);
      setFormData(prev => ({ ...prev, error: 'An error occurred while saving the class' }));
    } finally {
      setSaving(false);
    }
  };

  // Get the preview class data for display
  const previewClassData = editingClassData || {
    name: formData.name || 'NewClass',
    description: formData.description,
    schema: { type: 'object', properties: {} }
  };

  // Get the class schema from the generated OpenAPI doc (with null check)
  const classSchema = openApiDoc?.components?.schemas?.[previewClassData.name];

  // Helper function to resolve $ref references in a schema
  const resolveRefs = (schema: any, schemas: any, visited: Set<string> = new Set(), path: string = ''): any => {
    if (!schema || typeof schema !== 'object') return schema;

    // Preprocess: Convert prefixItems to items array format for json-schema-faker compatibility
    // json-schema-faker doesn't support prefixItems (JSON Schema 2020-12), so we convert it
    if (schema.prefixItems && Array.isArray(schema.prefixItems)) {
      const processedSchema = { ...schema };

      // If items is true or an empty object, it means "allow any additional items"
      // For json-schema-faker, we'll use the prefixItems as a tuple
      if (schema.items === true || (schema.items && Object.keys(schema.items).length === 0)) {
        // Use prefixItems as items for tuple generation
        processedSchema.items = schema.prefixItems;
        delete processedSchema.prefixItems;

        // Set minItems and maxItems to match prefixItems length for consistent generation
        if (!processedSchema.minItems) {
          processedSchema.minItems = schema.prefixItems.length;
        }
        if (!processedSchema.maxItems) {
          processedSchema.maxItems = schema.prefixItems.length;
        }
      } else if (schema.items) {
        // If there's both prefixItems and items, merge them
        // This is tricky - for now, just use prefixItems as the tuple
        processedSchema.items = schema.prefixItems;
        delete processedSchema.prefixItems;
        processedSchema.minItems = schema.prefixItems.length;
        processedSchema.maxItems = schema.prefixItems.length;
      } else {
        // No items specified, use prefixItems as items
        processedSchema.items = schema.prefixItems;
        delete processedSchema.prefixItems;
        processedSchema.minItems = schema.prefixItems.length;
        processedSchema.maxItems = schema.prefixItems.length;
      }

      schema = processedSchema;
    }

    // Handle $ref
    if (schema.$ref && typeof schema.$ref === 'string') {
      const refPath = schema.$ref.split('/');
      const refName = refPath[refPath.length - 1];

      // Prevent circular references
      if (visited.has(refName)) {
        return { type: 'object', description: `Circular reference to ${refName}` };
      }

      const referencedSchema = schemas[refName];
      if (referencedSchema) {
        const newVisited = new Set(visited);
        newVisited.add(refName);
        return resolveRefs(referencedSchema, schemas, newVisited, `${path}/${refName}`);
      }
      return schema; // Can't resolve, return as-is
    }

    // Handle allOf by merging schemas
    if (Array.isArray(schema.allOf)) {
      const merged: any = {};
      const requiredSet = new Set<string>();

      schema.allOf.forEach((subSchema: any, index: number) => {
        const resolved = resolveRefs(subSchema, schemas, visited, `${path}/allOf[${index}]`);

        // Extract required before merging to handle it separately
        const { required: resolvedRequired, properties: resolvedProperties, ...resolvedRest } = resolved;

        // Merge non-properties/required fields
        Object.assign(merged, resolvedRest);

        // Merge properties
        if (resolvedProperties) {
          merged.properties = { ...merged.properties, ...resolvedProperties };
        }

        // Merge required arrays (use Set to avoid duplicates)
        if (resolvedRequired) {
          resolvedRequired.forEach((field: string) => requiredSet.add(field));
        }
      });

      // Convert Set back to array if there are required fields
      if (requiredSet.size > 0) {
        merged.required = Array.from(requiredSet);
      }

      // Keep other properties from the original schema
      const { allOf, required: restRequired, properties: restProperties, ...rest } = schema;

      // Merge properties from original schema (these are additional properties)
      if (restProperties) {
        merged.properties = { ...merged.properties, ...restProperties };
      }

      // Merge required from original schema
      if (restRequired) {
        restRequired.forEach((field: string) => requiredSet.add(field));
        merged.required = Array.from(requiredSet);
      }

      return { ...merged, ...rest };
    }

    // Handle anyOf and oneOf
    if (Array.isArray(schema.anyOf)) {
      return {
        ...schema,
        anyOf: schema.anyOf.map((s: any, index: number) =>
          resolveRefs(s, schemas, visited, `${path}/anyOf[${index}]`)
        )
      };
    }

    if (Array.isArray(schema.oneOf)) {
      return {
        ...schema,
        oneOf: schema.oneOf.map((s: any, index: number) =>
          resolveRefs(s, schemas, visited, `${path}/oneOf[${index}]`)
        )
      };
    }

    // Recursively resolve nested objects and arrays
    const resolved: any = Array.isArray(schema) ? [] : {};
    for (const key in schema) {
      if (schema.hasOwnProperty(key)) {
        // Don't recursively resolve primitive values or strings that aren't schemas
        const value = schema[key];
        if (value && typeof value === 'object') {
          resolved[key] = resolveRefs(value, schemas, visited, `${path}/${key}`);
        } else {
          resolved[key] = value;
        }
      }
    }
    return resolved;
  };

  // Generate schema content based on current tab
  let schemaContent: string = '';

  if (loadingOpenApiDoc || !openApiDoc) {
    schemaContent = '// Loading schema...';
  } else if (tabValue === 1) {
    // JSON view
    schemaContent = JSON.stringify(openApiDoc, null, 2);
  } else if (tabValue === 2) {
    // YAML view
    schemaContent = YAML.stringify(openApiDoc, { lineWidth: 0, aliasDuplicateObjects: false } as any);
  } else if (tabValue === 3) {
    // Example view - regenerate when exampleRefreshKey changes
    try {
      // Resolve all $ref references for json-schema-faker
      const resolvedSchema = resolveRefs(classSchema, openApiDoc.components.schemas);

      // Debug: Log the resolved schema to verify allOf merging
      console.log('Original schema:', classSchema);
      console.log('Resolved schema for example generation:', resolvedSchema);
      console.log('Resolved schema properties:', resolvedSchema.properties);

      // Use exampleRefreshKey in random seed to force regeneration
      jsf.option({
        random: () => {
          // Mix in exampleRefreshKey to ensure different results on each refresh
          const seed = Math.random() * (exampleRefreshKey + 1);
          return seed - Math.floor(seed);
        }
      });

      const fakeData = jsf.generate(resolvedSchema);
      schemaContent = JSON.stringify(fakeData, null, 2);
    } catch (error) {
      console.error('Error generating fake data:', error);
      schemaContent = JSON.stringify({
        error: 'Could not generate example data',
        message: error instanceof Error ? error.message : String(error)
      }, null, 2);
    }
  }

  const handleCopy = () => {
    if (!openApiDoc) return;

    let content: string;
    if (tabValue === 3) {
      // Example view
      try {
        const resolvedSchema = resolveRefs(classSchema, openApiDoc.components.schemas);
        const fakeData = jsf.generate(resolvedSchema);
        content = JSON.stringify(fakeData, null, 2);
      } catch (error) {
        console.error('Error generating fake data:', error);
        content = JSON.stringify({ error: 'Could not generate example data' }, null, 2);
      }
    } else if (tabValue === 2) {
      // YAML view
      content = YAML.stringify(openApiDoc, { lineWidth: 0, aliasDuplicateObjects: false } as any);
    } else {
      // JSON view
      content = JSON.stringify(openApiDoc, null, 2);
    }

    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    if (!openApiDoc) return;

    let content: string;
    let filenameSuffix: string;
    let mimeType: string;
    let extension: string;

    if (tabValue === 3) {
      // Example view
      try {
        const resolvedSchema = resolveRefs(classSchema, openApiDoc.components.schemas);
        const fakeData = jsf.generate(resolvedSchema);
        content = JSON.stringify(fakeData, null, 2);
      } catch (error) {
        console.error('Error generating fake data:', error);
        content = JSON.stringify({ error: 'Could not generate example data' }, null, 2);
      }
      filenameSuffix = 'example';
      mimeType = 'application/json';
      extension = 'json';
    } else if (tabValue === 2) {
      // YAML view
      content = YAML.stringify(openApiDoc, { lineWidth: 0, aliasDuplicateObjects: false } as any);
      filenameSuffix = 'schema';
      mimeType = 'text/yaml';
      extension = 'yaml';
    } else {
      // JSON view
      content = JSON.stringify(openApiDoc, null, 2);
      filenameSuffix = 'schema';
      mimeType = 'application/json';
      extension = 'json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${previewClassData.name.toLowerCase()}-${filenameSuffix}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            height: '90vh',
            maxHeight: '900px',
            bgcolor: isDark ? '#1e293b' : 'background.paper',
          }
        }
      }}
    >
      <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider', pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6" component="span">
              {!editingClassData ? 'Add Class' : isReadOnly ? `View Class: ${formData.name || editingClassData.name}` : `Edit Class: ${formData.name || editingClassData.name}`}
            </Typography>
            {isReadOnly && (
              <Typography
                variant="caption"
                sx={{
                  color: '#000',
                  bgcolor: '#fbbf24',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  fontWeight: 600,
                  fontSize: '0.75rem'
                }}
              >
                Read Only
              </Typography>
            )}
          </Box>
        </Box>
      </DialogTitle>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Edit" />
          <Tab label="JSON" />
          <Tab label="YAML" />
          <Tab label="Example" />
        </Tabs>
      </Box>

      <DialogContent sx={{ p: tabValue === 0 ? 0 : 0, overflow: tabValue === 0 ? 'auto' : 'hidden' }}>
        {/* Tab 0: Edit Form */}
        {tabValue === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {formData.error && <Alert severity="error" sx={{ m: 2, mb: 0 }}>{formData.error}</Alert>}

            {/* ═══════════════════════════════════════════════════════════════════════════
                SECTION 1: Basic Information
                ═══════════════════════════════════════════════════════════════════════════ */}
            <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <FileText size={18} style={{ color: '#6366f1' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: isDark ? '#e2e8f0' : 'inherit' }}>
                  Basic Information
                </Typography>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 2 }}>
                <TextField
                  autoFocus
                  label="Class Name"
                  fullWidth
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value.replace(/[^A-Za-z0-9_]/g, '') }))}
                  helperText="PascalCase recommended (e.g., UserAccount)"
                  disabled={isReadOnly}
                  size="small"
                />

                <TextField
                  label="Description"
                  fullWidth
                  multiline
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  helperText="Brief description of what this class represents"
                  disabled={isReadOnly}
                  size="small"
                />
              </Box>

              {/* Tags - inline with basic info */}
              {projectId && projectTags && projectTags.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Autocomplete
                    multiple
                    options={projectTags.map((tag: any) => tag.id)}
                    value={formData.selectedTags}
                    onChange={(_, newValue) => setFormData(prev => ({ ...prev, selectedTags: newValue }))}
                    disabled={isReadOnly}
                    size="small"
                    getOptionLabel={(tagId) => {
                      const tag = projectTags.find((t: any) => t.id === tagId);
                      return tag ? tag.name : tagId;
                    }}
                    renderTags={(value, getTagProps) =>
                      value.map((tagId, index) => {
                        const tag = projectTags.find((t: any) => t.id === tagId);
                        return (
                          <Chip
                            label={tag?.name || tagId}
                            color={tag?.color as any || 'default'}
                            size="small"
                            {...getTagProps({ index })}
                          />
                        );
                      })
                    }
                    renderOption={(props, tagId) => {
                      const tag = projectTags.find((t: any) => t.id === tagId);
                      return (
                        <li {...props}>
                          <Chip
                            label={tag?.name || tagId}
                            color={tag?.color as any || 'default'}
                            size="small"
                            sx={{ mr: 1 }}
                          />
                          {tag?.description || ''}
                        </li>
                      );
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Tags"
                        placeholder="Select tags to organize this class..."
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <>
                              <TagIcon size={16} style={{ marginLeft: 8, marginRight: 4, color: '#9ca3af' }} />
                              {params.InputProps.startAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                  />
                </Box>
              )}
            </Box>

            {/* ═══════════════════════════════════════════════════════════════════════════
                SECTION 2: Schema Behavior (Two-column layout)
                ═══════════════════════════════════════════════════════════════════════════ */}
            <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', bgcolor: isDark ? '#0f172a' : '#fafafa' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Settings size={18} style={{ color: '#6366f1' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: isDark ? '#e2e8f0' : 'inherit' }}>
                  Schema Settings
                </Typography>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
                {/* Additional Properties */}
                <Box sx={{ p: 2, bgcolor: isDark ? '#1e293b' : 'white', borderRadius: 2, border: 1, borderColor: 'divider' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1.5, color: isDark ? '#e2e8f0' : 'inherit' }}>
                    Additional Properties
                  </Typography>
                  <RadioGroup
                    value={formData.additionalPropertiesType}
                    onChange={(e) => {
                      const value = e.target.value as 'default' | 'allow' | 'disallow' | 'schema';
                      setFormData(prev => ({
                        ...prev,
                        additionalPropertiesType: value,
                        additionalProperties: value === 'default' ? null : value === 'allow' ? true : value === 'disallow' ? false : null,
                        additionalPropertiesSchema: value === 'schema' ? prev.additionalPropertiesSchema : ''
                      }));
                    }}
                    sx={{ gap: 0.5 }}
                  >
                    <FormControlLabel
                      value="default"
                      control={<Radio size="small" />}
                      label={<Typography variant="body2">Not specified (default)</Typography>}
                      disabled={isReadOnly}
                      sx={{ m: 0 }}
                    />
                    <FormControlLabel
                      value="allow"
                      control={<Radio size="small" />}
                      label={<Typography variant="body2">Allow Any (true)</Typography>}
                      disabled={isReadOnly}
                      sx={{ m: 0 }}
                    />
                    <FormControlLabel
                      value="disallow"
                      control={<Radio size="small" />}
                      label={<Typography variant="body2">Disallow (false)</Typography>}
                      disabled={isReadOnly}
                      sx={{ m: 0 }}
                    />
                    <FormControlLabel
                      value="schema"
                      control={<Radio size="small" />}
                      label={<Typography variant="body2">Must Match Schema</Typography>}
                      disabled={isReadOnly}
                      sx={{ m: 0 }}
                    />
                  </RadioGroup>
                  {formData.additionalPropertiesType === 'schema' && (
                    <Box sx={{ mt: 1.5, ml: 3 }}>
                      <Autocomplete
                        options={availableClasses}
                        value={formData.additionalPropertiesSchema || null}
                        onChange={(_, newValue) => setFormData(prev => ({ ...prev, additionalPropertiesSchema: newValue || '' }))}
                        disabled={isReadOnly}
                        size="small"
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Schema Reference"
                            placeholder="Select a class..."
                            helperText="Additional properties must conform to this schema"
                          />
                        )}
                      />
                    </Box>
                  )}
                </Box>

                {/* Deprecation Status */}
                <Box sx={{
                  p: 2,
                  bgcolor: formData.deprecated ? (isDark ? '#78350f' : '#fef3c7') : (isDark ? '#1e293b' : 'white'),
                  borderRadius: 2,
                  border: 1,
                  borderColor: formData.deprecated ? '#fbbf24' : 'divider',
                  transition: 'all 0.2s ease'
                }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.deprecated}
                        onChange={(e) => setFormData(prev => ({ ...prev, deprecated: e.target.checked }))}
                        disabled={isReadOnly}
                        size="small"
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AlertTriangle size={16} style={{ color: formData.deprecated ? '#d97706' : '#9ca3af' }} />
                        <Typography variant="body2" sx={{ fontWeight: 600, color: isDark ? '#e2e8f0' : 'inherit' }}>
                          Mark as Deprecated
                        </Typography>
                      </Box>
                    }
                    sx={{ m: 0, mb: formData.deprecated ? 1.5 : 0 }}
                  />
                  {formData.deprecated && (
                    <TextField
                      label="Deprecation Message"
                      fullWidth
                      multiline
                      rows={2}
                      placeholder="e.g., Use NewClass instead. Will be removed in v2.0."
                      value={formData.deprecationMessage}
                      onChange={(e) => setFormData(prev => ({ ...prev, deprecationMessage: e.target.value }))}
                      disabled={isReadOnly}
                      size="small"
                    />
                  )}
                </Box>
              </Box>
            </Box>

            {/* ═══════════════════════════════════════════════════════════════════════════
                SECTION 2.5: Pattern Properties
                ═══════════════════════════════════════════════════════════════════════════ */}
            <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Regex size={18} style={{ color: '#6366f1' }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: isDark ? '#e2e8f0' : 'inherit' }}>
                    Pattern Properties
                  </Typography>
                  <Typography variant="caption" sx={{ color: isDark ? '#94a3b8' : 'text.secondary', ml: 1 }}>
                    (Optional)
                  </Typography>
                </Box>
                {!isReadOnly && (
                  <Button
                    size="small"
                    startIcon={<Plus size={14} />}
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      patternProperties: [...prev.patternProperties, { pattern: '', schemaType: 'string', schemaRef: '' }]
                    }))}
                    variant="outlined"
                  >
                    Add Pattern
                  </Button>
                )}
              </Box>
              <Typography variant="caption" sx={{ display: 'block', mb: 2, color: isDark ? '#94a3b8' : 'text.secondary' }}>
                Define regex patterns that map dynamic property names to schemas. Example: <code>^x-</code> matches all extension properties.
              </Typography>

              {formData.patternProperties.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center', bgcolor: isDark ? '#1e293b' : '#f8fafc', borderRadius: 2, border: '1px dashed', borderColor: isDark ? '#475569' : '#cbd5e1' }}>
                  <Typography variant="body2" sx={{ color: isDark ? '#94a3b8' : 'text.secondary' }}>
                    No pattern properties defined. Click "Add Pattern" to create one.
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {formData.patternProperties.map((patternProp, index) => (
                    <Box
                      key={index}
                      sx={{
                        p: 2,
                        bgcolor: isDark ? '#1e293b' : 'white',
                        borderRadius: 2,
                        border: 1,
                        borderColor: 'divider',
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr auto' },
                        gap: 2,
                        alignItems: 'start'
                      }}
                    >
                      <TextField
                        label="Regex Pattern"
                        value={patternProp.pattern}
                        onChange={(e) => {
                          const newPatternProps = [...formData.patternProperties];
                          newPatternProps[index] = { ...newPatternProps[index], pattern: e.target.value };
                          setFormData(prev => ({ ...prev, patternProperties: newPatternProps }));
                        }}
                        disabled={isReadOnly}
                        size="small"
                        placeholder="^x-.*$"
                        helperText="JavaScript regex pattern"
                        InputProps={{
                          sx: { fontFamily: 'monospace' }
                        }}
                      />

                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Autocomplete
                          options={['string', 'number', 'integer', 'boolean', 'object', 'array', 'ref'] as const}
                          value={patternProp.schemaType}
                          onChange={(_, newValue) => {
                            const newPatternProps = [...formData.patternProperties];
                            newPatternProps[index] = {
                              ...newPatternProps[index],
                              schemaType: newValue || 'string',
                              schemaRef: newValue === 'ref' ? newPatternProps[index].schemaRef : ''
                            };
                            setFormData(prev => ({ ...prev, patternProperties: newPatternProps }));
                          }}
                          disabled={isReadOnly}
                          size="small"
                          disableClearable
                          sx={{ flex: 1 }}
                          getOptionLabel={(option) => option === 'ref' ? 'Schema Reference' : option.charAt(0).toUpperCase() + option.slice(1)}
                          renderInput={(params) => (
                            <TextField {...params} label="Type" />
                          )}
                        />

                        {patternProp.schemaType === 'ref' && (
                          <Autocomplete
                            options={availableClasses}
                            value={patternProp.schemaRef || null}
                            onChange={(_, newValue) => {
                              const newPatternProps = [...formData.patternProperties];
                              newPatternProps[index] = { ...newPatternProps[index], schemaRef: newValue || '' };
                              setFormData(prev => ({ ...prev, patternProperties: newPatternProps }));
                            }}
                            disabled={isReadOnly}
                            size="small"
                            sx={{ flex: 1 }}
                            renderInput={(params) => (
                              <TextField {...params} label="Schema" placeholder="Select class..." />
                            )}
                          />
                        )}
                      </Box>

                      {!isReadOnly && (
                        <Button
                          size="small"
                          color="error"
                          onClick={() => {
                            const newPatternProps = formData.patternProperties.filter((_, i) => i !== index);
                            setFormData(prev => ({ ...prev, patternProperties: newPatternProps }));
                          }}
                          sx={{ minWidth: 'auto', p: 1 }}
                        >
                          <Trash2 size={16} />
                        </Button>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            {/* ═══════════════════════════════════════════════════════════════════════════
                SECTION 3: Composition/Inheritance
                ═══════════════════════════════════════════════════════════════════════════ */}
            <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Layers size={18} style={{ color: '#6366f1' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: isDark ? '#e2e8f0' : 'inherit' }}>
                  Composition & Inheritance
                </Typography>
                <Typography variant="caption" sx={{ color: isDark ? '#94a3b8' : 'text.secondary', ml: 1 }}>
                  (Optional)
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ display: 'block', mb: 2, color: isDark ? '#94a3b8' : 'text.secondary' }}>
                Define relationships with other classes using OpenAPI composition keywords
              </Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
                {/* allOf */}
                <Box sx={{ p: 2, bgcolor: isDark ? '#312e81' : '#eef2ff', borderRadius: 2, border: '1px solid #c7d2fe' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: isDark ? '#c7d2fe' : '#4338ca' }}>
                    allOf (Inheritance)
                  </Typography>
                  <Autocomplete
                    multiple
                    options={availableClasses}
                    value={formData.allOf}
                    onChange={(_, newValue) => setFormData(prev => ({ ...prev, allOf: newValue }))}
                    disabled={isReadOnly}
                    size="small"
                    renderTags={(value, getTagProps) =>
                      value.map((name, index) => (
                        <Chip label={name} color="primary" size="small" {...getTagProps({ index })} />
                      ))
                    }
                    renderInput={(params) => (
                      <TextField {...params} placeholder="Select classes..." size="small" />
                    )}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Must match ALL listed schemas
                  </Typography>
                </Box>

                {/* anyOf */}
                <Box sx={{ p: 2, bgcolor: isDark ? '#78350f' : '#fef3c7', borderRadius: 2, border: '1px solid #fcd34d' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: isDark ? '#fcd34d' : '#b45309' }}>
                    anyOf (Alternatives)
                  </Typography>
                  <Autocomplete
                    multiple
                    options={availableClasses}
                    value={formData.anyOf}
                    onChange={(_, newValue) => setFormData(prev => ({ ...prev, anyOf: newValue }))}
                    disabled={isReadOnly}
                    size="small"
                    renderTags={(value, getTagProps) =>
                      value.map((name, index) => (
                        <Chip label={name} color="warning" size="small" {...getTagProps({ index })} />
                      ))
                    }
                    renderInput={(params) => (
                      <TextField {...params} placeholder="Select classes..." size="small" />
                    )}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Must match AT LEAST one schema
                  </Typography>
                </Box>

                {/* oneOf */}
                <Box sx={{ p: 2, bgcolor: isDark ? '#581c87' : '#f3e8ff', borderRadius: 2, border: '1px solid #d8b4fe' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: isDark ? '#e9d5ff' : '#7c3aed' }}>
                    oneOf (Exclusive)
                  </Typography>
                  <Autocomplete
                    multiple
                    options={availableClasses}
                    value={formData.oneOf}
                    onChange={(_, newValue) => setFormData(prev => ({ ...prev, oneOf: newValue }))}
                    disabled={isReadOnly}
                    size="small"
                    renderTags={(value, getTagProps) =>
                      value.map((name, index) => (
                        <Chip label={name} color="secondary" size="small" {...getTagProps({ index })} />
                      ))
                    }
                    renderInput={(params) => (
                      <TextField {...params} placeholder="Select classes..." size="small" />
                    )}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Must match EXACTLY one schema
                  </Typography>
                </Box>
              </Box>

              {/* Discriminator - Only show when composition is used */}
              {(formData.allOf.length > 0 || formData.anyOf.length > 0 || formData.oneOf.length > 0) && (
                <Box sx={{ mt: 3, p: 2, bgcolor: isDark ? '#1e293b' : '#f8fafc', borderRadius: 2, border: isDark ? '1px dashed #475569' : '1px dashed #cbd5e1' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: isDark ? '#e2e8f0' : 'inherit' }}>
                    Discriminator Configuration
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mb: 2, color: isDark ? '#94a3b8' : 'text.secondary' }}>
                    Helps tools understand which schema variant to use for polymorphic types
                  </Typography>

                  <TextField
                    label="Discriminator Property"
                    fullWidth
                    size="small"
                    placeholder="e.g., type, petType, kind"
                    value={formData.discriminatorProperty}
                    onChange={(e) => setFormData(prev => ({ ...prev, discriminatorProperty: e.target.value }))}
                    helperText="Property name that indicates which schema variant applies"
                    sx={{ mb: 2 }}
                    disabled={isReadOnly}
                  />

                  {formData.discriminatorProperty && (
                    <>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.discriminatorUseAuto}
                            onChange={(e) => {
                              const useAuto = e.target.checked;
                              setFormData(prev => ({
                                ...prev,
                                discriminatorUseAuto: useAuto,
                                discriminatorMapping: useAuto ? {} : prev.discriminatorMapping
                              }));
                            }}
                            disabled={isReadOnly}
                            size="small"
                          />
                        }
                        label={<Typography variant="body2">Use automatic mapping (based on schema names)</Typography>}
                        sx={{ mb: 2 }}
                      />

                      {!formData.discriminatorUseAuto && (
                        <Box sx={{ p: 2, bgcolor: isDark ? '#0f172a' : 'white', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: isDark ? '#e2e8f0' : 'inherit' }}>
                            Explicit Mapping
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {(() => {
                              const schemas = formData.oneOf.length > 0 ? formData.oneOf :
                                            formData.anyOf.length > 0 ? formData.anyOf :
                                            formData.allOf;

                              return schemas.map((schemaName) => {
                                const currentValue = Object.entries(formData.discriminatorMapping)
                                  .find(([_, name]) => name === schemaName)?.[0] || '';

                                return (
                                  <Box key={schemaName} sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 1, alignItems: 'center' }}>
                                    <TextField
                                      size="small"
                                      placeholder={`e.g., ${schemaName.toLowerCase()}`}
                                      value={currentValue}
                                      onChange={(e) => {
                                        const newValue = e.target.value;
                                        setFormData(prev => {
                                          const newMapping = { ...prev.discriminatorMapping };
                                          Object.keys(newMapping).forEach(key => {
                                            if (newMapping[key] === schemaName) {
                                              delete newMapping[key];
                                            }
                                          });
                                          if (newValue.trim()) {
                                            newMapping[newValue.trim()] = schemaName;
                                          }
                                          return { ...prev, discriminatorMapping: newMapping };
                                        });
                                      }}
                                      disabled={isReadOnly}
                                      label="Value"
                                    />
                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>→</Typography>
                                    <Box sx={{ p: 1, bgcolor: 'primary.lighter', borderRadius: 1, border: 1, borderColor: 'primary.main', textAlign: 'center' }}>
                                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{schemaName}</Typography>
                                    </Box>
                                  </Box>
                                );
                              });
                            })()}
                          </Box>

                          {(() => {
                            const schemas = formData.oneOf.length > 0 ? formData.oneOf :
                                          formData.anyOf.length > 0 ? formData.anyOf :
                                          formData.allOf;
                            const mappedSchemas = new Set(Object.values(formData.discriminatorMapping));
                            const unmappedSchemas = schemas.filter(s => !mappedSchemas.has(s));

                            return unmappedSchemas.length > 0 && (
                              <Alert severity="warning" sx={{ mt: 2 }} icon={<AlertTriangle size={16} />}>
                                <Typography variant="caption">
                                  <strong>Unmapped:</strong> {unmappedSchemas.join(', ')}
                                </Typography>
                              </Alert>
                            );
                          })()}
                        </Box>
                      )}
                    </>
                  )}
                </Box>
              )}
            </Box>

            {/* ═══════════════════════════════════════════════════════════════════════════
                SECTION 3.5: Conditional Schema (if/then/else)
                ═══════════════════════════════════════════════════════════════════════════ */}
            <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', bgcolor: isDark ? '#0f172a' : '#fafafa' }}>
              <ConditionalSchemaBuilder
                rules={formData.conditionalRules}
                onChange={(rules) => setFormData(prev => ({ ...prev, conditionalRules: rules }))}
                availableProperties={
                  editingClassData?.properties?.map((p: any) => p.name) || []
                }
                disabled={isReadOnly}
              />
            </Box>

            {/* ═══════════════════════════════════════════════════════════════════════════
                SECTION 4: Documentation & Extensions (Two-column)
                ═══════════════════════════════════════════════════════════════════════════ */}
            <Box sx={{ p: 3, bgcolor: isDark ? '#0f172a' : '#fafafa' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
                {/* External Documentation */}
                <Box sx={{ p: 2, bgcolor: isDark ? '#1e293b' : 'white', borderRadius: 2, border: 1, borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <ExternalLink size={16} style={{ color: '#6366f1' }} />
                    <Typography variant="body2" sx={{ fontWeight: 600, color: isDark ? '#e2e8f0' : 'inherit' }}>
                      External Documentation
                    </Typography>
                  </Box>

                  <TextField
                    label="Documentation URL"
                    fullWidth
                    type="url"
                    size="small"
                    value={formData.externalDocsUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, externalDocsUrl: e.target.value }))}
                    placeholder="https://docs.example.com/..."
                    sx={{ mb: 2 }}
                    disabled={isReadOnly}
                    InputProps={{
                      endAdornment: formData.externalDocsUrl.trim() && (
                        <Button
                          size="small"
                          onClick={() => {
                            const url = formData.externalDocsUrl.trim();
                            if (url) window.open(url, '_blank', 'noopener,noreferrer');
                          }}
                          disabled={isReadOnly}
                          sx={{ minWidth: 'auto', px: 1 }}
                        >
                          <ExternalLink size={14} />
                        </Button>
                      ),
                    }}
                  />

                  <TextField
                    label="Description"
                    fullWidth
                    multiline
                    rows={2}
                    size="small"
                    value={formData.externalDocsDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, externalDocsDescription: e.target.value }))}
                    placeholder="Brief description of external docs"
                    disabled={isReadOnly}
                  />
                </Box>

                {/* Extensions */}
                <Box sx={{ p: 2, bgcolor: isDark ? '#1e293b' : 'white', borderRadius: 2, border: 1, borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Code size={16} style={{ color: '#6366f1' }} />
                    <Typography variant="body2" sx={{ fontWeight: 600, color: isDark ? '#e2e8f0' : 'inherit' }}>
                      Custom Extensions
                    </Typography>
                  </Box>
                  <ExtensionsEditor
                    value={formData.extensions}
                    onChange={(extensions) => setFormData(prev => ({ ...prev, extensions }))}
                    disabled={isReadOnly}
                    size="small"
                  />
                </Box>
              </Box>
            </Box>
          </Box>
        )}

        {/* Tab 1: JSON View */}
        {tabValue === 1 && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', gap: 1, p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Button
                size="small"
                startIcon={copied ? <Check size={16} /> : <Copy size={16} />}
                onClick={handleCopy}
                variant="outlined"
                disabled={copied || loadingOpenApiDoc || !openApiDoc}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                size="small"
                startIcon={<Download size={16} />}
                onClick={handleExport}
                variant="contained"
                disabled={loadingOpenApiDoc || !openApiDoc}
              >
                Export
              </Button>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Editor
                height="100%"
                language="json"
                value={schemaContent}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  renderWhitespace: 'none',
                  folding: true
                }}
              />
            </Box>
          </Box>
        )}

        {/* Tab 2: YAML View */}
        {tabValue === 2 && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', gap: 1, p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Button
                size="small"
                startIcon={copied ? <Check size={16} /> : <Copy size={16} />}
                onClick={handleCopy}
                variant="outlined"
                disabled={copied || loadingOpenApiDoc || !openApiDoc}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                size="small"
                startIcon={<Download size={16} />}
                onClick={handleExport}
                variant="contained"
                disabled={loadingOpenApiDoc || !openApiDoc}
              >
                Export
              </Button>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Editor
                height="100%"
                language="yaml"
                value={schemaContent}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  renderWhitespace: 'none',
                  folding: true
                }}
              />
            </Box>
          </Box>
        )}

        {/* Tab 3: Example View */}
        {tabValue === 3 && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', gap: 1, p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Button
                size="small"
                startIcon={<RefreshCw size={16} />}
                onClick={() => setExampleRefreshKey(prev => prev + 1)}
                variant="outlined"
                title="Generate new example"
                disabled={loadingOpenApiDoc || !openApiDoc}
              >
                Refresh
              </Button>
              <Button
                size="small"
                startIcon={copied ? <Check size={16} /> : <Copy size={16} />}
                onClick={handleCopy}
                variant="outlined"
                disabled={copied || loadingOpenApiDoc || !openApiDoc}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                size="small"
                startIcon={<Download size={16} />}
                onClick={handleExport}
                variant="contained"
                disabled={loadingOpenApiDoc || !openApiDoc}
              >
                Export
              </Button>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Editor
                key={`example-${exampleRefreshKey}`}
                height="100%"
                language="json"
                value={schemaContent}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  renderWhitespace: 'none',
                  folding: true
                }}
              />
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        {!isReadOnly && tabValue === 0 && (
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        )}
        {tabValue !== 0 && (
          <Button onClick={onClose} variant="contained">
            Close
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ClassEditDialog;

