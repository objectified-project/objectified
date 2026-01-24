'use client';

import { useState } from 'react';
import { Upload, AlertCircle, CheckCircle, FileCode } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Label } from '@/app/components/ui/Label';
import { Alert } from '@/app/components/ui/Alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/Dialog';
import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface Props {
  onClose: () => void;
  onComplete: () => void;
  onMessage: (type: 'success' | 'error', message: string) => void;
}

export default function PrimitiveImportDialog({ onClose, onComplete, onMessage }: Props) {
  const [schemaJson, setSchemaJson] = useState('');
  const [importing, setImporting] = useState(false);
  const [definitions, setDefinitions] = useState<Record<string, Record<string, unknown>>>({});
  const [selectedDefs, setSelectedDefs] = useState<Set<string>>(new Set());
  const [parseError, setParseError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleSchemaChange = (value: string | undefined) => {
    const newValue = value || '';
    setSchemaJson(newValue);
    setParseError(null);
    setShowPreview(false);
    setDefinitions({});
    setSelectedDefs(new Set());
  };

  const handleParseSchema = () => {
    try {
      const parsed = JSON.parse(schemaJson);

      // Extract $defs or definitions
      const defs = {
        ...(parsed.$defs || {}),
        ...(parsed.definitions || {})
      };

      if (Object.keys(defs).length === 0) {
        setParseError('No definitions found. Schema must contain $defs or definitions.');
        return;
      }

      setDefinitions(defs);
      setSelectedDefs(new Set(Object.keys(defs))); // Select all by default
      setShowPreview(true);
      setParseError(null);
    } catch (err) {
      const error = err as Error;
      setParseError(`Invalid JSON: ${error.message}`);
    }
  };

  const toggleDefinition = (defName: string) => {
    const newSelected = new Set(selectedDefs);
    if (newSelected.has(defName)) {
      newSelected.delete(defName);
    } else {
      newSelected.add(defName);
    }
    setSelectedDefs(newSelected);
  };

  const handleImport = async () => {
    if (selectedDefs.size === 0) {
      onMessage('error', 'Please select at least one definition to import');
      return;
    }

    setImporting(true);

    try {
      const response = await fetch('/api/primitives/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema: JSON.parse(schemaJson),
          selected_definitions: Array.from(selectedDefs),
        }),
      });

      const data = await response.json();

      if (data.success) {
        const imported = data.imported || [];
        const skipped = data.skipped || [];
        const errors = data.errors || [];

        let message = `Imported ${imported.length} primitive(s)`;
        if (skipped.length > 0) {
          message += `, skipped ${skipped.length}`;
        }
        if (errors.length > 0) {
          message += `, ${errors.length} error(s)`;
        }

        onMessage('success', message);
        onComplete();
      } else {
        onMessage('error', data.error || 'Failed to import primitives');
      }
    } catch (error) {
      console.error('Error importing primitives:', error);
      onMessage('error', 'Failed to import primitives');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import Primitives from JSON Schema
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!showPreview ? (
            <>
              <div className="space-y-2">
                <Label>JSON Schema with $defs or definitions</Label>
                <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                  <MonacoEditor
                    height="400px"
                    language="json"
                    theme="vs-dark"
                    value={schemaJson}
                    onChange={handleSchemaChange}
                    options={{
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 13,
                    }}
                  />
                </div>
                {parseError && (
                  <Alert variant="error">
                    <AlertCircle className="h-4 w-4" />
                    <span>{parseError}</span>
                  </Alert>
                )}
              </div>

              <div className="flex justify-end">
                <Button onClick={handleParseSchema} disabled={!schemaJson.trim()}>
                  Parse Schema
                </Button>
              </div>
            </>
          ) : (
            <>
              <Alert variant="default">
                <CheckCircle className="h-4 w-4" />
                <span>Found {Object.keys(definitions).length} definition(s). Select which ones to import:</span>
              </Alert>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  {Object.entries(definitions).map(([defName, defSchema]) => {
                    const schema = defSchema as Record<string, unknown>;
                    const schemaType = (schema.type as string) || 'object';
                    const schemaDescription = schema.description as string | undefined;

                    return (
                      <div
                        key={defName}
                        className="border-b border-gray-200 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/50"
                      >
                        <label className="flex items-start gap-3 p-4 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedDefs.has(defName)}
                            onChange={() => toggleDefinition(defName)}
                            className="mt-1 w-4 h-4 text-indigo-600 rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <FileCode className="w-4 h-4 text-indigo-600" />
                              <span className="font-medium text-gray-900 dark:text-white">{defName}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                ({schemaType})
                              </span>
                            </div>
                            {schemaDescription && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{schemaDescription}</p>
                            )}
                            <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                              {JSON.stringify(defSchema, null, 2)}
                            </pre>
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span>{selectedDefs.size} of {Object.keys(definitions).length} selected</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (selectedDefs.size === Object.keys(definitions).length) {
                      setSelectedDefs(new Set());
                    } else {
                      setSelectedDefs(new Set(Object.keys(definitions)));
                    }
                  }}
                >
                  {selectedDefs.size === Object.keys(definitions).length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {showPreview && (
            <Button
              variant="secondary"
              onClick={() => {
                setShowPreview(false);
                setDefinitions({});
                setSelectedDefs(new Set());
              }}
            >
              Back
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} disabled={importing}>
            Cancel
          </Button>
          {showPreview && (
            <Button onClick={handleImport} disabled={importing || selectedDefs.size === 0}>
              {importing ? 'Importing...' : `Import ${selectedDefs.size} Selected`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
