'use client';

import { useState } from 'react';
import { Package, Search, ChevronRight, Check } from 'lucide-react';
import * as Checkbox from '@radix-ui/react-checkbox';
import * as Select from '@radix-ui/react-select';
import { AnalysisResult } from '../../../utils/openapi-analyzer';

interface PreviewPanelProps {
  analysis: AnalysisResult;
  onImportOptionsChange?: (options: ImportOptions) => void;
}

export interface ImportOptions {
  targetProject: string;
  targetVersion: string;
  autoLayout: boolean;
  createRelationships: boolean;
  applyNamingConvention: boolean;
  generateDocumentation: boolean;
  selectedSchemas: string[];
}

interface SchemaInfo {
  name: string;
  properties: number;
  selected: boolean;
  required: boolean;
}

export function PreviewPanel({ analysis, onImportOptionsChange }: PreviewPanelProps) {
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedSchemaName, setSelectedSchemaName] = useState<string | null>(null);
  const [schemas, setSchemas] = useState<SchemaInfo[]>(() => {
    const schemaObj = analysis.document?.components?.schemas || analysis.document?.definitions || {};
    return Object.keys(schemaObj).map(name => ({
      name,
      properties: Object.keys(schemaObj[name]?.properties || {}).length,
      selected: true,
      required: false
    }));
  });

  const [importOptions, setImportOptions] = useState<ImportOptions>({
    targetProject: 'new',
    targetVersion: analysis.document?.info?.version || '1.0.0',
    autoLayout: true,
    createRelationships: true,
    applyNamingConvention: true,
    generateDocumentation: false,
    selectedSchemas: schemas.map(s => s.name)
  });

  const [newProjectName, setNewProjectName] = useState(
    analysis.document?.info?.title || 'New Project'
  );

  const selectedSchema = selectedSchemaName
    ? (analysis.document?.components?.schemas?.[selectedSchemaName] ||
       analysis.document?.definitions?.[selectedSchemaName])
    : null;

  const filteredSchemas = schemas.filter(schema =>
    schema.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const selectedCount = schemas.filter(s => s.selected).length;

  const handleSelectAll = () => {
    const newSchemas = schemas.map(s => ({ ...s, selected: true }));
    setSchemas(newSchemas);
    updateSelectedSchemas(newSchemas);
  };

  const handleSelectNone = () => {
    const newSchemas = schemas.map(s => ({ ...s, selected: s.required }));
    setSchemas(newSchemas);
    updateSelectedSchemas(newSchemas);
  };

  const handleToggleSchema = (name: string) => {
    const newSchemas = schemas.map(s =>
      s.name === name ? { ...s, selected: !s.selected } : s
    );
    setSchemas(newSchemas);
    updateSelectedSchemas(newSchemas);
  };

  const updateSelectedSchemas = (schemaList: SchemaInfo[]) => {
    const selected = schemaList.filter(s => s.selected).map(s => s.name);
    const newOptions = { ...importOptions, selectedSchemas: selected };
    setImportOptions(newOptions);
    onImportOptionsChange?.(newOptions);
  };

  const handleOptionChange = (key: keyof ImportOptions, value: any) => {
    const newOptions = { ...importOptions, [key]: value };
    setImportOptions(newOptions);
    onImportOptionsChange?.(newOptions);
  };

  const getPropertyType = (prop: any): string => {
    if (prop.$ref) {
      const refName = prop.$ref.split('/').pop();
      return `$ref → ${refName}`;
    }
    if (prop.type === 'array') {
      if (prop.items?.$ref) {
        const refName = prop.items.$ref.split('/').pop();
        return `array<$ref → ${refName}>`;
      }
      return `array<${prop.items?.type || 'any'}>`;
    }
    if (prop.enum) {
      return `enum`;
    }
    return prop.type || 'any';
  };

  return (
    <div className="space-y-6">
      {/* Schema Selection Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
            >
              Select All
            </button>
            <button
              onClick={handleSelectNone}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Select None
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {selectedCount} of {schemas.length} selected
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Filter schemas..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Schema Selection and Preview */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left: Schema List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="border-b border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Schemas to Import
            </h3>
          </div>
          <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
            {filteredSchemas.map((schema) => (
              <div
                key={schema.name}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedSchemaName === schema.name
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
                onClick={() => setSelectedSchemaName(schema.name)}
              >
                <Checkbox.Root
                  checked={schema.selected}
                  onCheckedChange={() => handleToggleSchema(schema.name)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 flex items-center justify-center"
                >
                  <Checkbox.Indicator>
                    <Check className="w-4 h-4 text-white" />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <Package className="h-5 w-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {schema.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {schema.properties} properties
                  </div>
                </div>
                {selectedSchemaName === schema.name && (
                  <ChevronRight className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Schema Preview */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="border-b border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Schema Preview
            </h3>
          </div>
          <div className="p-4 max-h-[400px] overflow-y-auto">
            {selectedSchema && selectedSchemaName ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {selectedSchemaName}
                  </h4>
                  {selectedSchema.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {selectedSchema.description}
                    </p>
                  )}
                </div>

                {selectedSchema.properties && (
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Properties:
                    </h5>
                    <div className="space-y-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                      {Object.entries(selectedSchema.properties).map(([propName, propValue]: [string, any]) => (
                        <div key={propName} className="text-sm">
                          <span className="font-mono text-indigo-600 dark:text-indigo-400">
                            {propName}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">: </span>
                          <span className="text-gray-700 dark:text-gray-300">
                            {getPropertyType(propValue)}
                          </span>
                          {selectedSchema.required?.includes(propName) && (
                            <span className="ml-2 text-xs text-red-600 dark:text-red-400 font-medium">
                              (required)
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                Select a schema to preview
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Import Options */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Import Options
        </h3>

        <div className="space-y-4">
          {/* Target Project */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Target Project
            </label>
            <div className="flex gap-2">
              <Select.Root
                value={importOptions.targetProject}
                onValueChange={(value) => handleOptionChange('targetProject', value)}
              >
                <Select.Trigger className="flex-1 inline-flex items-center justify-between px-4 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <Select.Value />
                  <Select.Icon>
                    <ChevronRight className="h-4 w-4 rotate-90" />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal container={typeof document !== 'undefined' ? document.body : undefined}>
                  <Select.Content
                    className="overflow-hidden bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700"
                    position="popper"
                    sideOffset={5}
                    style={{ zIndex: 9999 }}
                  >
                    <Select.Viewport className="p-1">
                      <Select.Item
                        value="new"
                        className="relative flex items-center px-8 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-md outline-none cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 focus:bg-indigo-50 dark:focus:bg-indigo-900/20"
                      >
                        <Select.ItemText>+ Create New Project</Select.ItemText>
                        <Select.ItemIndicator className="absolute left-2">
                          <Check className="w-4 h-4" />
                        </Select.ItemIndicator>
                      </Select.Item>
                      <Select.Item
                        value="existing"
                        className="relative flex items-center px-8 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-md outline-none cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 focus:bg-indigo-50 dark:focus:bg-indigo-900/20"
                      >
                        <Select.ItemText>Import to Existing Project</Select.ItemText>
                        <Select.ItemIndicator className="absolute left-2">
                          <Check className="w-4 h-4" />
                        </Select.ItemIndicator>
                      </Select.Item>
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>

            {importOptions.targetProject === 'new' && (
              <div className="mt-2">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Project name"
                  className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            )}
          </div>

          {/* Target Version */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Version
              </label>
              <input
                type="text"
                value={importOptions.targetVersion}
                onChange={(e) => handleOptionChange('targetVersion', e.target.value)}
                placeholder="e.g., 1.0.0"
                className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-end">
              <button className="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors">
                + New Version
              </button>
            </div>
          </div>

          {/* Import Options Checkboxes */}
          <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <label className="flex items-start gap-3 cursor-pointer group">
              <Checkbox.Root
                checked={importOptions.autoLayout}
                onCheckedChange={(checked) => handleOptionChange('autoLayout', checked)}
                className="mt-0.5 w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 flex items-center justify-center"
              >
                <Checkbox.Indicator>
                  <Check className="w-4 h-4 text-white" />
                </Checkbox.Indicator>
              </Checkbox.Root>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  Auto-layout imported schemas on canvas
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Automatically arrange schemas using the selected layout algorithm
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <Checkbox.Root
                checked={importOptions.createRelationships}
                onCheckedChange={(checked) => handleOptionChange('createRelationships', checked)}
                className="mt-0.5 w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 flex items-center justify-center"
              >
                <Checkbox.Indicator>
                  <Check className="w-4 h-4 text-white" />
                </Checkbox.Indicator>
              </Checkbox.Root>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  Create relationships from $ref
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Automatically create relationships based on schema references
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <Checkbox.Root
                checked={importOptions.applyNamingConvention}
                onCheckedChange={(checked) => handleOptionChange('applyNamingConvention', checked)}
                className="mt-0.5 w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 flex items-center justify-center"
              >
                <Checkbox.Indicator>
                  <Check className="w-4 h-4 text-white" />
                </Checkbox.Indicator>
              </Checkbox.Root>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  Apply naming convention (PascalCase)
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Convert schema names to PascalCase format
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <Checkbox.Root
                checked={importOptions.generateDocumentation}
                onCheckedChange={(checked) => handleOptionChange('generateDocumentation', checked)}
                className="mt-0.5 w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 flex items-center justify-center"
              >
                <Checkbox.Indicator>
                  <Check className="w-4 h-4 text-white" />
                </Checkbox.Indicator>
              </Checkbox.Root>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  Generate documentation from descriptions
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Create documentation based on schema descriptions
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

