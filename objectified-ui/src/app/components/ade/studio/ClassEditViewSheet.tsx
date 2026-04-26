'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import {
  Copy,
  Check,
  Download,
  RefreshCw,
  X,
  Braces,
  FileJson2,
  FileCode2,
  FlaskConical,
  Network,
} from 'lucide-react';
import YAML from 'yaml';
import jsf from 'json-schema-faker';
import { Button } from '../../ui/Button';
import { cn } from '../../../../../lib/utils';

/**
 * View ▾ side sheet — replaces the legacy JSON / YAML / Example tabs.
 *
 * The sheet slides in over the dialog body (rather than spawning a
 * second portalised modal) so it preserves the parent dialog's focus
 * trap and keyboard handling. It owns the schema serialization
 * pipeline that used to be inlined as `schemaContent` in
 * ClassEditDialog.
 */

const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <div className="text-slate-500 dark:text-slate-400 text-sm">
        Loading editor…
      </div>
    </div>
  ),
});

export type ClassViewFormat = 'schema-json' | 'schema-yaml' | 'example' | 'openapi';

/**
 * Loose recursive shape for a JSON Schema node. The schema data we
 * receive at runtime is genuinely dynamic, so we lean on an index
 * signature rather than `any`.
 */
type SchemaLike = Record<string, unknown>;

interface OpenApiDocLike {
  components?: { schemas?: Record<string, SchemaLike> };
  [key: string]: unknown;
}

export interface ClassEditViewSheetProps {
  open: boolean;
  onClose: () => void;
  /** Current OpenAPI fragment (full doc with components.schemas). */
  openApiDoc: OpenApiDocLike | null;
  loadingOpenApiDoc?: boolean;
  /** The class being viewed, used for filenames + class-schema lookup. */
  className: string;
  /** Initial format on first open; defaults to schema-json. */
  initialFormat?: ClassViewFormat;
  isDark?: boolean;
}

interface FormatDescriptor {
  id: ClassViewFormat;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ReactNode;
  language: 'json' | 'yaml';
  extension: 'json' | 'yaml';
}

const FORMATS: FormatDescriptor[] = [
  {
    id: 'schema-json',
    label: 'Class schema · JSON',
    shortLabel: 'Schema JSON',
    description: 'JSON Schema 2020-12 for this class only.',
    icon: <Braces className="h-3.5 w-3.5" />,
    language: 'json',
    extension: 'json',
  },
  {
    id: 'schema-yaml',
    label: 'Class schema · YAML',
    shortLabel: 'Schema YAML',
    description: 'Same schema, YAML formatting.',
    icon: <FileCode2 className="h-3.5 w-3.5" />,
    language: 'yaml',
    extension: 'yaml',
  },
  {
    id: 'example',
    label: 'Example payload',
    shortLabel: 'Example',
    description: 'Faker-generated payload from the resolved schema.',
    icon: <FlaskConical className="h-3.5 w-3.5" />,
    language: 'json',
    extension: 'json',
  },
  {
    id: 'openapi',
    label: 'OpenAPI fragment',
    shortLabel: 'OpenAPI',
    description: 'Project-wide OpenAPI 3.1 doc for this version.',
    icon: <Network className="h-3.5 w-3.5" />,
    language: 'json',
    extension: 'json',
  },
];

const isObject = (x: unknown): x is SchemaLike =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

const asSchemaArray = (x: unknown): SchemaLike[] | null =>
  Array.isArray(x) ? (x.filter(isObject) as SchemaLike[]) : null;

const asStringArray = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : [];

/**
 * Resolve $ref / allOf / anyOf / oneOf and convert prefixItems to items
 * so json-schema-faker can generate examples. Lifted from the inline
 * helper that used to live in ClassEditDialog so the sheet is
 * self-contained.
 */
const resolveRefs = (
  schema: unknown,
  schemas: Record<string, SchemaLike>,
  visited: Set<string> = new Set(),
  path: string = '',
): unknown => {
  if (!isObject(schema)) return schema;
  let s: SchemaLike = schema;

  // json-schema-faker doesn't speak prefixItems (JSON Schema 2020-12);
  // collapse it to a fixed-length tuple under `items`.
  const prefixItems = asSchemaArray(s.prefixItems);
  if (prefixItems) {
    const processed: SchemaLike = { ...s, items: prefixItems };
    delete processed.prefixItems;
    if (processed.minItems == null) processed.minItems = prefixItems.length;
    if (processed.maxItems == null) processed.maxItems = prefixItems.length;
    s = processed;
  }

  if (typeof s.$ref === 'string') {
    const refName = s.$ref.split('/').pop() || '';
    if (visited.has(refName)) {
      return { type: 'object', description: `Circular reference to ${refName}` };
    }
    const referenced = schemas[refName];
    if (referenced) {
      const newVisited = new Set(visited);
      newVisited.add(refName);
      return resolveRefs(referenced, schemas, newVisited, `${path}/${refName}`);
    }
    return s;
  }

  const allOf = asSchemaArray(s.allOf);
  if (allOf) {
    const merged: SchemaLike = {};
    const requiredSet = new Set<string>();
    allOf.forEach((sub, i) => {
      const resolved = resolveRefs(sub, schemas, visited, `${path}/allOf[${i}]`);
      if (!isObject(resolved)) return;
      const { required: subRequired, properties: subProps, ...subRest } = resolved;
      Object.assign(merged, subRest);
      if (isObject(subProps)) {
        merged.properties = {
          ...(isObject(merged.properties) ? merged.properties : {}),
          ...subProps,
        };
      }
      asStringArray(subRequired).forEach((f) => requiredSet.add(f));
    });
    const { allOf: _allOf, required: ownRequired, properties: ownProps, ...ownRest } = s;
    void _allOf;
    if (isObject(ownProps)) {
      merged.properties = {
        ...(isObject(merged.properties) ? merged.properties : {}),
        ...ownProps,
      };
    }
    asStringArray(ownRequired).forEach((f) => requiredSet.add(f));
    if (requiredSet.size > 0) merged.required = Array.from(requiredSet);
    return { ...merged, ...ownRest };
  }

  const anyOf = asSchemaArray(s.anyOf);
  if (anyOf) {
    return {
      ...s,
      anyOf: anyOf.map((sub, i) =>
        resolveRefs(sub, schemas, visited, `${path}/anyOf[${i}]`),
      ),
    };
  }
  const oneOf = asSchemaArray(s.oneOf);
  if (oneOf) {
    return {
      ...s,
      oneOf: oneOf.map((sub, i) =>
        resolveRefs(sub, schemas, visited, `${path}/oneOf[${i}]`),
      ),
    };
  }

  if (s.type === 'object' && isObject(s.properties)) {
    const props: SchemaLike = {};
    Object.entries(s.properties).forEach(([k, v]) => {
      props[k] = resolveRefs(v, schemas, visited, `${path}/properties/${k}`);
    });
    return { ...s, properties: props };
  }
  if (s.type === 'array' && s.items != null) {
    return {
      ...s,
      items: resolveRefs(s.items, schemas, visited, `${path}/items`),
    };
  }
  return s;
};

const renderContent = (
  format: ClassViewFormat,
  openApiDoc: OpenApiDocLike | null,
  className: string,
  refreshKey: number,
): { content: string; language: 'json' | 'yaml' } => {
  const fmt = FORMATS.find((f) => f.id === format)!;
  if (!openApiDoc) return { content: '// Loading schema…', language: fmt.language };

  if (format === 'openapi') {
    return {
      content: JSON.stringify(openApiDoc, null, 2),
      language: 'json',
    };
  }

  const classSchema = openApiDoc.components?.schemas?.[className];

  if (format === 'schema-json') {
    return {
      content: classSchema ? JSON.stringify(classSchema, null, 2) : '{}',
      language: 'json',
    };
  }
  if (format === 'schema-yaml') {
    return {
      content: classSchema
        ? YAML.stringify(classSchema, { lineWidth: 0, aliasDuplicateObjects: false })
        : '',
      language: 'yaml',
    };
  }
  if (format === 'example') {
    if (!classSchema) {
      return { content: '// No schema yet', language: 'json' };
    }
    try {
      const schemas = openApiDoc.components?.schemas ?? {};
      const resolved = resolveRefs(classSchema, schemas);
      jsf.option({
        random: () => {
          const seed = Math.random() * (refreshKey + 1);
          return seed - Math.floor(seed);
        },
      });
      const fake = jsf.generate(resolved as Parameters<typeof jsf.generate>[0]);
      return { content: JSON.stringify(fake, null, 2), language: 'json' };
    } catch (err) {
      return {
        content: JSON.stringify(
          {
            error: 'Could not generate example data',
            message: err instanceof Error ? err.message : String(err),
          },
          null,
          2,
        ),
        language: 'json',
      };
    }
  }
  return { content: '', language: 'json' };
};

export const ClassEditViewSheet: React.FC<ClassEditViewSheetProps> = ({
  open,
  onClose,
  openApiDoc,
  loadingOpenApiDoc,
  className,
  initialFormat = 'schema-json',
  isDark,
}) => {
  const [format, setFormat] = React.useState<ClassViewFormat>(initialFormat);
  const [exampleRefreshKey, setExampleRefreshKey] = React.useState(0);
  const [copied, setCopied] = React.useState(false);

  // Reset to the requested initial format whenever the sheet is reopened
  React.useEffect(() => {
    if (open) setFormat(initialFormat);
  }, [open, initialFormat]);

  // Esc closes the sheet without dismissing the parent dialog.
  React.useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handle, true);
    return () => window.removeEventListener('keydown', handle, true);
  }, [open, onClose]);

  const { content, language } = React.useMemo(
    () => renderContent(format, openApiDoc, className, exampleRefreshKey),
    [format, openApiDoc, className, exampleRefreshKey],
  );

  const activeFormat = FORMATS.find((f) => f.id === format)!;

  const onCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const onExport = () => {
    if (!content) return;
    const mime = activeFormat.extension === 'yaml' ? 'text/yaml' : 'application/json';
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = (className || 'class').toLowerCase();
    const suffix =
      format === 'example'
        ? 'example'
        : format === 'openapi'
          ? 'openapi'
          : 'schema';
    link.href = url;
    link.download = `${safeName}-${suffix}.${activeFormat.extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Backdrop. Click closes the sheet. */}
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          'absolute inset-0 z-30 bg-slate-900/30 backdrop-blur-[1px] transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      />
      <aside
        role="dialog"
        aria-label="View schema artifacts"
        aria-hidden={!open}
        className={cn(
          'absolute top-0 right-0 bottom-0 z-40 w-[60%] min-w-[520px] max-w-[860px] flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : 'translate-x-full pointer-events-none',
        )}
      >
        {/* Header */}
        <header className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 flex items-center gap-3 shrink-0">
          <FileJson2 className="h-4 w-4 text-indigo-500" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {activeFormat.label}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {activeFormat.description}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
            aria-label="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </Button>
        </header>

        {/* Format segmented control + actions */}
        <div className="px-5 py-2.5 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 flex-wrap shrink-0">
          <div
            role="tablist"
            aria-label="Format"
            className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800"
          >
            {FORMATS.map((f) => {
              const active = f.id === format;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFormat(f.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
                    active
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
                  )}
                >
                  {f.icon}
                  {f.shortLabel}
                </button>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {format === 'example' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setExampleRefreshKey((k) => k + 1)}
                disabled={loadingOpenApiDoc || !openApiDoc}
                className="gap-1.5"
                title="Regenerate example"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCopy}
              disabled={!content || loadingOpenApiDoc}
              className="gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onExport}
              disabled={!content || loadingOpenApiDoc}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 min-h-0">
          {open && (
            <Editor
              key={`view-${format}-${exampleRefreshKey}`}
              height="100%"
              language={language}
              value={content}
              theme={isDark ? 'vs-dark' : 'light'}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 13,
                wordWrap: 'on',
                lineNumbers: 'on',
              }}
            />
          )}
        </div>
      </aside>
    </>
  );
};
