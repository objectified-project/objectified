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
import { Copy, Download, RefreshCw, Check } from 'lucide-react';
import YAML from 'yaml';
import jsf from 'json-schema-faker';
import { generateClassOpenApiSpec } from '../../../utils/openapi';

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
}

const ClassEditDialog = ({ open, onClose, editingClassData, nodes, isReadOnly = false }: ClassEditDialogProps) => {
  const [classEditFormat, setClassEditFormat] = useState<'json' | 'yaml' | 'example'>('json');
  const [exampleRefreshKey, setExampleRefreshKey] = useState(0);
  const [copied, setCopied] = useState(false);

  // Reset view to JSON when dialog opens
  useEffect(() => {
    if (open) {
      setClassEditFormat('json');
      setExampleRefreshKey(0);
    }
  }, [open]);

  if (!editingClassData) return null;

  // Generate OpenAPI spec using the consolidated utility
  const allClasses = nodes.map(node => node.data).filter(data => data && data.name);
  const openApiDoc = generateClassOpenApiSpec(editingClassData, allClasses, {
    title: `${editingClassData.name} Schema`,
    version: '1.0.0',
    description: 'OpenAPI 3.1.0 schema definition'
  });

  // Get the class schema from the generated OpenAPI doc
  const classSchema = openApiDoc.components.schemas[editingClassData.name];

  // Helper function to resolve $ref references in a schema
  const resolveRefs = (schema: any, schemas: any, visited: Set<string> = new Set(), path: string = ''): any => {
    if (!schema || typeof schema !== 'object') return schema;

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

  // Generate schema content - regenerate when exampleRefreshKey changes
  let schemaContent: string;
  let editorLanguage: string;

  if (classEditFormat === 'example') {
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
      editorLanguage = 'json';
    } catch (error) {
      console.error('Error generating fake data:', error);
      schemaContent = JSON.stringify({
        error: 'Could not generate example data',
        message: error instanceof Error ? error.message : String(error)
      }, null, 2);
      editorLanguage = 'json';
    }
  } else {
    schemaContent = classEditFormat === 'json'
      ? JSON.stringify(openApiDoc, null, 2)
      : YAML.stringify(openApiDoc, { lineWidth: 0, aliasDuplicateObjects: false });
    editorLanguage = classEditFormat;
  }

  const handleCopy = () => {
    let content: string;
    if (classEditFormat === 'example') {
      const classSchema = openApiDoc.components.schemas[editingClassData.name];
      try {
        const resolvedSchema = resolveRefs(classSchema, openApiDoc.components.schemas);
        const fakeData = jsf.generate(resolvedSchema);
        content = JSON.stringify(fakeData, null, 2);
      } catch (error) {
        console.error('Error generating fake data:', error);
        content = JSON.stringify({ error: 'Could not generate example data' }, null, 2);
      }
    } else {
      content = classEditFormat === 'json'
        ? JSON.stringify(openApiDoc, null, 2)
        : YAML.stringify(openApiDoc, { lineWidth: 0, aliasDuplicateObjects: false });
    }

    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    let content: string;
    let filenameSuffix: string;

    if (classEditFormat === 'example') {
      const classSchema = openApiDoc.components.schemas[editingClassData.name];
      try {
        const resolvedSchema = resolveRefs(classSchema, openApiDoc.components.schemas);
        const fakeData = jsf.generate(resolvedSchema);
        content = JSON.stringify(fakeData, null, 2);
      } catch (error) {
        console.error('Error generating fake data:', error);
        content = JSON.stringify({ error: 'Could not generate example data' }, null, 2);
      }
      filenameSuffix = 'example';
    } else {
      content = classEditFormat === 'json'
        ? JSON.stringify(openApiDoc, null, 2)
        : YAML.stringify(openApiDoc, { lineWidth: 0, aliasDuplicateObjects: false });
      filenameSuffix = 'schema';
    }

    const mimeType = (classEditFormat === 'json' || classEditFormat === 'example') ? 'application/json' : 'text/yaml';
    const extension = (classEditFormat === 'json' || classEditFormat === 'example') ? 'json' : 'yaml';

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${editingClassData.name.toLowerCase()}-${filenameSuffix}.${extension}`;
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
            height: '80vh',
            maxHeight: '700px',
          }
        }
      }}
    >
      <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider', pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6" component="span">
              {isReadOnly ? 'View Class: ' : 'Edit Class: '}{editingClassData.name}
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

            {/* Format Toggle */}
            <Box sx={{ display: 'flex', border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              <Button
                size="small"
                onClick={() => setClassEditFormat('json')}
                sx={{
                  minWidth: 60,
                  borderRadius: 0,
                  bgcolor: classEditFormat === 'json' ? 'primary.main' : 'transparent',
                  color: classEditFormat === 'json' ? 'primary.contrastText' : 'text.primary',
                  '&:hover': {
                    bgcolor: classEditFormat === 'json' ? 'primary.dark' : 'action.hover',
                  },
                }}
              >
                JSON
              </Button>
              <Button
                size="small"
                onClick={() => setClassEditFormat('yaml')}
                sx={{
                  minWidth: 60,
                  borderRadius: 0,
                  borderLeft: 1,
                  borderColor: 'divider',
                  bgcolor: classEditFormat === 'yaml' ? 'primary.main' : 'transparent',
                  color: classEditFormat === 'yaml' ? 'primary.contrastText' : 'text.primary',
                  '&:hover': {
                    bgcolor: classEditFormat === 'yaml' ? 'primary.dark' : 'action.hover',
                  },
                }}
              >
                YAML
              </Button>
              <Button
                size="small"
                onClick={() => setClassEditFormat('example')}
                sx={{
                  minWidth: 80,
                  borderRadius: 0,
                  borderLeft: 1,
                  borderColor: 'divider',
                  bgcolor: classEditFormat === 'example' ? 'primary.main' : 'transparent',
                  color: classEditFormat === 'example' ? 'primary.contrastText' : 'text.primary',
                  '&:hover': {
                    bgcolor: classEditFormat === 'example' ? 'primary.dark' : 'action.hover',
                  },
                }}
              >
                Example
              </Button>
            </Box>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            {classEditFormat === 'example' && (
              <Button
                size="small"
                startIcon={<RefreshCw size={16} />}
                onClick={() => setExampleRefreshKey(prev => prev + 1)}
                variant="outlined"
                title="Generate new example"
              >
                Refresh
              </Button>
            )}
            <Button
              size="small"
              startIcon={copied ? <Check size={16} /> : <Copy size={16} />}
              onClick={handleCopy}
              variant="outlined"
              disabled={copied}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              size="small"
              startIcon={<Download size={16} />}
              onClick={handleExport}
              variant="contained"
            >
              Export
            </Button>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <Editor
          key={classEditFormat === 'example' ? `example-${exampleRefreshKey}` : classEditFormat}
          height="100%"
          language={editorLanguage}
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ClassEditDialog;

