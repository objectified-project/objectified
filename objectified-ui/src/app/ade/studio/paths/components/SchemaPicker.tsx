'use client';

import React, { useState, useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Search, ChevronRight, Database } from 'lucide-react';
import { getClassesForVersionAction } from '../actions';
import { useStudio } from '../../StudioContext';

interface SchemaClass {
  id: string;
  name: string;
  description?: string;
  class_type?: string;
}

interface SchemaPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (schemaId: string, schemaName: string) => void;
  currentValue?: string;
}

export default function SchemaPicker({ isOpen, onClose, onSelect, currentValue }: SchemaPickerProps) {
  const { selectedVersionId } = useStudio();
  const [schemas, setSchemas] = useState<SchemaClass[]>([]);
  const [filteredSchemas, setFilteredSchemas] = useState<SchemaClass[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSchemaId, setSelectedSchemaId] = useState<string | null>(null);

  // Load schemas when dialog opens
  useEffect(() => {
    if (isOpen && selectedVersionId) {
      loadSchemas();
    }
  }, [isOpen, selectedVersionId]);

  // Filter schemas based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredSchemas(schemas);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredSchemas(
        schemas.filter(
          (s) =>
            s.name.toLowerCase().includes(term) ||
            s.description?.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, schemas]);

  const loadSchemas = async () => {
    if (!selectedVersionId) return;

    setIsLoading(true);
    try {
      const result = await getClassesForVersionAction(selectedVersionId);
      const parsed = JSON.parse(result);
      if (Array.isArray(parsed)) {
        setSchemas(parsed);
        setFilteredSchemas(parsed);
      }
    } catch (error) {
      console.error('Error loading schemas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = () => {
    const schema = schemas.find((s) => s.id === selectedSchemaId);
    if (schema) {
      onSelect(schema.id, schema.name);
      onClose();
    }
  };

  const handleDoubleClick = (schema: SchemaClass) => {
    onSelect(schema.id, schema.name);
    onClose();
  };

  // Get class type badge color
  const getTypeColor = (classType?: string) => {
    switch (classType?.toLowerCase()) {
      case 'object':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300';
      case 'enum':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300';
      case 'array':
        return 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] max-h-[600px] bg-white dark:bg-gray-900 rounded-xl shadow-2xl z-[10001] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                  Select Schema
                </Dialog.Title>
                <Dialog.Description className="text-sm text-gray-500 dark:text-gray-400">
                  Choose a schema class for the request body
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </Dialog.Close>
          </div>

          {/* Search */}
          <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search schemas..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                autoFocus
              />
            </div>
          </div>

          {/* Schema List */}
          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : filteredSchemas.length === 0 ? (
              <div className="text-center py-12">
                <Database className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {searchTerm ? 'No schemas match your search' : 'No schemas available'}
                </p>
                {!searchTerm && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Create schemas in the Schema Designer first
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredSchemas.map((schema) => (
                  <button
                    key={schema.id}
                    onClick={() => setSelectedSchemaId(schema.id)}
                    onDoubleClick={() => handleDoubleClick(schema)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors ${
                      selectedSchemaId === schema.id
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-500'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex-shrink-0 w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                      <span className="text-lg text-gray-600 dark:text-gray-400">{'{ }'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {schema.name}
                        </span>
                        {schema.class_type && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${getTypeColor(schema.class_type)}`}>
                            {schema.class_type}
                          </span>
                        )}
                      </div>
                      {schema.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {schema.description}
                        </p>
                      )}
                    </div>
                    <ChevronRight className={`w-4 h-4 text-gray-400 transition-opacity ${
                      selectedSchemaId === schema.id ? 'opacity-100' : 'opacity-0'
                    }`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {filteredSchemas.length} schema{filteredSchemas.length !== 1 ? 's' : ''} available
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSelect}
                disabled={!selectedSchemaId}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Select Schema
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

