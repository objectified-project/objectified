'use client';

import { useState, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { Upload, FileJson, AlertCircle, CheckCircle2 } from 'lucide-react';
import { parseOpenAPISpec, validateImportedClasses, ParsedClass } from '../../../utils/openapi-import';
import { importProjectFromOpenAPI } from '../../../../../lib/db/helper';

interface OpenAPIImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantId: string;
  userId: string;
}

const OpenAPIImportDialog: React.FC<OpenAPIImportDialogProps> = ({
  open,
  onClose,
  onSuccess,
  tenantId,
  userId
}) => {
  const [step, setStep] = useState<'upload' | 'review' | 'summary' | 'details'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [classes, setClasses] = useState<ParsedClass[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [projectName, setProjectName] = useState('');
  const [projectSlug, setProjectSlug] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [versionId, setVersionId] = useState('1.0.0');
  const [versionDescription, setVersionDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [openAPIInfo, setOpenAPIInfo] = useState<any>(null);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const resetDialog = () => {
    setStep('upload');
    setFile(null);
    setClasses([]);
    setWarnings([]);
    setProjectName('');
    setProjectSlug('');
    setProjectDescription('');
    setVersionId('1.0.0');
    setVersionDescription('');
    setErrorMessage('');
    setIsLoading(false);
    setIsDragging(false);
    setOpenAPIInfo(null);
  };

  const calculateImportStats = () => {
    const supportedClasses = classes.filter(c => c.isSupported);
    const selectedClasses = supportedClasses.filter(c => c.selected);

    // Count unique properties by creating a signature (name + type)
    const propertyMap = new Map<string, number>(); // signature -> count

    selectedClasses.forEach(cls => {
      cls.properties.forEach(prop => {
        const signature = JSON.stringify({ name: prop.name, data: prop.data });
        propertyMap.set(signature, (propertyMap.get(signature) || 0) + 1);
      });
    });

    const totalProperties = propertyMap.size;
    const sharedProperties = Array.from(propertyMap.values()).filter(count => count > 1).length;
    const uniqueProperties = totalProperties - sharedProperties;

    return {
      totalClasses: selectedClasses.length,
      supportedClasses: supportedClasses.length,
      unsupportedClasses: classes.filter(c => !c.isSupported).length,
      totalProperties,
      uniqueProperties,
      sharedProperties
    };
  };

  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.json') && !selectedFile.name.endsWith('.yaml') && !selectedFile.name.endsWith('.yml')) {
      setErrorMessage('Please select a JSON or YAML file');
      return;
    }

    setFile(selectedFile);
    setErrorMessage('');

    try {
      const content = await selectedFile.text();

      // Parse the OpenAPI spec
      const parseResult = parseOpenAPISpec(content);

      if (!parseResult.success) {
        setErrorMessage(parseResult.error || 'Failed to parse OpenAPI specification');
        return;
      }

      setClasses(parseResult.classes);
      setWarnings(parseResult.warnings || []);
      setOpenAPIInfo({
        title: parseResult.title,
        version: parseResult.version,
        description: parseResult.description
      });

      // Auto-fill project details from OpenAPI info
      if (parseResult.title) {
        setProjectName(parseResult.title);
        setProjectSlug(generateSlug(parseResult.title));
      }
      if (parseResult.description) {
        setProjectDescription(parseResult.description);
      }
      if (parseResult.version) {
        setVersionId(parseResult.version);
      }

      setStep('review');
    } catch (error: any) {
      setErrorMessage(`Error reading file: ${error.message}`);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const toggleClassSelection = (index: number) => {
    const updatedClasses = [...classes];
    const cls = updatedClasses[index];

    // Don't allow selecting unsupported classes
    if (!cls.isSupported) {
      return;
    }

    updatedClasses[index].selected = !updatedClasses[index].selected;
    setClasses(updatedClasses);
  };

  const handleReviewNext = () => {
    const selectedClasses = classes.filter(c => c.selected);

    if (selectedClasses.length === 0) {
      setErrorMessage('Please select at least one class to import');
      return;
    }

    const validation = validateImportedClasses(selectedClasses);
    if (!validation.valid) {
      setErrorMessage(validation.errors.join('; '));
      return;
    }

    setErrorMessage('');
    setStep('details');
  };

  const handleImport = async () => {
    if (!projectName.trim()) {
      setErrorMessage('Project name is required');
      return;
    }

    if (!projectSlug.trim()) {
      setErrorMessage('Project slug is required');
      return;
    }

    if (!versionId.trim()) {
      setErrorMessage('Version ID is required');
      return;
    }

    const selectedClasses = classes.filter(c => c.selected);

    if (selectedClasses.length === 0) {
      setErrorMessage('Please select at least one class to import');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await importProjectFromOpenAPI(
        tenantId,
        userId,
        projectName,
        projectSlug,
        projectDescription || null,
        versionId,
        versionDescription || null,
        selectedClasses
      );

      const response = JSON.parse(result);

      if (response.success) {
        resetDialog();
        onClose();
        onSuccess();
      } else {
        setErrorMessage(response.error || 'Failed to import project');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'An error occurred during import');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      resetDialog();
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {step === 'upload' && 'Import from OpenAPI Specification'}
        {step === 'review' && 'Select Classes to Import'}
        {step === 'summary' && 'Review Import Summary'}
        {step === 'details' && 'Project Details'}
      </DialogTitle>

      <DialogContent>
        {errorMessage && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        )}

        {/* Upload Step */}
        {step === 'upload' && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Upload an OpenAPI 3.x specification file (JSON format) to automatically create a project with classes and properties.
            </Typography>

            <Box
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              sx={{
                border: '2px dashed',
                borderColor: isDragging ? 'primary.main' : 'grey.300',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                backgroundColor: isDragging ? 'action.hover' : 'background.paper',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: 'action.hover'
                }
              }}
              onClick={() => document.getElementById('openapi-file-input')?.click()}
            >
              {file ? (
                <Box>
                  <FileJson size={48} style={{ margin: '0 auto 16px', color: '#22c55e' }} />
                  <Typography variant="h6" gutterBottom>
                    {file.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Click to select a different file
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <Upload size={48} style={{ margin: '0 auto 16px', color: '#94a3b8' }} />
                  <Typography variant="h6" gutterBottom>
                    Drag & Drop or Click to Select
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    OpenAPI 3.x JSON specification file
                  </Typography>
                </Box>
              )}
            </Box>

            <input
              id="openapi-file-input"
              type="file"
              accept=".json,.yaml,.yml"
              style={{ display: 'none' }}
              onChange={handleFileInputChange}
            />
          </Box>
        )}

        {/* Review Step */}
        {step === 'review' && (
          <Box>
            {openAPIInfo && (
              <Box sx={{ mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  OpenAPI Specification
                </Typography>
                <Typography variant="body2">
                  <strong>{openAPIInfo.title}</strong> {openAPIInfo.version && `v${openAPIInfo.version}`}
                </Typography>
                {openAPIInfo.description && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {openAPIInfo.description}
                  </Typography>
                )}
              </Box>
            )}

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select the classes you want to import. Unsupported classes (shown in gray below) cannot be imported.
            </Typography>

            <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
              {classes.map((cls, index) => (
                <Box
                  key={index}
                  sx={{
                    mb: 2,
                    p: 2,
                    border: 1,
                    borderColor: !cls.isSupported ? 'error.main' : (cls.selected ? 'primary.main' : 'grey.300'),
                    borderRadius: 1,
                    backgroundColor: !cls.isSupported ? 'grey.100' : (cls.selected ? 'action.selected' : 'background.paper'),
                    opacity: !cls.isSupported ? 0.6 : 1
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={cls.selected}
                        onChange={() => toggleClassSelection(index)}
                        disabled={!cls.isSupported}
                      />
                    }
                    label={
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1" fontWeight="bold" color={!cls.isSupported ? 'text.disabled' : 'text.primary'}>
                            {cls.name}
                          </Typography>
                          {!cls.isSupported && (
                            <Chip
                              label="Not Supported"
                              size="small"
                              color="error"
                              sx={{ height: 20 }}
                            />
                          )}
                        </Box>
                        {cls.description && (
                          <Typography variant="body2" color="text.secondary">
                            {cls.description}
                          </Typography>
                        )}
                      </Box>
                    }
                  />

                  {cls.warnings.length > 0 && (
                    <Box sx={{ mt: 1, ml: 4, p: 1.5, bgcolor: 'warning.lighter', borderRadius: 1 }}>
                      {cls.warnings.map((warning, wIdx) => {
                        // Split warning into main message and suggestions
                        const parts = warning.split('\n\n💡 Suggested fix:\n');
                        const mainMessage = parts[0];
                        const suggestions = parts[1];

                        return (
                          <Box key={wIdx} sx={{ mb: wIdx < cls.warnings.length - 1 ? 1.5 : 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'start', gap: 0.5, mb: suggestions ? 1 : 0 }}>
                              <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0, color: '#f59e0b' }} />
                              <Typography variant="caption" color="warning.dark">
                                {mainMessage}
                              </Typography>
                            </Box>
                            {suggestions && (
                              <Box sx={{ ml: 2.5, mt: 1, p: 1, bgcolor: 'background.paper', borderRadius: 0.5, borderLeft: '2px solid #3b82f6' }}>
                                <Typography variant="caption" color="primary.dark" fontWeight="bold" sx={{ display: 'block', mb: 0.5 }}>
                                  💡 Suggested fix:
                                </Typography>
                                <Box component="pre" sx={{
                                  m: 0,
                                  fontFamily: 'monospace',
                                  fontSize: '0.7rem',
                                  color: 'text.secondary',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word'
                                }}>
                                  {suggestions}
                                </Box>
                              </Box>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  )}

                  <Box sx={{ mt: 1, ml: 4 }}>
                    <Typography variant="caption" color="text.secondary">
                      Properties ({cls.properties.length}):
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {cls.properties.slice(0, 10).map((prop, propIndex) => (
                        <Chip
                          key={propIndex}
                          label={prop.name}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                      {cls.properties.length > 10 && (
                        <Chip
                          label={`+${cls.properties.length - 10} more`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>

          </Box>
        )}

        {/* Summary Step */}
        {step === 'summary' && (
          <Box>
            {(() => {
              const stats = calculateImportStats();
              const selectedClasses = classes.filter(c => c.isSupported && c.selected);

              return (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Review the summary of what will be imported from your OpenAPI specification.
                  </Typography>

                  {/* Main Statistics Card */}
                  <Box sx={{ mb: 3, p: 3, bgcolor: 'success.lighter', borderRadius: 2, border: '1px solid', borderColor: 'success.light' }}>
                    <Typography variant="h6" fontWeight="bold" color="success.dark" gutterBottom>
                      📊 Import Summary
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 3, mt: 2 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                          Classes to Import
                        </Typography>
                        <Typography variant="h4" color="success.dark">
                          {stats.totalClasses}
                        </Typography>
                        {stats.unsupportedClasses > 0 && (
                          <Typography variant="caption" color="text.secondary">
                            ({stats.supportedClasses} available, {stats.unsupportedClasses} unsupported)
                          </Typography>
                        )}
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                          Total Properties
                        </Typography>
                        <Typography variant="h4" color="success.dark">
                          {stats.totalProperties}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ({stats.uniqueProperties} unique, {stats.sharedProperties} shared)
                        </Typography>
                      </Box>
                    </Box>
                    {stats.sharedProperties > 0 && (
                      <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'success.main' }}>
                        <Typography variant="body2" color="success.dark">
                          💡 <strong>{stats.sharedProperties}</strong> propert{stats.sharedProperties !== 1 ? 'ies' : 'y'} will be reused across multiple classes, reducing duplication and maintaining consistency.
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Selected Classes List */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                      Selected Classes ({selectedClasses.length})
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                      {selectedClasses.map((cls, idx) => (
                        <Chip
                          key={idx}
                          label={`${cls.name} (${cls.properties.length})`}
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>

                  {/* Warnings Section */}
                  {warnings.length > 0 && (
                    <Alert severity="warning">
                      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                        ⚠️ {warnings.length} class{warnings.length !== 1 ? 'es' : ''} cannot be imported
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        The following classes have issues that prevent them from being imported:
                      </Typography>
                      <Box sx={{ maxHeight: 150, overflowY: 'auto', mt: 1 }}>
                        {warnings.map((warning, idx) => {
                          const className = warning.split(':')[0];
                          const reason = warning.substring(warning.indexOf(':') + 1).trim();
                          const shortReason = reason.split('.')[0] + '.';

                          return (
                            <Box key={idx} sx={{
                              mb: 1,
                              p: 1,
                              bgcolor: 'background.paper',
                              borderRadius: 1,
                              borderLeft: '3px solid',
                              borderLeftColor: 'warning.main'
                            }}>
                              <Typography variant="body2" fontWeight="bold" color="text.primary">
                                {className}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {shortReason}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    </Alert>
                  )}

                  {/* OpenAPI Info */}
                  {openAPIInfo && (
                    <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Source Specification
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {openAPIInfo.title} {openAPIInfo.version && `v${openAPIInfo.version}`}
                      </Typography>
                    </Box>
                  )}
                </>
              );
            })()}
          </Box>
        )}

        {/* Details Step */}
        {step === 'details' && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Provide project and version details for the import.
            </Typography>

            <TextField
              autoFocus
              margin="dense"
              label="Project Name"
              type="text"
              fullWidth
              variant="outlined"
              value={projectName}
              onChange={(e) => {
                setProjectName(e.target.value);
                if (!projectSlug || projectSlug === generateSlug(projectName)) {
                  setProjectSlug(generateSlug(e.target.value));
                }
              }}
              disabled={isLoading}
              required
              sx={{ mb: 2 }}
            />

            <TextField
              margin="dense"
              label="Project Slug"
              type="text"
              fullWidth
              variant="outlined"
              value={projectSlug}
              onChange={(e) => setProjectSlug(e.target.value.toLowerCase())}
              disabled={isLoading}
              required
              helperText="URL-friendly identifier (lowercase letters, numbers, and dashes only)"
              sx={{ mb: 2 }}
            />

            <TextField
              margin="dense"
              label="Project Description"
              type="text"
              fullWidth
              variant="outlined"
              multiline
              rows={3}
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              disabled={isLoading}
              sx={{ mb: 2 }}
            />

            <TextField
              margin="dense"
              label="Initial Version ID"
              type="text"
              fullWidth
              variant="outlined"
              value={versionId}
              onChange={(e) => setVersionId(e.target.value)}
              disabled={isLoading}
              required
              helperText="Semantic version (e.g., 1.0.0)"
              sx={{ mb: 2 }}
            />

            <TextField
              margin="dense"
              label="Version Description"
              type="text"
              fullWidth
              variant="outlined"
              multiline
              rows={2}
              value={versionDescription}
              onChange={(e) => setVersionDescription(e.target.value)}
              disabled={isLoading}
            />

            <Box sx={{ mt: 2, p: 2, bgcolor: 'success.lighter', borderRadius: 1 }}>
              <Typography variant="body2" color="success.dark">
                <CheckCircle2 size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                {classes.filter(c => c.selected).length} classes will be imported
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>

        {step === 'upload' && (
          <Button
            onClick={() => file && setStep('review')}
            variant="contained"
            disabled={!file || isLoading}
          >
            Next
          </Button>
        )}

        {step === 'review' && (
          <>
            <Button onClick={() => setStep('upload')} disabled={isLoading}>
              Back
            </Button>
            <Button
              onClick={() => setStep('summary')}
              variant="contained"
              disabled={classes.filter(c => c.selected).length === 0 || isLoading}
            >
              Next
            </Button>
          </>
        )}

        {step === 'summary' && (
          <>
            <Button onClick={() => setStep('review')} disabled={isLoading}>
              Back
            </Button>
            <Button
              onClick={() => setStep('details')}
              variant="contained"
              disabled={isLoading}
            >
              Continue to Project Details
            </Button>
          </>
        )}

        {step === 'details' && (
          <>
            <Button onClick={() => setStep('summary')} disabled={isLoading}>
              Back
            </Button>
            <Button
              onClick={handleImport}
              variant="contained"
              disabled={isLoading}
            >
              {isLoading ? 'Importing...' : 'Import Project'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default OpenAPIImportDialog;

