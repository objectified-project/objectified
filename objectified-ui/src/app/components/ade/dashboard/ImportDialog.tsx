'use client';

import { useState } from 'react';
import { Upload, Link2, FileText, Github, Cloud, Package, X, FileCode } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { AnalysisPanel } from './AnalysisPanel';
import { PreviewPanel, ImportOptions } from './PreviewPanel';
import { analyzeSpecification, AnalysisResult } from '../../../utils/openapi-analyzer';
import ImportExecutionPanel from './ImportExecutionPanel';
import { startImport } from '../../../../../lib/db/import-actions';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  userId: string;
}

const ImportDialog: React.FC<ImportDialogProps> = ({
  open,
  onClose,
  tenantId, // Will be used in future steps for project creation
  userId    // Will be used in future steps for tracking import activity
}) => {
  const [currentStep, setCurrentStep] = useState<'source' | 'file-upload' | 'analysis' | 'preview' | 'import' | 'done'>('source');
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [importOptions, setImportOptions] = useState<ImportOptions | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const handleSourceClick = (source: string) => {
    setSelectedSource(source);
    setCurrentStep('file-upload');
    console.log('Selected source:', source);
  };

  const handleBack = () => {
    if (currentStep === 'done') {
      setCurrentStep('preview');
    } else if (currentStep === 'import') {
      setCurrentStep('preview');
      setJobId(null);
    } else if (currentStep === 'preview') {
      setCurrentStep('analysis');
    } else if (currentStep === 'analysis') {
      setCurrentStep('file-upload');
      setAnalysisResult(null);
    } else if (currentStep === 'file-upload') {
      setCurrentStep('source');
      setSelectedSource(null);
      setSelectedFile(null);
    }
  };

  const handleClose = () => {
    setCurrentStep('source');
    setSelectedSource(null);
    setSelectedFile(null);
    setAnalysisResult(null);
    setImportOptions(null);
    setJobId(null);
    onClose();
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    console.log('Starting analysis...', { selectedFile: selectedFile.name });
    setIsAnalyzing(true);
    try {
      const content = await selectedFile.text();
      console.log('File content loaded, length:', content.length);
      const result = await analyzeSpecification(content, selectedFile.name);
      console.log('Analysis complete:', result);
      setAnalysisResult(result);
      setCurrentStep('analysis');
      console.log('State updated to analysis step');
    } catch (error) {
      console.error('Analysis error:', error);
      // TODO: Show error message
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    const validExtensions = ['.yaml', '.yml', '.json', '.zip'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (validExtensions.includes(fileExtension)) {
      setSelectedFile(file);
      console.log('File selected:', file.name);
    } else {
      console.error('Invalid file type');
      // TODO: Show error message
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const beginImport = async () => {
    if (!analysisResult || !importOptions) return;

    const document = analysisResult.document;
    const job = await startImport({
      tenantId,
      userId,
      sourceKind: 'openapi',
      document,
      project: {
        name: importOptions.projectName || (document?.info?.title || 'New Project'),
        slug: (document?.info?.title || 'new-project').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g,'-'),
        description: document?.info?.description || null
      },
      version: {
        versionId: importOptions.targetVersion || (document?.info?.version || '1.0.0'),
        description: 'Imported from OpenAPI specification'
      },
      options: {
        selectedSchemas: importOptions.selectedSchemas,
        autoLayout: importOptions.autoLayout,
        createRelationships: importOptions.createRelationships,
        applyNamingConvention: importOptions.applyNamingConvention
      }
    });

    setJobId(job.jobId);
    setCurrentStep('import');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" showCloseButton={false}>
        <DialogHeader className="border-b border-gray-200 dark:border-gray-700 pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white">
              Import Specification
            </DialogTitle>
            <button
              onClick={handleClose}
              className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </DialogHeader>

        {/* Step Indicator - Fixed */}
        <div className="border-b border-gray-200 dark:border-gray-700 py-4 px-6">
          <div className="flex items-center justify-center gap-2 text-sm">
            <div className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold ${
                currentStep === 'source' || currentStep === 'file-upload' 
                  ? 'bg-indigo-600 text-white'
                  : 'bg-green-600 text-white'
              }`}>
                {currentStep === 'analysis' || currentStep === 'preview' || currentStep === 'import' || currentStep === 'done' ? '✓' : '1'}
              </div>
              <span className={`ml-2 font-medium ${
                currentStep !== 'source' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
              }`}>Source</span>
            </div>
            <div className={`w-16 h-0.5 ${
              ['analysis','preview','import','done'].includes(currentStep) ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}></div>
            <div className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold ${
                currentStep === 'analysis'
                  ? 'bg-indigo-600 text-white'
                  : ['preview','import','done'].includes(currentStep)
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}>
                {['preview','import','done'].includes(currentStep) ? '✓' : '2'}
              </div>
              <span className={`ml-2 ${
                ['analysis','preview','import','done'].includes(currentStep)
                  ? 'font-medium text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400'
              }`}>Analyze</span>
            </div>
            <div className={`w-16 h-0.5 ${
              ['preview','import','done'].includes(currentStep) ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}></div>
            <div className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold ${
                currentStep === 'preview'
                  ? 'bg-indigo-600 text-white'
                  : ['import','done'].includes(currentStep)
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}>
                {['import','done'].includes(currentStep) ? '✓' : '3'}
              </div>
              <span className={`ml-2 ${
                ['preview','import','done'].includes(currentStep)
                  ? 'font-medium text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400'
              }`}>Preview</span>
            </div>
            <div className={`w-16 h-0.5 ${
              ['import','done'].includes(currentStep) ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}></div>
            <div className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold ${
                currentStep === 'import'
                  ? 'bg-indigo-600 text-white'
                  : currentStep === 'done'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}>
                {currentStep === 'done' ? '✓' : '4'}
              </div>
              <span className={`ml-2 ${
                ['import','done'].includes(currentStep)
                  ? 'font-medium text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400'
              }`}>Import</span>
            </div>
            <div className={`w-16 h-0.5 ${ currentStep === 'done' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600' }`}></div>
            <div className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${ currentStep === 'done' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400' } font-semibold`}>
                5
              </div>
              <span className={`ml-2 ${ currentStep === 'done' ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400' }`}>Done</span>
            </div>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="overflow-y-auto py-6 px-6 h-[60vh]">
          {(() => {
            console.log('Render check:', { currentStep, selectedSource, hasAnalysisResult: !!analysisResult });

            if (currentStep === 'source') {
              console.log('Rendering: Source selection');
              return (
            <>
              {/* Choose Import Source */}
              <div className="mb-8">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-xl border-2 border-indigo-200 dark:border-indigo-800 p-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 text-center">
                    Choose Import Source
                  </h2>

                  {/* Source Options Grid */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                {/* File Upload */}
                <button
                  onClick={() => handleSourceClick('file')}
                  className={`group relative p-6 rounded-lg border-2 transition-all duration-200 ${
                    selectedSource === 'file'
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 shadow-lg'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md'
                  }`}
                >
                  <div className="flex flex-col items-center text-center">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors ${
                      selectedSource === 'file'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                    }`}>
                      <Upload className="h-6 w-6" />
                    </div>
                    <div className={`font-semibold mb-1 ${
                      selectedSource === 'file' ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-white'
                    }`}>
                      File Upload
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Drop files or click to browse
                    </div>
                  </div>
                </button>

                {/* URL Import */}
                <button
                  disabled
                  className="group relative p-6 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60 cursor-not-allowed"
                  title="Coming soon"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-gray-100 dark:bg-gray-700 text-gray-400">
                      <Link2 className="h-6 w-6" />
                    </div>
                    <div className="font-semibold mb-1 text-gray-500 dark:text-gray-400">
                      URL Import
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      Fetch from URL or repository
                    </div>
                  </div>
                </button>

                {/* Clipboard */}
                <button
                  disabled
                  className="group relative p-6 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60 cursor-not-allowed"
                  title="Coming soon"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-gray-100 dark:bg-gray-700 text-gray-400">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div className="font-semibold mb-1 text-gray-500 dark:text-gray-400">
                      Clipboard Paste
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      Paste JSON or YAML content
                    </div>
                  </div>
                </button>

                {/* Git Repository */}
                <button
                  disabled
                  className="group relative p-6 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60 cursor-not-allowed"
                  title="Coming soon"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-gray-100 dark:bg-gray-700 text-gray-400">
                      <Github className="h-6 w-6" />
                    </div>
                    <div className="font-semibold mb-1 text-gray-500 dark:text-gray-400">
                      Git Repository
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      Clone from GitHub/GitLab
                    </div>
                  </div>
                </button>

                {/* SwaggerHub */}
                <button
                  disabled
                  className="group relative p-6 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60 cursor-not-allowed"
                  title="Coming soon"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-gray-100 dark:bg-gray-700 text-gray-400">
                      <Cloud className="h-6 w-6" />
                    </div>
                    <div className="font-semibold mb-1 text-gray-500 dark:text-gray-400">
                      SwaggerHub Integration
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      Import from SwaggerHub
                    </div>
                  </div>
                </button>

                {/* Registry Import */}
                <button
                  disabled
                  className="group relative p-6 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60 cursor-not-allowed"
                  title="Coming soon"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-gray-100 dark:bg-gray-700 text-gray-400">
                      <Package className="h-6 w-6" />
                    </div>
                    <div className="font-semibold mb-1 text-gray-500 dark:text-gray-400">
                      Registry Import
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      Import from schema registry
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
            </>
              );
            } else if (currentStep === 'file-upload' && selectedSource === 'file') {
              console.log('Rendering: File upload');
              return (
            <>
              {/* Step 1a: File Upload View */}

              {/* Source Tabs */}
              <div className="mb-6">
                <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                  <button
                    className="px-4 py-2 text-sm font-medium border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  >
                    📁 File
                  </button>
                  <button
                    disabled
                    className="px-4 py-2 text-sm font-medium text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50"
                    title="Coming soon"
                  >
                    🔗 URL
                  </button>
                  <button
                    disabled
                    className="px-4 py-2 text-sm font-medium text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50"
                    title="Coming soon"
                  >
                    📋 Clipboard
                  </button>
                  <button
                    disabled
                    className="px-4 py-2 text-sm font-medium text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50"
                    title="Coming soon"
                  >
                    🐙 Git
                  </button>
                  <button
                    disabled
                    className="px-4 py-2 text-sm font-medium text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50"
                    title="Coming soon"
                  >
                    ☁️ SwaggerHub
                  </button>
                  <button
                    disabled
                    className="px-4 py-2 text-sm font-medium text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50"
                    title="Coming soon"
                  >
                    📦 Registry
                  </button>
                </div>
              </div>

              {/* Drop Zone */}
              <div className="mb-6">
                <div
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-600'
                  }`}
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                      isDragging
                        ? 'bg-indigo-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                    }`}>
                      <Upload className="h-8 w-8" />
                    </div>

                    {selectedFile ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                          <FileCode className="h-5 w-5" />
                          <span className="font-medium">{selectedFile.name}</span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {(selectedFile.size / 1024).toFixed(2)} KB
                        </p>
                        <button
                          onClick={() => setSelectedFile(null)}
                          className="text-sm text-red-600 dark:text-red-400 hover:underline"
                        >
                          Remove file
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <p className="text-lg font-medium text-gray-900 dark:text-white">
                            Drop files here
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            or
                          </p>
                        </div>

                        <label className="cursor-pointer">
                          <input
                            type="file"
                            className="hidden"
                            accept=".yaml,.yml,.json,.zip"
                            onChange={handleFileInputChange}
                          />
                          <span className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors shadow-sm">
                            <Upload className="h-5 w-5" />
                            Browse Files
                          </span>
                        </label>

                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Supports: .yaml, .yml, .json, .zip
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
              );
            } else if (currentStep === 'analysis' && analysisResult) {
              console.log('Rendering: Analysis panel');
              return (
            <>
              {/* Step 2: Analysis Panel */}
              <AnalysisPanel fileName={selectedFile?.name || ''} analysis={analysisResult} />
            </>
              );
            } else if (currentStep === 'preview' && analysisResult) {
              console.log('Rendering: Preview panel');
              return (
            <>
              {/* Step 3: Preview Panel */}
              <PreviewPanel
                analysis={analysisResult}
                onImportOptionsChange={setImportOptions}
              />
            </>
              );
            } else if (currentStep === 'import' && jobId) {
              return (
                <ImportExecutionPanel jobId={jobId} onDone={() => setCurrentStep('done')} />
              );
            } else if (currentStep === 'done') {
              return jobId ? (
                <ImportExecutionPanel jobId={jobId} />
              ) : null;
            } else if (selectedSource) {
              console.log('Rendering: Placeholder for', selectedSource);
              return (
            <>
              {/* Placeholder for other source views (URL, Clipboard, etc.) */}
              <div className="text-center py-12">
                <p className="text-gray-600 dark:text-gray-400">
                  {selectedSource} import view - Coming soon
                </p>
              </div>
            </>
              );
            } else {
              console.log('Rendering: Nothing');
              return null;
            }
          })()}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
          {currentStep === 'import' || currentStep === 'done' ? (
            <>
              <div />
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
            </>
          ) : currentStep !== 'source' ? (
            <>
              <Button variant="outline" onClick={handleBack}>
                ← Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                {currentStep === 'file-upload' && (
                  <Button
                    onClick={handleAnalyze}
                    disabled={!selectedFile || isAnalyzing}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                  >
                    {isAnalyzing ? 'Analyzing...' : 'Analyze →'}
                  </Button>
                )}
                {currentStep === 'analysis' && (
                  <Button
                    onClick={() => {
                      setCurrentStep('preview');
                    }}
                    disabled={!analysisResult?.isValid}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                  >
                    Next →
                  </Button>
                )}
                {currentStep === 'preview' && (
                  <Button
                    onClick={beginImport}
                    disabled={!importOptions || importOptions.selectedSchemas.length === 0}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                  >
                    Import →
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  // This is handled by handleSourceClick
                }}
                disabled={!selectedSource}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
              >
                Next →
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportDialog;

