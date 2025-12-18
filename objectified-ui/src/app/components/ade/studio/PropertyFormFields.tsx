'use client';

import React from 'react';
import { cn } from '../../../../../lib/utils';
import { Input } from '../../ui/Input';
import { Textarea } from '../../ui/Textarea';
import { Checkbox } from '../../ui/Checkbox';
import { Label } from '../../ui/Label';
import { RadioGroup, RadioGroupItem } from '../../ui/RadioGroup';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/Tooltip';
import { Collapsible, CollapsibleContent } from '../../ui/Collapsible';
import { FormField } from '../../ui/FormField';
import {
  Plus,
  Trash2,
  Sparkles,
  SortAsc,
  GripVertical,
  ExternalLink,
  Info,
  Settings,
  Sliders,
  Code
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RegexTester } from './RegexTester';
import { PrefixItemsEditor } from './PrefixItemsEditor';
import { ExtensionsEditor } from './ExtensionsEditor';

// Custom hook to detect dark mode
const useDarkMode = () => {
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    checkDarkMode();

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return isDark;
};

export interface PropertyFormData {
  // Basic fields
  title?: string;
  description?: string;
  format?: string;
  pattern?: string;

  // String constraints
  minLength?: string;
  maxLength?: string;

  // Number constraints
  minimum?: string;
  maximum?: string;
  minimumType?: 'inclusive' | 'exclusive'; // OpenAPI 3.1: determines whether to use minimum or exclusiveMinimum
  maximumType?: 'inclusive' | 'exclusive'; // OpenAPI 3.1: determines whether to use maximum or exclusiveMaximum
  multipleOf?: string;

  // Array constraints
  minItems?: string;
  maxItems?: string;
  uniqueItems?: boolean;
  contains?: string; // OpenAPI 3.1: JSON Schema that at least one array item must match
  minContains?: string; // OpenAPI 3.1: Minimum number of items that must match contains schema
  maxContains?: string; // OpenAPI 3.1: Maximum number of items that must match contains schema

  // Tuple mode (OpenAPI 3.1)
  tupleMode?: boolean; // Toggle for tuple mode with prefixItems
  prefixItems?: any[]; // OpenAPI 3.1: Array of schemas for specific positions
  itemsSchema?: string; // JSON string of items schema for positions beyond prefix

  // unevaluatedItems (OpenAPI 3.1/JSON Schema 2020-12)
  unevaluatedItems?: 'default' | 'allow' | 'disallow' | 'schema'; // Control for items not matched by prefixItems, items, or contains
  unevaluatedItemsSchema?: string; // JSON string of schema when unevaluatedItems is 'schema'

  // Common constraints
  enum?: string[];
  const?: string; // OpenAPI 3.1: Constant value (mutually exclusive with enum)
  default?: string;

  // Composition constraints
  not?: string; // OpenAPI 3.1: JSON Schema that the data must NOT match

  // Metadata
  required?: boolean;
  nullable?: boolean; // OpenAPI 3.1: Outputs type as array like ['string', 'null']
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;
  deprecationMessage?: string;
  examples?: string[]; // Array of example values (JSON strings)

  // Object constraints
  additionalProperties?: 'default' | 'true' | 'false';
  minProperties?: string;
  maxProperties?: string;
  propertyNamesPattern?: string;
  propertyNamesMinLength?: string;
  propertyNamesMaxLength?: string;

  // unevaluatedProperties (OpenAPI 3.1/JSON Schema 2020-12) - for objects
  unevaluatedProperties?: 'default' | 'allow' | 'disallow' | 'schema'; // Control for properties not matched by properties, patternProperties, or inherited schemas
  unevaluatedPropertiesSchema?: string; // JSON string of schema when unevaluatedProperties is 'schema'

  // Extensions (x- prefixed properties)
  extensions?: Record<string, any>;

  // External Documentation
  externalDocsUrl?: string;
  externalDocsDescription?: string;
}

interface SortableEnumItemProps {
  id: string;
  value: string;
  onDelete: (value: string) => void;
}

const SortableEnumItem: React.FC<SortableEnumItemProps> = ({ id, value, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef}
      style={style}
      sx={{
        borderBottom: '1px solid #f1f5f9',
        backgroundColor: isDragging ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        pl: 1.5,
        pr: 1.5,
        py: 1,
        transition: 'background-color 0.2s ease',
        '&:hover': {
          backgroundColor: 'rgba(99, 102, 241, 0.04)',
        },
        '&:last-child': {
          borderBottom: 'none',
        },
      }}
    >
      <button {...attributes}
        {...listeners}
        sx={{
          cursor: 'grab',
          '&:active': { cursor: 'grabbing' },
          color: '#94a3b8',
          flex: 0,
          p: 0.5,
          transition: 'color 0.2s ease',
          '&:hover': { color: '#6366f1' },
        }}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <ListItemText
        primary={value}
        primaryTypographyProps={{
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontSize: '0.875rem',
          color: '#334155',
        }}
      />
      <button
        onClick={() => onDelete(value)}
        sx={{
          flex: 0,
          color: '#94a3b8',
          transition: 'all 0.2s ease',
          '&:hover': {
            color: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
          },
        }}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
};

// Section header component for consistent styling across form sections
interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title, subtitle, badge }) => {
  const isDark = useDarkMode();

  return (
    <div className={cn("flex flex-col")}>
      <div className={cn("flex flex-col")}>
        {icon}
      </div>
      <div className={cn("flex flex-col")}>
        <h3 className="text-base font-semibold">
          {title}
        </h3>
        {subtitle && (
          <span className="text-xs">
            {subtitle}
          </span>
        )}
      </div>
      {badge && (
        <span className="text-xs">
          {badge}
        </span>
      )}
    </div>
  );
};

export interface PropertyFormFieldsProps {
  // Property type info
  baseType: string;
  isArray: boolean;

  // Form data
  data: PropertyFormData;

  // Change handlers
  onChange: (field: keyof PropertyFormData, value: any) => void;

  // Optional: Show/hide certain fields
  showMetadata?: boolean;
  showTitle?: boolean;
  size?: 'small' | 'medium';

  // Object type information
  nestedProperties?: Array<{
    id: string;
    name: string;
    data: any;
    description?: string;
  }>;
}

export const PropertyFormFields: React.FC<PropertyFormFieldsProps> = ({
  baseType,
  isArray,
  data,
  onChange,
  showMetadata = true,
  showTitle = true,
  size = 'medium',
  nestedProperties,
}) => {
  const isDark = useDarkMode();

  const [enumInput, setEnumInput] = React.useState('');
  const [enumError, setEnumError] = React.useState('');
  const [exampleInput, setExampleInput] = React.useState('');
  const [exampleError, setExampleError] = React.useState('');

  // DnD sensors for enum reordering
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Generate an example value based on the property schema
  const generateExample = () => {
    let exampleValue: any;

    // If enum values exist, use the first one
    if (data.enum && data.enum.length > 0) {
      exampleValue = data.enum[0];
      // Try to parse as number if baseType is number/integer
      if (baseType === 'number' || baseType === 'integer') {
        const numValue = Number(exampleValue);
        if (!isNaN(numValue)) {
          exampleValue = numValue;
        }
      }
    } else {
      // Generate based on type
      switch (baseType) {
        case 'string':
          if (data.format === 'email') {
            exampleValue = 'user@example.com';
          } else if (data.format === 'uri' || data.format === 'url') {
            exampleValue = 'https://example.com';
          } else if (data.format === 'date') {
            exampleValue = '2025-11-30';
          } else if (data.format === 'date-time') {
            exampleValue = '2025-11-30T12:00:00Z';
          } else if (data.format === 'time') {
            exampleValue = '12:00:00';
          } else if (data.format === 'uuid') {
            exampleValue = '123e4567-e89b-12d3-a456-426614174000';
          } else if (data.pattern) {
            // For patterns, provide a hint
            exampleValue = `string matching pattern: ${data.pattern}`;
          } else {
            exampleValue = data.description || 'example string';
          }
          break;

        case 'number':
          if (data.minimum) {
            exampleValue = parseFloat(data.minimum) + (data.minimumType === 'exclusive' ? 0.1 : 0);
          } else if (data.maximum) {
            exampleValue = parseFloat(data.maximum) - (data.maximumType === 'exclusive' ? 0.1 : 0);
          } else {
            exampleValue = 42.5;
          }
          break;

        case 'integer':
          if (data.minimum) {
            exampleValue = Math.ceil(parseFloat(data.minimum) + (data.minimumType === 'exclusive' ? 1 : 0));
          } else if (data.maximum) {
            exampleValue = Math.floor(parseFloat(data.maximum) - (data.maximumType === 'exclusive' ? 1 : 0));
          } else {
            exampleValue = 42;
          }
          break;

        case 'boolean':
          exampleValue = true;
          break;

        case 'object':
          exampleValue = {};
          // Add nested properties if available
          if (nestedProperties && nestedProperties.length > 0) {
            nestedProperties.forEach(prop => {
              const propData = typeof prop.data === 'string' ? JSON.parse(prop.data) : prop.data;
              // Generate simple example for nested properties
              if (propData.type === 'string') {
                exampleValue[prop.name] = 'example';
              } else if (propData.type === 'number') {
                exampleValue[prop.name] = 0;
              } else if (propData.type === 'boolean') {
                exampleValue[prop.name] = true;
              } else if (propData.type === 'array') {
                exampleValue[prop.name] = [];
              } else {
                exampleValue[prop.name] = {};
              }
            });
          } else {
            exampleValue = { property: 'value' };
          }
          break;

        case 'array':
          exampleValue = [];
          break;

        default:
          // For reference types (e.g., Person, Address)
          exampleValue = { id: 1, name: `example ${baseType}` };
          break;
      }
    }

    // Wrap in array if isArray
    if (isArray) {
      exampleValue = [exampleValue];
    }

    // Convert to JSON string and add to examples array
    const jsonString = JSON.stringify(exampleValue, null, 2);
    const currentExamples = data.examples || [];
    onChange('examples', [...currentExamples, jsonString]);
  };

  const handleAddEnum = () => {
    if (!enumInput.trim()) {
      setEnumError('Enum value cannot be empty');
      return;
    }

    const trimmedValue = enumInput.trim();

    // Validate based on data type
    if (baseType === 'number' || baseType === 'integer') {
      const numValue = Number(trimmedValue);
      if (isNaN(numValue)) {
        setEnumError(`Value must be a valid ${baseType}`);
        return;
      }
      if (baseType === 'integer' && !Number.isInteger(numValue)) {
        setEnumError('Value must be an integer (no decimals)');
        return;
      }
    }

    if (data.enum?.includes(trimmedValue)) {
      setEnumError('This value already exists');
      return;
    }

    // Clear const if it's set when adding enum values
    if (data.const) {
      onChange('const', undefined);
    }

    onChange('enum', [...(data.enum || []), trimmedValue]);
    setEnumInput('');
    setEnumError('');
  };

  const handleRemoveEnum = (value: string) => {
    onChange('enum', (data.enum || []).filter(v => v !== value));
  };

  const handleEnumKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEnum();
    }
  };

  const handleSortEnumAZ = () => {
    if (!data.enum || data.enum.length === 0) return;

    const sorted = [...data.enum].sort((a, b) => {
      // For numeric types, sort as numbers
      if (baseType === 'number' || baseType === 'integer') {
        return Number(a) - Number(b);
      }
      // For strings, sort alphabetically (case-insensitive)
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });

    onChange('enum', sorted);
  };

  const handleSortEnumZA = () => {
    if (!data.enum || data.enum.length === 0) return;

    const sorted = [...data.enum].sort((a, b) => {
      // For numeric types, sort as numbers in descending order
      if (baseType === 'number' || baseType === 'integer') {
        return Number(b) - Number(a);
      }
      // For strings, sort alphabetically in reverse (case-insensitive)
      return b.toLowerCase().localeCompare(a.toLowerCase());
    });

    onChange('enum', sorted);
  };

  const handleEnumDragEnd = (event: any) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !data.enum) {
      return;
    }

    const oldIndex = data.enum.indexOf(active.id);
    const newIndex = data.enum.indexOf(over.id);

    const newEnumArray = arrayMove(data.enum, oldIndex, newIndex);
    onChange('enum', newEnumArray);
  };

  const handleAddExample = () => {
    const trimmedValue = exampleInput.trim();
    if (!trimmedValue) {
      setExampleError('Example value cannot be empty');
      return;
    }

    // Validate JSON
    try {
      JSON.parse(trimmedValue);
    } catch (e) {
      setExampleError('Example must be valid JSON');
      return;
    }

    onChange('examples', [...(data.examples || []), trimmedValue]);
    setExampleInput('');
    setExampleError('');
  };

  const handleRemoveExample = (index: number) => {
    onChange('examples', (data.examples || []).filter((_, i) => i !== index));
  };

  const handleExampleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddExample();
    }
  };

  return (
    <div className={cn(
      'flex flex-col gap-0 min-h-full',
      isDark ? 'bg-gray-900' : 'bg-gray-50'
    )}>
      {/* ═══════════════════════════════════════════════════════════════════════════
          SECTION 1: Basic Information
          ═══════════════════════════════════════════════════════════════════════════ */}
      <div className={cn(
        'p-6 border-b border-gray-200 dark:border-gray-700',
        isDark ? 'bg-gray-800' : 'bg-white'
      )}>
        <SectionHeader
          icon={<Info className="text-indigo-600" size={18} />}
          title="Basic Information"
          subtitle="Core property details"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {showTitle && (
            <FormField
              label="Title"
              helperText="Display title"
            >
              <Input
                value={data.title || ''}
                onChange={(e) => onChange('title', e.target.value)}
                className="rounded-lg"
              />
            </FormField>
          )}

          <FormField
            label="Description"
            helperText="What this property represents"
            className={showTitle ? 'md:col-span-2' : 'md:col-span-3'}
          >
            <Textarea
              rows={2}
              value={data.description || ''}
              onChange={(e) => onChange('description', e.target.value)}
              className="rounded-lg"
            />
          </FormField>
        </div>

        {/* Default and Example in a row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
          <FormField label="Default Value" helperText="JSON default value">
            <Input
              value={data.default || ''}
              onChange={(e) => onChange('default', e.target.value)}
              className="font-mono text-sm rounded-lg"
            />
          </FormField>

          <div className={showTitle ? '' : 'md:col-span-2'}>
            <div className="flex items-center justify-between mb-2">
              <p className={cn('text-sm font-semibold', isDark ? 'text-gray-100' : 'text-gray-700')}>
                Examples
              </p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={generateExample}
                      className="p-1 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded transition-all hover:scale-110"
                    >
                      <Sparkles className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Generate example based on schema</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <FormField
              helperText={exampleError || "Enter JSON value (Shift+Enter for new line, Enter to add)"}
              error={exampleError}
            >
              <div className="relative">
                <Textarea
                  rows={2}
                  value={exampleInput}
                  onChange={(e) => {
                    setExampleInput(e.target.value);
                    setExampleError('');
                  }}
                  onKeyDown={handleExampleKeyPress}
                  placeholder="Add Example"
                  className={cn('font-mono text-sm rounded-lg pr-12', exampleError && 'border-red-500')}
                />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleAddExample}
                        disabled={!exampleInput.trim()}
                        className="absolute right-2 top-2 p-1 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Add example</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </FormField>

            {/* Examples List */}
            {data.examples && data.examples.length > 0 && (
              <div className={cn(
                'mt-4 p-4 rounded-lg border',
                isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'
              )}>
                <span className={cn('text-xs mb-2 block', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  {data.examples.length} example{data.examples.length !== 1 ? 's' : ''}
                </span>
                <div className="space-y-0">
                  {data.examples.map((example, index) => (
                    <div
                      key={index}
                      className={cn(
                        'flex items-start gap-2 py-3',
                        index < data.examples!.length - 1 && 'border-b',
                        isDark ? 'border-gray-700' : 'border-gray-200'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <pre className={cn(
                          'font-mono text-xs whitespace-pre-wrap break-words',
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          {example}
                        </pre>
                      </div>
                      <button
                        onClick={() => handleRemoveExample(index)}
                        className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════
          SECTION 2: Property Behavior (Metadata flags)
          ═══════════════════════════════════════════════════════════════════════════ */}
      {showMetadata && (
        <div className={cn(
          'p-6 border-b',
          isDark
            ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
            : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'
        )}>
          <SectionHeader
            icon={<Sliders className="text-indigo-600" size={18} />}
            title="Property Behavior"
            subtitle="Access and visibility controls"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            {/* Required */}
            <div
              className={cn(
                'p-4 rounded-2xl border transition-all duration-200 cursor-pointer hover:-translate-y-0.5',
                data.required
                  ? 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 shadow-lg shadow-red-500/20'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md'
              )}
              onClick={() => onChange('required', !data.required)}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={data.required || false}
                  onCheckedChange={(checked) => onChange('required', checked)}
                  className={cn(
                    'pointer-events-none',
                    data.required && 'data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600'
                  )}
                />
                <div>
                  <p className={cn(
                    'text-sm font-semibold',
                    data.required ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'
                  )}>
                    Required
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Must be provided
                  </p>
                </div>
              </div>
            </div>

            {/* Nullable (OpenAPI 3.1) */}
            <div
              className={cn(
                'p-4 rounded-2xl border transition-all duration-200 cursor-pointer hover:-translate-y-0.5',
                data.nullable
                  ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-800 shadow-lg shadow-purple-500/20'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md'
              )}
              onClick={() => onChange('nullable', !data.nullable)}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={data.nullable || false}
                  onCheckedChange={(checked) => onChange('nullable', checked)}
                  className={cn(
                    'pointer-events-none',
                    data.nullable && 'data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600'
                  )}
                />
                <div>
                  <p className={cn(
                    'text-sm font-semibold',
                    data.nullable ? 'text-purple-700 dark:text-purple-400' : 'text-gray-700 dark:text-gray-300'
                  )}>
                    Nullable
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Can be null
                  </p>
                </div>
              </div>
            </div>

            {/* Read Only */}
            <div
              className={cn(
                'p-4 rounded-2xl border transition-all duration-200 cursor-pointer hover:-translate-y-0.5',
                data.readOnly
                  ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 shadow-lg shadow-blue-500/20'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md'
              )}
              onClick={() => {
                onChange('readOnly', !data.readOnly);
                if (!data.readOnly) onChange('writeOnly', false);
              }}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={data.readOnly || false}
                  onCheckedChange={(checked) => {
                    onChange('readOnly', checked);
                    if (checked) onChange('writeOnly', false);
                  }}
                  className={cn(
                    'pointer-events-none',
                    data.readOnly && 'data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600'
                  )}
                />
                <div>
                  <p className={cn(
                    'text-sm font-semibold',
                    data.readOnly ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                  )}>
                    Read Only
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Output only
                  </p>
                </div>
              </div>
            </div>

            {/* Write Only */}
            <div
              className={cn(
                'p-4 rounded-2xl border transition-all duration-200 cursor-pointer hover:-translate-y-0.5',
                data.writeOnly
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 shadow-lg shadow-emerald-500/20'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md'
              )}
              onClick={() => {
                onChange('writeOnly', !data.writeOnly);
                if (!data.writeOnly) onChange('readOnly', false);
              }}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={data.writeOnly || false}
                  onCheckedChange={(checked) => {
                    onChange('writeOnly', checked);
                    if (checked) onChange('readOnly', false);
                  }}
                  className={cn(
                    'pointer-events-none',
                    data.writeOnly && 'data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600'
                  )}
                />
                <div>
                  <p className={cn(
                    'text-sm font-semibold',
                    data.writeOnly ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'
                  )}>
                    Write Only
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Input only
                  </p>
                </div>
              </div>
            </div>

            {/* Deprecated */}
            <div
              className={cn(
                'p-4 rounded-2xl border transition-all duration-200 cursor-pointer hover:-translate-y-0.5',
                data.deprecated
                  ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 shadow-lg shadow-amber-500/20'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md'
              )}
              onClick={() => onChange('deprecated', !data.deprecated)}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={data.deprecated || false}
                  onCheckedChange={(checked) => onChange('deprecated', checked)}
                  className={cn(
                    'pointer-events-none',
                    data.deprecated && 'data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600'
                  )}
                />
                <div>
                  <p className={cn(
                    'text-sm font-semibold',
                    data.deprecated ? 'text-amber-700 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'
                  )}>
                    Deprecated
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Avoid using
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Deprecation Message */}
          <Collapsible open={data.deprecated} className="mt-5">
            <CollapsibleContent className="transition-all duration-300">
              <FormField label="Deprecation Message">
                <Textarea
                  rows={2}
                  value={data.deprecationMessage || ''}
                  onChange={(e) => onChange('deprecationMessage', e.target.value)}
                  placeholder="e.g., Use newProperty instead. Will be removed in v2.0."
                  className={cn(
                    'rounded-lg border-amber-300/30',
                    isDark ? 'bg-gray-900' : 'bg-white'
                  )}
                />
              </FormField>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          SECTION 3: Type-Specific Constraints
          ═══════════════════════════════════════════════════════════════════════════ */}
      <div className={cn(
        'p-6 border-b',
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <SectionHeader
          icon={<Settings className="text-indigo-600" size={18} />}
          title="Constraints"
          subtitle="Validation rules for this property"
          badge={`${baseType}${isArray ? '[]' : ''}`}
        />

        {/* Tuple mode message */}
        {data.tupleMode && isArray && (
          <div className={cn(
            'mb-5 p-5 rounded-2xl border flex items-start gap-4',
            isDark
              ? 'bg-blue-950/30 border-blue-800/30'
              : 'bg-blue-50/60 border-blue-200'
          )}>
            <div className="p-2 rounded-xl bg-blue-600/20 flex items-center justify-center mt-0.5">
              <Sliders className="text-blue-600" size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold mb-1 text-blue-900 dark:text-blue-400">
                Tuple Mode Active
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Item-level constraints are defined per-position below. Each position can have its own type and constraints.
              </p>
            </div>
          </div>
        )}

        {/* No constraints message for boolean and null types */}
        {(baseType === 'boolean' || baseType === 'null') && (
          <div className={cn(
            'p-8 rounded-2xl border-2 border-dashed text-center',
            isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-300'
          )}>
            <p className={cn('text-sm mb-1', isDark ? 'text-gray-400' : 'text-gray-600')}>
              No additional constraints available
            </p>
            <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
              {baseType === 'boolean'
                ? 'Boolean values are either true or false'
                : 'Null type is always null'}
            </p>
          </div>
        )}

        {/* String Constraints */}
        {baseType === 'string' && !data.tupleMode && (
          <div className="p-5 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
            <p className="text-sm font-semibold mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
              String Constraints
              {isArray && <span className="text-xs text-gray-500">(per item)</span>}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              <Input label="Format"
                size={size} className="w-full"
                value={data.format || ''}
                onChange={(e) => onChange('format', e.target.value)}
                placeholder="date, email, uri, uuid..."
                helperText="Standard format hint"
                sx={{
                  bgcolor: isDark ? '#0f172a' : 'white',
                  '& .MuiOutlinedInput-root': { borderRadius: 2 },
                }}
              />

              <div className={cn("flex flex-col")}>
                <Input label="Min Length"
                  type="number"
                  size={size} className="w-full"
                  value={data.minLength || ''}
                  onChange={(e) => onChange('minLength', e.target.value)}
                  sx={{
                    bgcolor: isDark ? '#0f172a' : 'white',
                    '& .MuiOutlinedInput-root': { borderRadius: 2 },
                  }}
                />
                <Input label="Max Length"
                  type="number"
                  size={size} className="w-full"
                  value={data.maxLength || ''}
                  onChange={(e) => onChange('maxLength', e.target.value)}
                  sx={{
                    bgcolor: isDark ? '#0f172a' : 'white',
                    '& .MuiOutlinedInput-root': { borderRadius: 2 },
                  }}
                />
              </div>
            </div>

            <Input label="Pattern (Regex)"
              size={size} className="w-full"
              value={data.pattern || ''}
              onChange={(e) => onChange('pattern', e.target.value)}
              placeholder="e.g., ^[A-Z]{3}$"
              helperText="Regular expression for validation"
              sx={{
                mb: 1.5,
                bgcolor: isDark ? '#0f172a' : 'white',
                '& .MuiInputBase-input': { fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '0.875rem' },
                '& .MuiOutlinedInput-root': { borderRadius: 2 },
              }}
            />

            <RegexTester pattern={data.pattern || ''} />
          </div>
        )}

        {/* Number/Integer Constraints */}
        {(baseType === 'number' || baseType === 'integer') && !data.tupleMode && (
          <div className={cn("flex flex-col")}>
            <span className="text-sm">
              <span />
              Numeric Constraints
              {isArray && <span>(per item)</span>}
            </span>

            <div className={cn("flex flex-col")} sx_old={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2.5, mb: 2.5 }}>
              {/* Minimum */}
              <div className={cn("flex flex-col")}>
                <Input label="Minimum"
                  type="number"
                  size={size} className="w-full"
                  value={data.minimum || ''}
                  onChange={(e) => {
                    onChange('minimum', e.target.value);
                    if (e.target.value && !data.minimumType) {
                      onChange('minimumType', 'inclusive');
                    } else if (!e.target.value) {
                      onChange('minimumType', undefined);
                    }
                  }}
                  sx={{
                    mb: 1.5,
                    '& .MuiOutlinedInput-root': { borderRadius: 1.5 },
                  }}
                />
                <div className={cn("flex flex-col")}>
                  <div className="flex items-center gap-2" control={
                      <Radio
                        checked={data.minimumType === 'inclusive' || !data.minimumType}
                        onChange={() => onChange('minimumType', 'inclusive')}
                        disabled={!data.minimum}
                        sx={{ '&.Mui-checked': { color: '#6366f1' } }}
                      />
                    }
                    label={<span className="text-xs">≥ inclusive</span>}
                  />
                  <div className="flex items-center gap-2" control={
                      <Radio
                        checked={data.minimumType === 'exclusive'}
                        onChange={() => onChange('minimumType', 'exclusive')}
                        disabled={!data.minimum}
                        sx={{ '&.Mui-checked': { color: '#6366f1' } }}
                      />
                    }
                    label={<span className="text-xs">&gt; exclusive</span>}
                  />
                </div>
              </div>

              {/* Maximum */}
              <div className={cn("flex flex-col")}>
                <Input label="Maximum"
                  type="number"
                  size={size} className="w-full"
                  value={data.maximum || ''}
                  onChange={(e) => {
                    onChange('maximum', e.target.value);
                    if (e.target.value && !data.maximumType) {
                      onChange('maximumType', 'inclusive');
                    } else if (!e.target.value) {
                      onChange('maximumType', undefined);
                    }
                  }}
                  sx={{
                    mb: 1.5,
                    '& .MuiOutlinedInput-root': { borderRadius: 1.5 },
                  }}
                />
                <div className={cn("flex flex-col")}>
                  <div className="flex items-center gap-2" control={
                      <Radio
                        checked={data.maximumType === 'inclusive' || !data.maximumType}
                        onChange={() => onChange('maximumType', 'inclusive')}
                        disabled={!data.maximum}
                        sx={{ '&.Mui-checked': { color: '#6366f1' } }}
                      />
                    }
                    label={<span className="text-xs">≤ inclusive</span>}
                  />
                  <div className="flex items-center gap-2" control={
                      <Radio
                        checked={data.maximumType === 'exclusive'}
                        onChange={() => onChange('maximumType', 'exclusive')}
                        disabled={!data.maximum}
                        sx={{ '&.Mui-checked': { color: '#6366f1' } }}
                      />
                    }
                    label={<span className="text-xs">&lt; exclusive</span>}
                  />
                </div>
              </div>
            </div>

            <Input label="Multiple Of"
              type="number"
              size={size} className="w-full"
              value={data.multipleOf || ''}
              onChange={(e) => onChange('multipleOf', e.target.value)}
              helperText="Value must be divisible by this number"
              sx={{
                bgcolor: isDark ? '#0f172a' : 'white',
                '& .MuiOutlinedInput-root': { borderRadius: 2 },
              }}
            />
          </div>
        )}

        {/* Array Constraints */}
        {isArray && (
          <div className={cn("flex flex-col")}>
            <p className="text-sm">
              <span />
              Array Constraints
            </p>

            <div className={cn("flex flex-col")} sx_old={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2, mb: 2.5 }}>
              <Input label="Min Items"
                type="number"
                size={size} className="w-full"
                value={data.minItems || ''}
                onChange={(e) => onChange('minItems', e.target.value)}
                sx={{
                  bgcolor: isDark ? '#1e293b' : 'white',
                  '& .MuiOutlinedInput-root': { borderRadius: 2 },
                }}
              />
              <Input label="Max Items"
                type="number"
                size={size} className="w-full"
                value={data.maxItems || ''}
                onChange={(e) => onChange('maxItems', e.target.value)}
                sx={{
                  bgcolor: isDark ? '#1e293b' : 'white',
                  '& .MuiOutlinedInput-root': { borderRadius: 2 },
                }}
              />
              <div className={cn("flex flex-col")} sx_old={{
                display: 'flex',
                alignItems: 'center',
                p: 1.5,
                bgcolor: data.uniqueItems ? 'rgba(34, 197, 94, 0.1)' : (isDark ? '#1e293b' : 'white'),
                borderRadius: 2,
                border: '1px solid',
                borderColor: data.uniqueItems ? 'rgba(34, 197, 94, 0.4)' : (isDark ? '#475569' : '#e2e8f0'),
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: data.uniqueItems ? '0 2px 8px rgba(34, 197, 94, 0.15)' : 'none',
                '&:hover': {
                  borderColor: data.uniqueItems ? '#22c55e' : '#94a3b8',
                  transform: 'translateY(-1px)',
                },
              }}
              onClick={() => onChange('uniqueItems', !data.uniqueItems)}
              >
                <div className="flex items-center gap-2" control={
                    <Checkbox
                      checked={data.uniqueItems || false}
                      onChange={(e) => onChange('uniqueItems', e.target.checked)}
                      sx={{ '&.Mui-checked': { color: '#22c55e' } }}
                    />
                  }
                  label={<p className="text-sm">Unique Items</p>}
                />
              </div>
            </div>

            {/* Contains Schema - collapsible advanced feature */}
            <div className={cn("flex flex-col")}>
              <span className="text-xs">
                <Code className="h-4 w-4" />
                Contains Schema (OpenAPI 3.1)
              </span>
              <Input size={size} className="w-full"
                multiline
                rows={2}
                value={data.contains || ''}
                onChange={(e) => {
                  onChange('contains', e.target.value);
                  if (!e.target.value.trim()) {
                    onChange('minContains', undefined);
                    onChange('maxContains', undefined);
                  }
                }}
                placeholder='{"type": "string", "minLength": 5}'
                helperText="At least one item must match this schema"
                sx={{
                  '& .MuiInputBase-input': { fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '0.8rem' },
                  '& .MuiOutlinedInput-root': { borderRadius: 1.5 },
                }}
              />

              <Collapsible open={!!(data.contains && data.contains.trim())}><CollapsibleContent timeout={300}>
                <div className={cn("flex flex-col")}>
                  <Input label="Min Contains"
                    type="number"
                    size={size} className="w-full"
                    value={data.minContains || ''}
                    onChange={(e) => onChange('minContains', e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                  />
                  <Input label="Max Contains"
                    type="number"
                    size={size} className="w-full"
                    value={data.maxContains || ''}
                    onChange={(e) => onChange('maxContains', e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                  />
                </div>
              </CollapsibleContent></Collapsible>
            </div>

            {/* Tuple Mode - OpenAPI 3.1 prefixItems */}
            <div className={cn("flex flex-col")}>
              <div className="flex items-center gap-2" control={
                  <Checkbox
                    checked={data.tupleMode || false}
                    onChange={(e) => {
                      onChange('tupleMode', e.target.checked);
                      if (!e.target.checked) {
                        onChange('prefixItems', undefined);
                      } else if (!data.prefixItems) {
                        onChange('prefixItems', []);
                      }
                    }}
                    sx={{ '&.Mui-checked': { color: '#6366f1' } }}
                  />
                }
                label={
                  <div>
                    <p className="text-sm">
                      Tuple Mode (prefixItems)
                    </p>
                    <span className="text-xs">
                      Define ordered schemas for specific array positions
                    </span>
                  </div>
                }
              />

              <Collapsible open={data.tupleMode}><CollapsibleContent timeout={300}>
                <div className={cn("flex flex-col")}>
                  <PrefixItemsEditor
                    value={data.prefixItems || []}
                    onChange={(items) => onChange('prefixItems', items)}
                  />

                  <div className={cn("flex flex-col")}>
                    <span className="text-xs">
                      <Code className="h-4 w-4" />
                      Items Schema (beyond prefix positions)
                    </span>
                    <Input className="w-full"
                      multiline
                      rows={3}
                      size={size}
                      value={data.itemsSchema || ''}
                      onChange={(e) => onChange('itemsSchema', e.target.value)}
                      placeholder='{"type": "string"}'
                      helperText="Schema for items beyond defined positions"
                      sx={{
                        '& textarea': { fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '0.8rem' },
                        '& .MuiOutlinedInput-root': { borderRadius: 1.5 },
                      }}
                    />
                  </div>
                </div>
              </CollapsibleContent></Collapsible>
            </div>

            {/* Unevaluated Items - OpenAPI 3.1/JSON Schema 2020-12 advanced feature */}
            <div className={cn("flex flex-col")}>
              <span className="text-xs">
                <Sliders className="h-4 w-4" />
                Unevaluated Items (OpenAPI 3.1)
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="inline-flex">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Controls array items not matched by prefixItems, items, or contains. This is an advanced validation feature from JSON Schema 2020-12.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>

              <div className={cn("flex flex-col")}>
                <div className={cn("flex flex-col")}>
                  <div className="flex items-center gap-2" control={
                      <Radio
                        checked={!data.unevaluatedItems || data.unevaluatedItems === 'default'}
                        onChange={() => {
                          onChange('unevaluatedItems', 'default');
                          onChange('unevaluatedItemsSchema', undefined);
                        }}
                        sx={{ '&.Mui-checked': { color: '#6366f1' } }}
                      />
                    }
                    label={<p className="text-sm">Default (not set)</p>}
                  />
                  <div className="flex items-center gap-2" control={
                      <Radio
                        checked={data.unevaluatedItems === 'allow'}
                        onChange={() => {
                          onChange('unevaluatedItems', 'allow');
                          onChange('unevaluatedItemsSchema', undefined);
                        }}
                        sx={{ '&.Mui-checked': { color: '#22c55e' } }}
                      />
                    }
                    label={<p className="text-sm">Allow any</p>}
                  />
                  <div className="flex items-center gap-2" control={
                      <Radio
                        checked={data.unevaluatedItems === 'disallow'}
                        onChange={() => {
                          onChange('unevaluatedItems', 'disallow');
                          onChange('unevaluatedItemsSchema', undefined);
                        }}
                        sx={{ '&.Mui-checked': { color: '#ef4444' } }}
                      />
                    }
                    label={<p className="text-sm">Disallow</p>}
                  />
                  <div className="flex items-center gap-2" control={
                      <Radio
                        checked={data.unevaluatedItems === 'schema'}
                        onChange={() => onChange('unevaluatedItems', 'schema')}
                        sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                      />
                    }
                    label={<p className="text-sm">Specify schema</p>}
                  />
                </div>

                <Collapsible open={data.unevaluatedItems === 'schema'}><CollapsibleContent timeout={300}>
                  <div className={cn("flex flex-col")}>
                    <Input className="w-full"
                      multiline
                      rows={3}
                      size={size}
                      value={data.unevaluatedItemsSchema || ''}
                      onChange={(e) => onChange('unevaluatedItemsSchema', e.target.value)}
                      placeholder='{"type": "string", "maxLength": 100}'
                      helperText="Schema that unevaluated items must match"
                      sx={{
                        '& textarea': { fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '0.8rem' },
                        '& .MuiOutlinedInput-root': { borderRadius: 1.5 },
                      }}
                    />
                  </div>
                </CollapsibleContent></Collapsible>
              </div>
            </div>
          </div>
        )}

        {/* Object Constraints */}
        {baseType === 'object' && (
          <div className={cn("flex flex-col")}>
            <p className="text-sm">
              <span />
              Object Constraints
            </p>

            <div className={cn("flex flex-col")} sx_old={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5, mb: 2.5 }}>
              <Input label="Min Properties"
                type="number"
                size={size} className="w-full"
                value={data.minProperties || ''}
                onChange={(e) => onChange('minProperties', e.target.value)}
                sx={{
                  bgcolor: isDark ? '#0f172a' : 'white',
                  '& .MuiOutlinedInput-root': { borderRadius: 2 },
                }}
              />
              <Input label="Max Properties"
                type="number"
                size={size} className="w-full"
                value={data.maxProperties || ''}
                onChange={(e) => onChange('maxProperties', e.target.value)}
                sx={{
                  bgcolor: isDark ? '#0f172a' : 'white',
                  '& .MuiOutlinedInput-root': { borderRadius: 2 },
                }}
              />
            </div>

            <div className={cn("flex flex-col")}>
              <span className="text-xs">
                Additional Properties
              </span>
              <div className={cn("flex flex-col")}>
                <div className="flex items-center gap-2" control={<Radio checked={data.additionalProperties === 'default'} onChange={() => onChange('additionalProperties', 'default')} sx={{ '&.Mui-checked': { color: '#6366f1' } }} />}
                  label={<p className="text-sm">Default (allows additional)</p>}
                />
                <div className="flex items-center gap-2" control={<Radio checked={data.additionalProperties === 'true'} onChange={() => onChange('additionalProperties', 'true')} sx={{ '&.Mui-checked': { color: '#6366f1' } }} />}
                  label={<p className="text-sm">Allow additional properties</p>}
                />
                <div className="flex items-center gap-2" control={<Radio checked={data.additionalProperties === 'false'} onChange={() => onChange('additionalProperties', 'false')} sx={{ '&.Mui-checked': { color: '#6366f1' } }} />}
                  label={<p className="text-sm">Strict (no extra properties)</p>}
                />
              </div>
            </div>

            {/* Unevaluated Properties (OpenAPI 3.1 / JSON Schema 2020-12) */}
            <div className={cn("flex flex-col")}>
              <div className={cn("flex flex-col")}>
                <div className={cn("flex flex-col")}>
                  <Settings className="h-4 w-4" />
                </div>
                <div className={cn("flex flex-col")}>
                  <p className="text-sm">
                    Unevaluated Properties
                  </p>
                  <span className="text-xs">
                    Advanced control for inheritance scenarios
                  </span>
                </div>
                <span className="text-xs">
                  OpenAPI 3.1
                </span>
              </div>

              <span className="text-xs">
                Controls properties not matched by <code style={{ background: isDark ? '#1e293b' : '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>properties</code>, <code style={{ background: isDark ? '#1e293b' : '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>patternProperties</code>, or inherited schemas via <code style={{ background: isDark ? '#1e293b' : '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>allOf</code>.
              </span>

              <div className={cn("flex flex-col")}>
                <div className="flex items-center gap-2" control={<Radio checked={!data.unevaluatedProperties || data.unevaluatedProperties === 'default'} onChange={() => onChange('unevaluatedProperties', 'default')} sx={{ '&.Mui-checked': { color: '#6366f1' } }} />}
                  label={<p className="text-sm">Not specified (default)</p>}
                />
                <div className="flex items-center gap-2" control={<Radio checked={data.unevaluatedProperties === 'allow'} onChange={() => onChange('unevaluatedProperties', 'allow')} sx={{ '&.Mui-checked': { color: '#6366f1' } }} />}
                  label={<p className="text-sm">Allow unevaluated properties</p>}
                />
                <div className="flex items-center gap-2" control={<Radio checked={data.unevaluatedProperties === 'disallow'} onChange={() => onChange('unevaluatedProperties', 'disallow')} sx={{ '&.Mui-checked': { color: '#6366f1' } }} />}
                  label={<p className="text-sm">Disallow unevaluated properties</p>}
                />
                <div className="flex items-center gap-2" control={<Radio checked={data.unevaluatedProperties === 'schema'} onChange={() => onChange('unevaluatedProperties', 'schema')} sx={{ '&.Mui-checked': { color: '#6366f1' } }} />}
                  label={<p className="text-sm">Must match schema</p>}
                />
              </div>

              {data.unevaluatedProperties === 'schema' && (
                <Input label="Schema for Unevaluated Properties"
                  size={size} className="w-full"
                  multiline
                  rows={3}
                  value={data.unevaluatedPropertiesSchema ?? ''}
                  onChange={(e) => onChange('unevaluatedPropertiesSchema', e.target.value)}
                  placeholder='{ "type": "string" }'
                  helperText="JSON Schema that unevaluated properties must match"
                  sx={{
                    '& .MuiInputBase-input': { fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '0.85rem' },
                    '& .MuiOutlinedInput-root': { borderRadius: 2 },
                    '& .MuiFormHelperText-root': { fontSize: '0.7rem' },
                  }}
                />
              )}

              {data.unevaluatedProperties && data.unevaluatedProperties !== 'default' && (
                <div className={cn("flex flex-col")}>
                  <span className="text-xs">
                    <strong>Tip:</strong> Use <code style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '1px 4px', borderRadius: 3 }}>unevaluatedProperties</code> when using schema composition (<code style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '1px 4px', borderRadius: 3 }}>allOf</code>) to control properties from all composed schemas. Unlike <code style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '1px 4px', borderRadius: 3 }}>additionalProperties</code>, it considers properties from inherited schemas.
                  </span>
                </div>
              )}
            </div>

            {/* Property Name Constraints */}
            <div className={cn("flex flex-col")}>
              <div className={cn("flex flex-col")}>
                <div className={cn("flex flex-col")}>
                  <SortAsc className="h-4 w-4" />
                </div>
                <div className={cn("flex flex-col")}>
                  <p className="text-sm">
                    Property Name Constraints
                  </p>
                  <span className="text-xs">
                    Validate the names of properties, not their values
                  </span>
                </div>
                <span className="text-xs">
                  OpenAPI 3.1
                </span>
              </div>

              <span className="text-xs">
                Define constraints for property names (keys) in this object. Useful for objects with dynamic keys like dictionaries or maps.
              </span>

              <div className={cn("flex flex-col")}>
                <Input label="Min Length"
                  type="number"
                  size={size} className="w-full"
                  value={data.propertyNamesMinLength ?? ''}
                  onChange={(e) => onChange('propertyNamesMinLength', e.target.value)}
                  placeholder="e.g., 1"
                  helperText="Minimum name length"
                  sx={{
                    bgcolor: isDark ? '#1e293b' : 'white',
                    '& .MuiOutlinedInput-root': { borderRadius: 2 },
                    '& .MuiFormHelperText-root': { fontSize: '0.7rem' },
                  }}
                />
                <Input label="Max Length"
                  type="number"
                  size={size} className="w-full"
                  value={data.propertyNamesMaxLength ?? ''}
                  onChange={(e) => onChange('propertyNamesMaxLength', e.target.value)}
                  placeholder="e.g., 50"
                  helperText="Maximum name length"
                  sx={{
                    bgcolor: isDark ? '#1e293b' : 'white',
                    '& .MuiOutlinedInput-root': { borderRadius: 2 },
                    '& .MuiFormHelperText-root': { fontSize: '0.7rem' },
                  }}
                />
              </div>

              <Input label="Pattern (Regex)"
                size={size} className="w-full"
                value={data.propertyNamesPattern ?? ''}
                onChange={(e) => onChange('propertyNamesPattern', e.target.value)}
                placeholder="e.g., ^[a-z][a-zA-Z0-9]*$"
                helperText="Regular expression that all property names must match"
                sx={{
                  '& .MuiInputBase-input': { fontFamily: '"JetBrains Mono", "Fira Code", monospace' },
                  '& .MuiOutlinedInput-root': { borderRadius: 2 },
                  '& .MuiFormHelperText-root': { fontSize: '0.7rem' },
                }}
              />

              {(data.propertyNamesPattern ?? data.propertyNamesMinLength ?? data.propertyNamesMaxLength) && (
                <div className={cn("flex flex-col")}>
                  <span className="text-xs">
                    Property Name Rules:
                  </span>
                  <ul className="m-0 pl-4 space-y-1">
                    {data.propertyNamesMinLength && (
                      <li className="text-xs text-purple-700">Names must be at least <code style={{ background: 'rgba(139, 92, 246, 0.15)', padding: '1px 4px', borderRadius: 3 }}>{data.propertyNamesMinLength}</code> characters</li>
                    )}
                    {data.propertyNamesMaxLength && (
                      <li className="text-xs text-purple-700">Names must be at most <code style={{ background: 'rgba(139, 92, 246, 0.15)', padding: '1px 4px', borderRadius: 3 }}>{data.propertyNamesMaxLength}</code> characters</li>
                    )}
                    {data.propertyNamesPattern && (
                      <li className="text-xs text-purple-700">Names must match: <code style={{ background: 'rgba(139, 92, 246, 0.15)', padding: '1px 4px', borderRadius: 3 }}>/{data.propertyNamesPattern}/</code></li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* Nested Properties Display */}
            {nestedProperties && nestedProperties.length > 0 && (
              <div className={cn("flex flex-col")}>
                <div className={cn("flex flex-col")}>
                  <div className={cn("flex flex-col")}>
                    <Code className="h-4 w-4" />
                  </div>
                  <div className={cn("flex flex-col")}>
                    <p className="text-sm">
                      Nested Properties
                    </p>
                    <span className="text-xs">
                      {nestedProperties.length} propert{nestedProperties.length === 1 ? 'y' : 'ies'} defined within this object
                    </span>
                  </div>
                  <span className="text-xs">
                    Read-Only
                  </span>
                </div>

                <span className="text-xs">
                  These are the nested properties contained within this object. To edit them, close this dialog and expand the object property in the class node.
                </span>

                <div className={cn("flex flex-col")}>
                  {nestedProperties.map((prop) => {
                    const propData = typeof prop.data === 'string' ? JSON.parse(prop.data) : (prop.data || {});

                    // Handle nullable type arrays (OpenAPI 3.1 style like ['string', 'null'])
                    let baseType = propData.type;
                    let isNullable = false;
                    if (Array.isArray(propData.type)) {
                      isNullable = propData.type.includes('null');
                      baseType = propData.type.find((t: string) => t !== 'null');
                    }

                    const propType = baseType || (propData.$ref ? 'reference' : 'object');
                    const isRequired = propData.required === true;
                    const isDeprecated = propData.deprecated === true;
                    const hasRef = !!propData.$ref;
                    const refName = hasRef ? propData.$ref.split('/').pop() : null;

                    // Determine type display
                    let typeDisplay = propType;
                    if (propType === 'array') {
                      const itemType = propData.items?.type || propData.items?.$ref?.split('/').pop() || 'any';
                      typeDisplay = `${itemType}[]`;
                    } else if (hasRef && refName) {
                      typeDisplay = refName;
                    }

                    // Add nullable indicator
                    if (isNullable) {
                      typeDisplay = `${typeDisplay}?`;
                    }

                    return (
                      <div
                        key={prop.id}
                      >
                        {/* Property Name */}
                        <p className="text-sm"
                        >
                          {prop.name}
                        </p>

                        {/* Type Chip */}
                        <div className={cn("flex flex-col")}
                        >
                          {typeDisplay}
                        </div>

                        {/* Required Badge */}
                        {isRequired && (
                          <div className={cn("flex flex-col")}
                          >
                            Required
                          </div>
                        )}

                        {/* Deprecated Badge */}
                        {isDeprecated && (
                          <div className={cn("flex flex-col")}
                          >
                            Deprecated
                          </div>
                        )}

                        {/* Description (if available) */}
                        {prop.description && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button type="button" className="inline-flex">
                                  <Info className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{prop.description}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════
          SECTION 4: Values (Const & Enum)
          ═══════════════════════════════════════════════════════════════════════════ */}
      {(baseType === 'string' || baseType === 'number' || baseType === 'integer' || baseType === 'boolean') && (
        <div className={cn("flex flex-col")}>
          <SectionHeader
            icon={<Code className="h-4 w-4" />}
            title="Allowed Values"
            subtitle="Restrict to specific values"
          />

          <div className={cn("flex flex-col")} sx_old={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            {/* Constant Value */}
            <div className={cn("flex flex-col")}>
              <p className="text-sm">
                <span />
                Constant Value
              </p>
              <span className="text-xs">
                Use when property must have exactly one specific value
              </span>
              <Input label="Const"
                size={size} className="w-full"
                type={baseType === 'string' || baseType === 'boolean' ? 'text' : 'number'}
                value={data.const || ''}
                onChange={(e) => {
                  onChange('const', e.target.value);
                  if (e.target.value && data.enum && data.enum.length > 0) {
                    onChange('enum', []);
                  }
                }}
                placeholder={
                  baseType === 'boolean' ? 'true or false' :
                  baseType === 'integer' ? '42' :
                  baseType === 'number' ? '3.14' : 'value'
                }
                disabled={!!data.enum && data.enum.length > 0}
                sx={{
                  '& .MuiInputBase-input': { fontFamily: '"JetBrains Mono", "Fira Code", monospace' },
                  '& .MuiOutlinedInput-root': { borderRadius: 2 },
                }}
              />
              {data.const && (
                <div className={cn("flex flex-col")}>
                  <span className="text-xs">
                    <span>✓</span>
                    Only accepts: <code style={{ fontWeight: 600, background: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: 4 }}>{data.const}</code>
                  </span>
                </div>
              )}
            </div>

            {/* Enum Values */}
            {baseType !== 'boolean' && (
              <div className={cn("flex flex-col")}>
                <div className={cn("flex flex-col")}>
                  <div>
                    <p className="text-sm">
                      <span />
                      Enum Values
                    </p>
                    <span className="text-xs">
                      List of allowed values
                    </span>
                  </div>
                  {data.enum && data.enum.length > 1 && (
                    <div className="flex gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={handleSortEnumAZ}
                              disabled={!!data.const}
                              className="p-2 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <SortAsc className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Sort A-Z</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={handleSortEnumZA}
                              disabled={!!data.const}
                              className="p-2 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <SortAsc className="h-4 w-4 rotate-180" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Sort Z-A</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
                </div>

                {data.const && (
                  <span className="text-xs">
                    <span>⚠️</span> Disabled when const is set
                  </span>
                )}

                <div className={cn("flex flex-col")}>
                  <Input size={size} className="w-full"
                    type={baseType === 'string' ? 'text' : 'number'}
                    value={enumInput}
                    onChange={(e) => { setEnumInput(e.target.value); setEnumError(''); }}
                    onKeyDown={handleEnumKeyPress}
                    error={!!enumError}
                    helperText={enumError}
                    placeholder="Add value..."
                    disabled={!!data.const}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                  <button onClick={handleAddEnum}
                    color="primary"
                    disabled={!enumInput.trim() || !!data.const}
                    sx={{
                      bgcolor: 'rgba(99, 102, 241, 0.1)',
                      borderRadius: 2,
                      transition: 'all 0.2s',
                      '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.2)', transform: 'scale(1.05)' },
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {data.enum && data.enum.length > 0 && (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleEnumDragEnd}>
                    <div dense>
                      <SortableContext items={data.enum} strategy={verticalListSortingStrategy}>
                        {data.enum.map((value) => (
                          <SortableEnumItem key={value} id={value} value={value} onDelete={handleRemoveEnum} />
                        ))}
                      </SortableContext>
                    </div>
                  </DndContext>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          SECTION 5: Advanced (NOT Composition, External Docs, Extensions)
          ═══════════════════════════════════════════════════════════════════════════ */}
      <div className={cn("flex flex-col")}>
        <SectionHeader
          icon={<Settings className="h-4 w-4" />}
          title="Advanced"
          subtitle="Extended schema options"
        />

        <div className={cn("flex flex-col")} sx_old={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
          {/* NOT Composition */}
          <div className={cn("flex flex-col")}>
            <p className="text-sm">
              <span />
              NOT Schema
            </p>
            <span className="text-xs">
              Data must NOT match this schema (exclusion rule)
            </span>
            <Input size={size} className="w-full"
              multiline
              rows={3}
              value={data.not || ''}
              onChange={(e) => onChange('not', e.target.value)}
              placeholder='{"type": "string", "maxLength": 0}'
              sx={{
                bgcolor: isDark ? '#1e293b' : 'white',
                '& textarea': { fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '0.8rem' },
                '& .MuiOutlinedInput-root': { borderRadius: 2 },
              }}
            />
            {data.not && data.not.trim() && (
              <div className={cn("flex flex-col")}>
                <span className="text-xs">
                  <span>✗</span>
                  Values matching this schema will be rejected
                </span>
              </div>
            )}
          </div>

          {/* External Documentation */}
          {/* External Documentation */}
          <div className="p-5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-indigo-600/10">
                <ExternalLink className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="text-sm font-semibold">
                External Documentation
              </p>
            </div>

            <div className="space-y-4">
              <FormField label="URL">
                <Input
                  type="url"
                  value={data.externalDocsUrl || ''}
                  onChange={(e) => onChange('externalDocsUrl', e.target.value)}
                  placeholder="https://docs.example.com/..."
                  className="w-full"
                />
              </FormField>

              <FormField label="Description">
                <Textarea
                  rows={2}
                  value={data.externalDocsDescription || ''}
                  onChange={(e) => onChange('externalDocsDescription', e.target.value)}
                  placeholder="Brief description..."
                  className="w-full"
                />
              </FormField>
            </div>
          </div>
        </div>

        {/* Extensions */}
        <div className="mt-6">
          <ExtensionsEditor
            value={data.extensions || {}}
            onChange={(extensions) => onChange('extensions', extensions)}
            size={size}
          />
        </div>
      </div>
    </div>
  );
};

