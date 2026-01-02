'use client';

import React, { useState, useEffect } from 'react';
import { X, Trash2, Check, ChevronDown, ExternalLink } from 'lucide-react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import * as Popover from '@radix-ui/react-popover';
import Editor from '@monaco-editor/react';
import { extractPathVariables, PathVariable, PathNodeData, ExternalDocs } from '@/app/components/ade/paths/PathNode';
import {
  updatePathAction,
  deletePathAction,
  getTagsForProjectAction,
  getClassesForVersionAction,
  createOperationAction,
  updateOperationAction,
  setPathTagsAction,
  setOperationTagsAction,
  getRequestBodyForOperationAction,
  createOperationRequestBodyAction,
  updateOperationRequestBodyAction,
  deleteOperationRequestBodyAction,
  addRequestBodyContentTypeAction
} from '../actions';
import { useStudio } from '../../StudioContext';
import SchemaPicker from './SchemaPicker';

/**
 * Generates an operation ID based on the HTTP method and path pattern.
 * Examples:
 * - GET /users -> getUsers
 * - GET /users/{userId} -> getUserById
 * - POST /users -> createUser
 * - PUT /users/{userId} -> updateUser
 * - DELETE /users/{userId} -> deleteUser
 * - GET /users/{userId}/orders -> getUserOrders
 * - POST /users/{userId}/orders -> createUserOrder
 */
function generateOperationId(method: string, path: string): string {
  // Normalize method to lowercase
  const verb = method.toLowerCase();

  // Map HTTP verbs to semantic prefixes
  const verbMap: Record<string, string> = {
    get: 'get',
    post: 'create',
    put: 'update',
    patch: 'update',
    delete: 'delete',
    head: 'head',
    options: 'options',
  };

  const prefix = verbMap[verb] || verb;

  // Split path into segments and filter out empty ones
  const segments = path.split('/').filter(s => s.length > 0);

  if (segments.length === 0) {
    return prefix;
  }

  // Process segments
  const parts: string[] = [];
  let hasPathVariable = false;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const isVariable = segment.startsWith('{') && segment.endsWith('}');

    if (isVariable) {
      hasPathVariable = true;
      // For GET with path variable at the end, use "ById" suffix
      if (i === segments.length - 1 && verb === 'get' && parts.length > 0) {
        // Don't add anything, we'll add "ById" at the end
      }
    } else {
      // Convert to singular for certain verbs when followed by an ID
      let word = segment;
      const nextSegment = segments[i + 1];
      const nextIsVariable = nextSegment?.startsWith('{') && nextSegment?.endsWith('}');

      // Singularize if this resource is followed by an ID variable
      if (nextIsVariable && word.endsWith('s') && word.length > 1) {
        // Simple singularization: remove trailing 's'
        // Handle common cases like 'users' -> 'user', 'orders' -> 'order'
        if (word.endsWith('ies')) {
          word = word.slice(0, -3) + 'y';
        } else if (word.endsWith('es') && (word.endsWith('sses') || word.endsWith('xes') || word.endsWith('zes') || word.endsWith('shes') || word.endsWith('ches'))) {
          word = word.slice(0, -2);
        } else if (word.endsWith('s') && !word.endsWith('ss')) {
          word = word.slice(0, -1);
        }
      }

      parts.push(word);
    }
  }

  if (parts.length === 0) {
    return prefix;
  }

  // Build the operation ID
  // First part is lowercased, rest are PascalCased
  const camelCaseParts = parts.map((part, index) => {
    if (index === 0 && prefix) {
      // First resource after verb
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  });

  let operationId = prefix + camelCaseParts.join('');

  // Add "ById" suffix for GET requests that end with a path variable
  const lastSegment = segments[segments.length - 1];
  if (lastSegment?.startsWith('{') && lastSegment?.endsWith('}')) {
    if (verb === 'get') {
      operationId += 'ById';
    }
  }

  return operationId;
}

interface Tag {
  id: string;
  name: string;
  color: string;
  description?: string;
}

interface PropertiesPanelProps {
  selectedNode: any | null;
  onClose: () => void;
}

export default function PropertiesPanel({ selectedNode, onClose }: PropertiesPanelProps) {
  const { selectedProjectId, selectedVersionId } = useStudio();
  const [pathPattern, setPathPattern] = useState('');
  const [pathVariables, setPathVariables] = useState<PathVariable[]>([]);
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]); // Array of tag IDs
  const [deprecated, setDeprecated] = useState(false);
  const [externalDocsUrl, setExternalDocsUrl] = useState('');
  const [externalDocsDescription, setExternalDocsDescription] = useState('');
  const [operationId, setOperationId] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);

  // Request body state
  const [requestBodyEnabled, setRequestBodyEnabled] = useState(false);
  const [requestBodyDescription, setRequestBodyDescription] = useState('');
  const [requestBodyRequired, setRequestBodyRequired] = useState(false);
  const [requestBodyContentType, setRequestBodyContentType] = useState('application/json');
  const [requestBodySchemaRef, setRequestBodySchemaRef] = useState(''); // Class ID
  const [requestBodySchemaName, setRequestBodySchemaName] = useState(''); // Display name
  const [isSchemaPickerOpen, setIsSchemaPickerOpen] = useState(false);
  const [requestBodyId, setRequestBodyId] = useState<string | null>(null); // Database ID

  // Store original values for cancel functionality
  const [originalValues, setOriginalValues] = useState({
    pathPattern: '',
    pathVariables: [] as PathVariable[],
    summary: '',
    description: '',
    selectedTags: [] as string[],
    deprecated: false,
    externalDocsUrl: '',
    externalDocsDescription: '',
    operationId: '',
  });

  // Load available tags for the project
  useEffect(() => {
    if (!selectedProjectId) {
      setAvailableTags([]);
      return;
    }

    const loadTags = async () => {
      try {
        const result = await getTagsForProjectAction(selectedProjectId);
        const tags = JSON.parse(result);
        setAvailableTags(tags);
      } catch (error) {
        console.error('Error loading tags:', error);
        setAvailableTags([]);
      }
    };

    loadTags();
  }, [selectedProjectId]);

  // Detect dark mode from system preferences
  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeMediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };

    darkModeMediaQuery.addEventListener('change', handleChange);
    return () => darkModeMediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Initialize state when node is selected
  useEffect(() => {
    if (selectedNode?.data) {
      const data = selectedNode.data as PathNodeData;
      const newPathPattern = data.path || '';
      const newPathVariables = data.pathVariables || [];
      const newSummary = data.summary || '';
      const newDescription = data.description || '';
      const newSelectedTags = data.tags || []; // Array of tag IDs
      const newDeprecated = data.deprecated || false;
      const newExternalDocsUrl = data.externalDocs?.url || '';
      const newExternalDocsDescription = data.externalDocs?.description || '';
      const newOperationId = data.operationId || '';

      setPathPattern(newPathPattern);
      setPathVariables(newPathVariables);
      setSummary(newSummary);
      setDescription(newDescription);
      setSelectedTags(newSelectedTags);
      setDeprecated(newDeprecated);
      setExternalDocsUrl(newExternalDocsUrl);
      setExternalDocsDescription(newExternalDocsDescription);
      setOperationId(newOperationId);

      // Reset request body state
      setRequestBodyEnabled(false);
      setRequestBodyDescription('');
      setRequestBodyRequired(false);
      setRequestBodyContentType('application/json');
      setRequestBodySchemaRef('');
      setRequestBodySchemaName('');
      setRequestBodyId(null);

      // Load request body for method nodes
      if (data.nodeType === 'method' && data.dbOperationId) {
        loadRequestBody(data.dbOperationId);
      }

      // Store original values
      setOriginalValues({
        pathPattern: newPathPattern,
        pathVariables: JSON.parse(JSON.stringify(newPathVariables)), // Deep copy
        summary: newSummary,
        description: newDescription,
        selectedTags: [...newSelectedTags],
        deprecated: newDeprecated,
        externalDocsUrl: newExternalDocsUrl,
        externalDocsDescription: newExternalDocsDescription,
        operationId: newOperationId,
      });

      // Reset unsaved changes flag
      setHasUnsavedChanges(false);
    }
  }, [selectedNode?.id]);

  // Load request body data from database
  const loadRequestBody = async (operationId: string) => {
    try {
      const result = await getRequestBodyForOperationAction(operationId);
      const requestBody = JSON.parse(result);

      if (requestBody && requestBody.id) {
        setRequestBodyEnabled(true);
        setRequestBodyId(requestBody.id);
        setRequestBodyDescription(requestBody.description || '');
        setRequestBodyRequired(requestBody.required || false);

        // Load content types if available
        if (requestBody.content_types && requestBody.content_types.length > 0) {
          const firstContent = requestBody.content_types[0];
          setRequestBodyContentType(firstContent.content_type || 'application/json');

          const schemaClassId = firstContent.schema_class_id || '';
          setRequestBodySchemaRef(schemaClassId);

          // Load schema name from class ID
          if (schemaClassId && selectedVersionId) {
            try {
              const classesResult = await getClassesForVersionAction(selectedVersionId);
              const classes = JSON.parse(classesResult);
              const schemaClass = classes.find((c: any) => c.id === schemaClassId);
              if (schemaClass) {
                setRequestBodySchemaName(schemaClass.name);
              }
            } catch (e) {
              console.error('Error loading schema class name:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading request body:', error);
    }
  };

  // Save request body to database
  const saveRequestBody = async (operationId: string) => {
    try {
      if (requestBodyEnabled) {
        if (requestBodyId) {
          // Update existing request body
          await updateOperationRequestBodyAction(requestBodyId, {
            description: requestBodyDescription,
            required: requestBodyRequired,
          });
          // Note: Content type updates would need a separate API call
          // For now we just update the request body metadata
        } else {
          // Create new request body
          const result = await createOperationRequestBodyAction(
            operationId,
            requestBodyDescription,
            requestBodyRequired
          );
          const parsedResult = JSON.parse(result);

          if (parsedResult.success && parsedResult.requestBody) {
            const newRequestBodyId = parsedResult.requestBody.id;
            setRequestBodyId(newRequestBodyId);

            // Add content type with schema reference
            if (requestBodyContentType) {
              await addRequestBodyContentTypeAction(
                newRequestBodyId,
                requestBodyContentType,
                requestBodySchemaRef || undefined,
                undefined, // schemaInline
                undefined  // example
              );
            }
          } else {
            console.error('Failed to create request body:', parsedResult.error);
          }
        }
      } else if (requestBodyId) {
        // Delete existing request body if disabled
        await deleteOperationRequestBodyAction(requestBodyId);
        setRequestBodyId(null);
      }
    } catch (error) {
      console.error('Error saving request body:', error);
    }
  };

  // Dynamically extract and update path variables when path pattern changes
  useEffect(() => {
    if (selectedNode?.data?.nodeType === 'path') {
      const extractedVarNames = extractPathVariables(pathPattern);

      // Create new variables for any that don't exist, preserve existing ones
      const updatedVariables: PathVariable[] = extractedVarNames.map(varName => {
        const existing = pathVariables.find(v => v.name === varName);
        return existing || {
          name: varName,
          description: '',
          type: 'string',
          required: true,
          example: '',
        };
      });

      // Only update if the variables have actually changed
      const hasChanged =
        updatedVariables.length !== pathVariables.length ||
        updatedVariables.some((v, i) => v.name !== pathVariables[i]?.name);

      if (hasChanged) {
        setPathVariables(updatedVariables);

        // Update the node data
        if (selectedNode?.updateData) {
          selectedNode.updateData({
            path: pathPattern,
            pathVariables: updatedVariables,
          });
        }
      }
    }
  }, [pathPattern, selectedNode?.data?.nodeType]);

  // Handle path pattern change
  const handlePathPatternChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPath = e.target.value;
    setPathPattern(newPath);
    setHasUnsavedChanges(true);
  };

  // Handle variable field changes
  const handleVariableChange = (index: number, field: keyof PathVariable, value: any) => {
    const updatedVariables = [...pathVariables];
    updatedVariables[index] = { ...updatedVariables[index], [field]: value };
    setPathVariables(updatedVariables);
    setHasUnsavedChanges(true);
  };

  // Handle other field changes
  const handleFieldChange = (field: keyof PathNodeData, value: any) => {
    setHasUnsavedChanges(true);
  };

  // Cancel changes - revert to original values
  const handleCancel = () => {
    setPathPattern(originalValues.pathPattern);
    setPathVariables(JSON.parse(JSON.stringify(originalValues.pathVariables)));
    setSummary(originalValues.summary);
    setDescription(originalValues.description);
    setSelectedTags([...originalValues.selectedTags]);
    setDeprecated(originalValues.deprecated);
    setExternalDocsUrl(originalValues.externalDocsUrl);
    setExternalDocsDescription(originalValues.externalDocsDescription);
    setOperationId(originalValues.operationId);
    setHasUnsavedChanges(false);
  };

  // Save changes to database
  const handleSave = async () => {
    const nodeType = selectedNode?.data?.nodeType;

    // Only save if we have a valid node type
    if (!nodeType || !['path', 'method'].includes(nodeType)) {
      return;
    }

    setIsSaving(true);
    try {
      // Build externalDocs object if URL is provided
      const externalDocs: ExternalDocs | undefined = externalDocsUrl.trim()
        ? { url: externalDocsUrl.trim(), description: externalDocsDescription.trim() || undefined }
        : undefined;

      // Update node data in canvas
      if (selectedNode?.updateData) {
        if (nodeType === 'path') {
          selectedNode.updateData({
            path: pathPattern,
            pathVariables: pathVariables,
            summary: summary,
            description: description,
            tags: selectedTags,
            deprecated: deprecated,
            externalDocs: externalDocs,
          });
        } else if (nodeType === 'method') {
          selectedNode.updateData({
            operationId: operationId,
            summary: summary,
            description: description,
          });
        }
      }

      // Save to database for path nodes
      if (nodeType === 'path' && selectedNode?.data?.dbPathId) {
        const updates: any = {
          path: pathPattern,
          summary: summary,
          description: description,
        };
        await updatePathAction(selectedNode.data.dbPathId, updates);

        // Save tags to database
        await setPathTagsAction(selectedNode.data.dbPathId, selectedTags);
      }

      // Save to database for method nodes
      if (nodeType === 'method') {
        const connectedPathId = selectedNode?.data?.connectedPathId;
        const dbOperationId = selectedNode?.data?.dbOperationId;
        const method = selectedNode?.data?.method;

        if (connectedPathId && method) {
          let currentOperationId = dbOperationId;

          if (dbOperationId) {
            // Update existing operation
            const updates: any = {
              operationId: operationId,
              summary: summary,
              description: description,
            };
            await updateOperationAction(dbOperationId, updates);

            // Save tags to database
            await setOperationTagsAction(dbOperationId, selectedTags);
          } else if (!selectedNode?.data?.pendingDbSave) {
            // Create new operation only if not pending
            // (pendingDbSave means it needs to be connected to a path first)
            const result = await createOperationAction(
              connectedPathId,
              method,
              operationId,
              summary,
              description,
              undefined, // externalDocs
              false, // deprecated
              undefined // servers
            );
            const parsedResult = JSON.parse(result);
            if (parsedResult.success && parsedResult.operation) {
              currentOperationId = parsedResult.operation.id;
              // Store the database ID in the node
              if (selectedNode?.updateData) {
                selectedNode.updateData({
                  dbOperationId: parsedResult.operation.id,
                  pendingDbSave: false,
                });
              }
            } else {
              console.error('Failed to create operation in database:', parsedResult.error);
            }
          }

          // Save request body if enabled and we have an operation ID
          if (currentOperationId && !['GET', 'DELETE', 'OPTIONS', 'HEAD'].includes(method?.toUpperCase() || '')) {
            await saveRequestBody(currentOperationId);
          }
        } else if (!connectedPathId) {
          console.warn('Method node is not connected to a path. Cannot save to database.');
        }
      }

      // Update original values to match saved values
      setOriginalValues({
        pathPattern,
        pathVariables: JSON.parse(JSON.stringify(pathVariables)),
        summary,
        description,
        selectedTags: [...selectedTags],
        deprecated,
        externalDocsUrl,
        externalDocsDescription,
        operationId,
      });

      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error saving changes:', error);
    } finally {
      setIsSaving(false);
    }
  };
  if (!selectedNode) {
    return (
      <div className="w-80 h-full border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select a node to view its properties
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 h-full border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
          {selectedNode.type || 'Node'} Properties
        </h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        >
          <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <ScrollArea.Root className="flex-1 overflow-hidden">
        <ScrollArea.Viewport className="h-full w-full">
          <div className="p-4 space-y-6">
            {/* Path Pattern Section */}
            {selectedNode?.data?.nodeType === 'path' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Path Pattern
                  </label>
                  <input
                    type="text"
                    value={pathPattern}
                    onChange={handlePathPatternChange}
                    placeholder="/api/v1/{userId}/orders/{orderId}"
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 font-mono"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Use {'{'}variable{'}'} syntax for path parameters
                  </p>
                </div>

                {/* Path Variables Section - Auto-extracted */}
                {pathVariables.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide flex items-center justify-between">
                      <span>Path Variables ({pathVariables.length})</span>
                      <span className="text-xs font-normal text-gray-500 dark:text-gray-400 normal-case">Auto-detected</span>
                    </h4>
                    <div className="space-y-4">
                      {pathVariables.map((variable, index) => (
                        <div key={variable.name} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                              {'{' + variable.name + '}'}
                            </span>
                            <span className={`px-2 py-0.5 text-xs rounded ${variable.required ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                              {variable.required ? 'Required' : 'Optional'}
                            </span>
                          </div>

                          <div>
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                              Description
                            </label>
                            <input
                              type="text"
                              value={variable.description}
                              onChange={(e) => handleVariableChange(index, 'description', e.target.value)}
                              placeholder="Describe this parameter..."
                              className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                Type
                              </label>
                              <select
                                value={variable.type}
                                onChange={(e) => handleVariableChange(index, 'type', e.target.value)}
                                className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="string">string</option>
                                <option value="integer">integer</option>
                                <option value="number">number</option>
                                <option value="boolean">boolean</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                Example
                              </label>
                              <input
                                type="text"
                                value={variable.example || ''}
                                onChange={(e) => handleVariableChange(index, 'example', e.target.value)}
                                placeholder="e.g., 12345"
                                className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          </div>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={variable.required}
                              onChange={(e) => handleVariableChange(index, 'required', e.target.checked)}
                              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <span className="text-xs text-gray-700 dark:text-gray-300">Required parameter</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                    Metadata
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Summary
                      </label>
                      <input
                        type="text"
                        value={summary}
                        onChange={(e) => {
                          setSummary(e.target.value);
                          handleFieldChange('summary', e.target.value);
                        }}
                        placeholder="Brief description"
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Description (Markdown supported)
                      </label>
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <Editor
                          height="200px"
                          language="markdown"
                          value={description}
                          onChange={(value) => {
                            const newValue = value || '';
                            setDescription(newValue);
                            handleFieldChange('description', newValue);
                          }}
                          theme={isDarkMode ? 'vs-dark' : 'light'}
                          options={{
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            fontSize: 12,
                            lineNumbers: 'off',
                            wordWrap: 'on',
                            wrappingStrategy: 'advanced',
                            padding: { top: 8, bottom: 8 },
                            folding: false,
                            glyphMargin: false,
                            lineDecorationsWidth: 0,
                            lineNumbersMinChars: 0,
                            renderLineHighlight: 'none',
                            contextmenu: true,
                            automaticLayout: true,
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Supports Markdown formatting (bold, italic, lists, links, etc.)
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Tags
                      </label>
                      <Popover.Root open={isTagDropdownOpen} onOpenChange={setIsTagDropdownOpen}>
                        <Popover.Trigger asChild>
                          <button
                            type="button"
                            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-left flex items-center justify-between hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                          >
                            <div className="flex-1 flex flex-wrap gap-1">
                              {selectedTags.length === 0 ? (
                                <span className="text-gray-400 dark:text-gray-500">Select tags...</span>
                              ) : (
                                selectedTags.map(tagId => {
                                  const tag = availableTags.find(t => t.id === tagId);
                                  return tag ? (
                                    <span
                                      key={tagId}
                                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                                      style={{
                                        backgroundColor: `${tag.color}20`,
                                        color: tag.color,
                                        border: `1px solid ${tag.color}40`
                                      }}
                                    >
                                      {tag.name}
                                    </span>
                                  ) : null;
                                })
                              )}
                            </div>
                            <ChevronDown className="h-4 w-4 text-gray-400 shrink-0 ml-2" />
                          </button>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content
                            className="z-[9999] w-[260px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden"
                            sideOffset={4}
                            align="start"
                          >
                            <div className="max-h-[200px] overflow-y-auto p-1">
                              {availableTags.length === 0 ? (
                                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                                  No tags defined for this project
                                </div>
                              ) : (
                                availableTags.map(tag => {
                                  const isSelected = selectedTags.includes(tag.id);
                                  return (
                                    <button
                                      key={tag.id}
                                      type="button"
                                      onClick={() => {
                                        const newTags = isSelected
                                          ? selectedTags.filter(id => id !== tag.id)
                                          : [...selectedTags, tag.id];
                                        setSelectedTags(newTags);
                                        setHasUnsavedChanges(true);
                                      }}
                                      className={`w-full px-3 py-2 flex items-center gap-2 text-left text-sm rounded transition-colors ${
                                        isSelected 
                                          ? 'bg-indigo-50 dark:bg-indigo-900/30' 
                                          : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                                      }`}
                                    >
                                      <div
                                        className="w-3 h-3 rounded-full shrink-0"
                                        style={{ backgroundColor: tag.color }}
                                      />
                                      <span className="flex-1 text-gray-900 dark:text-white truncate">
                                        {tag.name}
                                      </span>
                                      {isSelected && (
                                        <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                      )}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Select tags to group this path logically
                      </p>
                    </div>
                  </div>
                </div>

                {/* External Documentation Section */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide flex items-center gap-2">
                    <ExternalLink className="h-3.5 w-3.5" />
                    External Documentation
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Documentation URL
                      </label>
                      <input
                        type="url"
                        value={externalDocsUrl}
                        onChange={(e) => {
                          setExternalDocsUrl(e.target.value);
                          setHasUnsavedChanges(true);
                        }}
                        placeholder="https://docs.example.com/api/users"
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Link Description
                      </label>
                      <input
                        type="text"
                        value={externalDocsDescription}
                        onChange={(e) => {
                          setExternalDocsDescription(e.target.value);
                          setHasUnsavedChanges(true);
                        }}
                        placeholder="Learn more about user endpoints"
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                      />
                    </div>
                    {externalDocsUrl && (
                      <a
                        href={externalDocsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open documentation link
                      </a>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                    Options
                  </h4>
                  <div className="space-y-2">
                    <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-lg border-2 transition-colors ${
                      deprecated 
                        ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}>
                      <input
                        type="checkbox"
                        checked={deprecated}
                        onChange={(e) => {
                          setDeprecated(e.target.checked);
                          handleFieldChange('deprecated', e.target.checked);
                        }}
                        className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500 mt-0.5"
                      />
                      <div className="flex-1">
                        <span className={`text-sm font-medium ${deprecated ? 'text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-300'}`}>
                          Mark as Deprecated
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Deprecated paths will be displayed with a strikethrough and warning badge
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <button className="w-full px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    Delete Path
                  </button>
                </div>
              </>
            )}

            {/* Method Node Properties */}
            {selectedNode?.data?.nodeType === 'method' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Operation ID
                  </label>
                  <input
                    type="text"
                    value={operationId}
                    onChange={(e) => {
                      setOperationId(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="e.g., getUserById"
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 font-mono"
                  />
                  <button
                    onClick={() => {
                      // Get the method from the node data
                      const method = selectedNode?.data?.method || 'get';
                      // Try to find the connected path to get the path pattern
                      // For now, use a sample path - in the future we could traverse edges
                      const connectedPath = selectedNode?.data?.connectedPath || '/api/v1/example';
                      const generatedId = generateOperationId(method, connectedPath);
                      setOperationId(generatedId);
                      setHasUnsavedChanges(true);
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-md transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Auto-generate from path
                  </button>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Unique identifier for this operation (e.g., getUsers, createOrder)
                  </p>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Summary
                  </label>
                  <input
                    type="text"
                    value={summary}
                    onChange={(e) => {
                      setSummary(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="Brief description of the operation"
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                  />
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <Editor
                      height="150px"
                      language="markdown"
                      value={description}
                      onChange={(value) => {
                        setDescription(value || '');
                        setHasUnsavedChanges(true);
                      }}
                      theme={isDarkMode ? 'vs-dark' : 'light'}
                      options={{
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontSize: 12,
                        lineNumbers: 'off',
                        wordWrap: 'on',
                        wrappingStrategy: 'advanced',
                        padding: { top: 8, bottom: 8 },
                        folding: false,
                        glyphMargin: false,
                        lineDecorationsWidth: 0,
                        lineNumbersMinChars: 0,
                        renderLineHighlight: 'none',
                        automaticLayout: true,
                      }}
                    />
                  </div>
                </div>

                {/* Tags Section for Method Nodes */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Tags
                  </label>
                  <Popover.Root>
                    <Popover.Trigger asChild>
                      <button
                        type="button"
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-left flex items-center justify-between hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                      >
                        <span className="text-gray-900 dark:text-white">
                          {selectedTags.length === 0 ? 'Select tags...' : `${selectedTags.length} tag${selectedTags.length !== 1 ? 's' : ''} selected`}
                        </span>
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content
                        className="z-9999 w-[260px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden"
                        sideOffset={5}
                        align="start"
                      >
                        <div className="max-h-[300px] overflow-y-auto p-2">
                          {availableTags.length === 0 ? (
                            <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                              No tags defined for this project
                            </div>
                          ) : (
                            availableTags.map((tag) => {
                              const isSelected = selectedTags.includes(tag.id);
                              return (
                                <button
                                  key={tag.id}
                                  type="button"
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedTags(selectedTags.filter(id => id !== tag.id));
                                    } else {
                                      setSelectedTags([...selectedTags, tag.id]);
                                    }
                                    setHasUnsavedChanges(true);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-left"
                                >
                                  <div className="flex-shrink-0 w-4 h-4 border-2 border-gray-300 dark:border-gray-600 rounded flex items-center justify-center">
                                    {isSelected && <Check className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: tag.color }}
                                      />
                                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        {tag.name}
                                      </span>
                                    </div>
                                    {tag.description && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                                        {tag.description}
                                      </p>
                                    )}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                  {selectedTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {selectedTags.map((tagId) => {
                        const tag = availableTags.find(t => t.id === tagId);
                        if (!tag) return null;
                        return (
                          <span
                            key={tagId}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border"
                            style={{
                              backgroundColor: `${tag.color}15`,
                              borderColor: `${tag.color}40`,
                              color: tag.color,
                            }}
                          >
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: tag.color }}
                            />
                            {tag.name}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTags(selectedTags.filter(id => id !== tagId));
                                setHasUnsavedChanges(true);
                              }}
                              className="hover:opacity-70"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                    Request Body
                  </h4>

                  {/* Check if method typically has request body */}
                  {['GET', 'DELETE', 'OPTIONS', 'HEAD'].includes(selectedNode?.data?.method?.toUpperCase() || '') ? (
                    <div className="px-3 py-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                        {selectedNode?.data?.method?.toUpperCase()} requests typically do not have a request body
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Enable Request Body Toggle */}
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={requestBodyEnabled}
                          onChange={(e) => {
                            setRequestBodyEnabled(e.target.checked);
                            setHasUnsavedChanges(true);
                          }}
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Enable Request Body
                        </span>
                      </label>

                      {requestBodyEnabled && (
                        <>
                          {/* Content Type Selector */}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                              Content Type
                            </label>
                            <select
                              value={requestBodyContentType}
                              onChange={(e) => {
                                setRequestBodyContentType(e.target.value);
                                setHasUnsavedChanges(true);
                              }}
                              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              <option value="application/json">application/json</option>
                              <option value="application/xml">application/xml</option>
                              <option value="multipart/form-data">multipart/form-data</option>
                              <option value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</option>
                              <option value="text/plain">text/plain</option>
                              <option value="application/octet-stream">application/octet-stream</option>
                            </select>
                          </div>

                          {/* Schema Reference */}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                              Schema Reference
                            </label>
                            <div className="flex gap-2">
                              <div className="flex-1 relative">
                                <input
                                  type="text"
                                  value={requestBodySchemaName || requestBodySchemaRef}
                                  onChange={(e) => {
                                    setRequestBodySchemaRef(e.target.value);
                                    setRequestBodySchemaName('');
                                    setHasUnsavedChanges(true);
                                  }}
                                  placeholder="e.g., CreateOrderRequest"
                                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono pr-8"
                                />
                                {requestBodySchemaName && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRequestBodySchemaRef('');
                                      setRequestBodySchemaName('');
                                      setHasUnsavedChanges(true);
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                                    title="Clear selection"
                                  >
                                    <X className="w-3 h-3 text-gray-400" />
                                  </button>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsSchemaPickerOpen(true)}
                                className="px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                title="Browse schemas"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                </svg>
                              </button>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Reference a schema class from the library or type a name
                            </p>
                          </div>

                          {/* Description */}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                              Description
                            </label>
                            <textarea
                              value={requestBodyDescription}
                              onChange={(e) => {
                                setRequestBodyDescription(e.target.value);
                                setHasUnsavedChanges(true);
                              }}
                              placeholder="Describe the request body..."
                              rows={2}
                              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                            />
                          </div>

                          {/* Required Toggle */}
                          <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                            <input
                              type="checkbox"
                              checked={requestBodyRequired}
                              onChange={(e) => {
                                setRequestBodyRequired(e.target.checked);
                                setHasUnsavedChanges(true);
                              }}
                              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <div>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Required
                              </span>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Mark request body as mandatory for this operation
                              </p>
                            </div>
                          </label>

                          {/* Schema Preview (if set) */}
                          {(requestBodySchemaRef || requestBodySchemaName) && (
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-mono bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">
                                  {requestBodyContentType}
                                </span>
                                {requestBodyRequired && (
                                  <span className="text-xs bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 px-2 py-0.5 rounded">
                                    required
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-indigo-600 dark:text-indigo-400">{'{ }'}</span>
                                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                                  {requestBodySchemaName || requestBodySchemaRef}
                                </span>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Parameters Section */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                    Parameters
                  </h4>
                  <div className="space-y-2">
                    <button className="w-full px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                      + Add Query Param
                    </button>
                    <button className="w-full px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                      + Add Header Param
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                    Responses
                  </h4>
                  <div className="space-y-2">
                    <button className="w-full px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                      + Add Response
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <button className="w-full px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                    🗑️ Delete Operation
                  </button>
                </div>
              </>
            )}

            {/* Generic Node Info */}
            {!['path', 'method'].includes(selectedNode?.data?.nodeType) && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <p>Node ID: {selectedNode?.id}</p>
                <p className="mt-2">Type: {selectedNode?.data?.nodeType}</p>
              </div>
            )}
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar
          className="flex touch-none select-none p-0.5 bg-gray-100 dark:bg-gray-900 transition-colors hover:bg-gray-200 dark:hover:bg-gray-800"
          orientation="vertical"
        >
          <ScrollArea.Thumb className="flex-1 bg-gray-400 dark:bg-gray-600 rounded-full relative before:content-[''] before:absolute before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-full before:h-full before:min-w-11 before:min-h-11" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>

      {/* Footer with Cancel/Save buttons - show for path and method nodes */}
      {(selectedNode?.data?.nodeType === 'path' || selectedNode?.data?.nodeType === 'method') && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={!hasUnsavedChanges}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges || isSaving}
              className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
          {hasUnsavedChanges && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 text-center">
              You have unsaved changes
            </p>
          )}
        </div>
      )}

      {/* Schema Picker Modal */}
      <SchemaPicker
        isOpen={isSchemaPickerOpen}
        onClose={() => setIsSchemaPickerOpen(false)}
        onSelect={(schemaId, schemaName) => {
          setRequestBodySchemaRef(schemaId);
          setRequestBodySchemaName(schemaName);
          setHasUnsavedChanges(true);
        }}
        currentValue={requestBodySchemaRef}
      />
    </div>
  );
}

