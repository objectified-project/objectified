'use client';

import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import { extractPathVariables, PathVariable, PathNodeData } from '@/app/components/ade/paths/PathNode';
import { updatePathAction, deletePathAction } from '../actions';

interface PropertiesPanelProps {
  selectedNode: any | null;
  onClose: () => void;
}

export default function PropertiesPanel({ selectedNode, onClose }: PropertiesPanelProps) {
  const [pathPattern, setPathPattern] = useState('');
  const [pathVariables, setPathVariables] = useState<PathVariable[]>([]);
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [deprecated, setDeprecated] = useState(false);

  // Initialize state when node is selected
  useEffect(() => {
    if (selectedNode?.data) {
      const data = selectedNode.data as PathNodeData;
      setPathPattern(data.path || '');
      setPathVariables(data.pathVariables || []);
      setSummary(data.summary || '');
      setDescription(data.description || '');
      setTags(data.tags?.join(', ') || '');
      setDeprecated(data.deprecated || false);
    }
  }, [selectedNode?.id]);

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
  const handlePathPatternChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPath = e.target.value;
    setPathPattern(newPath);

    if (selectedNode?.updateData) {
      selectedNode.updateData({ path: newPath });
    }

    // Save to database if we have a dbPathId
    if (selectedNode?.data?.dbPathId) {
      try {
        await updatePathAction(selectedNode.data.dbPathId, { path: newPath });
      } catch (error) {
        console.error('Error updating path in database:', error);
      }
    }
  };

  // Handle variable field changes
  const handleVariableChange = (index: number, field: keyof PathVariable, value: any) => {
    const updatedVariables = [...pathVariables];
    updatedVariables[index] = { ...updatedVariables[index], [field]: value };
    setPathVariables(updatedVariables);

    if (selectedNode?.updateData) {
      selectedNode.updateData({ pathVariables: updatedVariables });
    }
  };

  // Handle other field changes
  const handleFieldChange = async (field: keyof PathNodeData, value: any) => {
    if (selectedNode?.updateData) {
      selectedNode.updateData({ [field]: value });
    }

    // Save to database if we have a dbPathId and it's a path-related field
    if (selectedNode?.data?.dbPathId && selectedNode?.data?.nodeType === 'path') {
      try {
        const updates: any = {};

        // Map field names to database columns
        if (field === 'summary') updates.summary = value;
        if (field === 'description') updates.description = value;
        if (field === 'tags') updates.tags = value;
        if (field === 'deprecated') updates.deprecated = value;

        if (Object.keys(updates).length > 0) {
          await updatePathAction(selectedNode.data.dbPathId, updates);
        }
      } catch (error) {
        console.error('Error updating path field in database:', error);
      }
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
                        Description
                      </label>
                      <textarea
                        rows={3}
                        value={description}
                        onChange={(e) => {
                          setDescription(e.target.value);
                          handleFieldChange('description', e.target.value);
                        }}
                        placeholder="Detailed description"
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Tags (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={tags}
                        onChange={(e) => {
                          setTags(e.target.value);
                          handleFieldChange('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean));
                        }}
                        placeholder="user, authentication"
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                    Options
                  </h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deprecated}
                        onChange={(e) => {
                          setDeprecated(e.target.checked);
                          handleFieldChange('deprecated', e.target.checked);
                        }}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Deprecated</span>
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
                    defaultValue="operationName"
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                  />
                  <button className="mt-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">
                    💡 Auto-generate
                  </button>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                    Request
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
    </div>
  );
}

