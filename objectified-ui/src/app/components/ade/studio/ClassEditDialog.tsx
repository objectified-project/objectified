'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Copy, Download, RefreshCw } from 'lucide-react';
import * as yaml from 'js-yaml';
import jsf from 'json-schema-faker';
import { generateClassOpenApiSpec } from '../../../utils/openapi';
import { useDialog } from '../../providers/DialogProvider';

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
  const { alert: alertDialog } = useDialog();
  const [classEditFormat, setClassEditFormat] = useState<'json' | 'yaml' | 'example'>('json');
  const [exampleRefreshKey, setExampleRefreshKey] = useState(0);

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

  // Generate schema content - regenerate when exampleRefreshKey changes
  let schemaContent: string;
  let editorLanguage: string;

  if (classEditFormat === 'example') {
    try {
      // Use exampleRefreshKey in random seed to force regeneration
      jsf.option({
        random: () => {
          // Mix in exampleRefreshKey to ensure different results on each refresh
          const seed = Math.random() * (exampleRefreshKey + 1);
          return seed - Math.floor(seed);
        }
      });

      const fakeData = jsf.generate(classSchema);
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
      : yaml.dump(openApiDoc, { lineWidth: -1, noRefs: true });
    editorLanguage = classEditFormat;
  }

  const handleCopy = () => {
    let content: string;
    if (classEditFormat === 'example') {
      const classSchema = openApiDoc.components.schemas[editingClassData.name];
      try {
        const fakeData = jsf.generate(classSchema);
        content = JSON.stringify(fakeData, null, 2);
      } catch (error) {
        console.error('Error generating fake data:', error);
        content = JSON.stringify({ error: 'Could not generate example data' }, null, 2);
      }
    } else {
      content = classEditFormat === 'json'
        ? JSON.stringify(openApiDoc, null, 2)
        : yaml.dump(openApiDoc, { lineWidth: -1, noRefs: true });
    }

    navigator.clipboard.writeText(content);
    alertDialog({
      message: `${classEditFormat === 'example' ? 'Example data' : 'Schema'} copied to clipboard as ${classEditFormat.toUpperCase()}!`,
      variant: 'success',
    });
  };

  const handleExport = () => {
    let content: string;
    let filenameSuffix: string;

    if (classEditFormat === 'example') {
      const classSchema = openApiDoc.components.schemas[editingClassData.name];
      try {
        const fakeData = jsf.generate(classSchema);
        content = JSON.stringify(fakeData, null, 2);
      } catch (error) {
        console.error('Error generating fake data:', error);
        content = JSON.stringify({ error: 'Could not generate example data' }, null, 2);
      }
      filenameSuffix = 'example';
    } else {
      content = classEditFormat === 'json'
        ? JSON.stringify(openApiDoc, null, 2)
        : yaml.dump(openApiDoc, { lineWidth: -1, noRefs: true });
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
                EXAMPLE
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
              startIcon={<Copy size={16} />}
              onClick={handleCopy}
              variant="outlined"
            >
              Copy
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

