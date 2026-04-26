'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '../../ui/Dialog';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Label } from '../../ui/Label';
import { Textarea } from '../../ui/Textarea';
import { Alert } from '../../ui/Alert';
import { Badge } from '../../ui/Badge';
import { Checkbox } from '../../ui/Checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/Select';
import { Tag as TagIcon, ExternalLink, Settings, Layers, FileText, AlertTriangle, Code, Plus, Trash2, Regex, Link, ListChecks, X, GitBranch, ArrowRight } from 'lucide-react';
import { generateClassOpenApiSpec } from '../../../utils/openapi';
import { assignTagToClass, removeTagFromClass, getTagsForClass } from '../../../../../lib/db/helper';
import { createClassWithSession, updateClassWithSession, getClassWithPropertiesAndTagsWithSession } from '../../../../../lib/api/rest-client';
import { ExtensionsEditor } from './ExtensionsEditor';
import ConditionalSchemaBuilder, {
  ConditionalRule,
  conditionalRulesToJsonSchema,
  jsonSchemaToConditionalRules
} from './ConditionalSchemaBuilder';
import { ClassEditHeader, ClassEditStatusBar, ClassEditFooter } from './ClassEditChrome';
import { ClassEditInspector, type LintIssue, type ClassReference } from './ClassEditInspector';
import { ClassEditViewSheet, type ClassViewFormat } from './ClassEditViewSheet';
import {
  ClassEditAiSidekick,
  type AiClassDefinition,
  type PatchState,
} from './ClassEditAiSidekick';
import { ClassCompositionPicker } from './ClassCompositionPicker';
import {
  FormSection,
  FormSubsection,
  FormFieldGroup,
  FormGrid,
  FormEmptyState,
  FormToggleCard,
  FormViewModeToggle,
  FormSectionNav,
  FormWizardStepper,
  FormWizardControls,
  useFormScrollSpy,
  scrollToSection,
  useFormViewMode,
} from './form';

// Custom hook for dark mode detection - prioritizes localStorage, then system preference
const useDarkMode = () => {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const initTheme = () => {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark') {
        setIsDark(true);
      } else if (savedTheme === 'light') {
        setIsDark(false);
      } else {
        // No saved preference - check class or system preference
        setIsDark(document.documentElement.classList.contains('dark') ||
          window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    };
    initTheme();
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      observer.disconnect();
    };
  }, []);
  return isDark;
};

/**
 * Canonical ordering of class-edit sections.
 * Each entry maps a stable section `id` (used by the scroll-spy, sidebar
 * nav, and changed-indicator) to its wizard step. Keep this list in sync
 * with both the render order and the `CLASS_WIZARD_STEPS` below.
 */
const CLASS_SECTION_ORDER = [
  'basics',
  'object-constraints',
  'additional-props',
  'unevaluated-props',
  'composition',
  'pattern-props',
  'dependent-schemas',
  'dependent-required',
  'conditional',
  'examples',
  'xml',
  'schema-metadata',
  'external-docs',
  'extensions',
] as const;

type ClassSectionId = typeof CLASS_SECTION_ORDER[number];

const CLASS_WIZARD_STEPS: Array<{ id: string; label: string; sections: ClassSectionId[] }> = [
  { id: 'basics', label: 'Basics', sections: ['basics'] },
  {
    id: 'validation',
    label: 'Validation',
    sections: ['object-constraints', 'additional-props', 'unevaluated-props'],
  },
  { id: 'composition', label: 'Composition', sections: ['composition'] },
  {
    id: 'dynamic',
    label: 'Dynamic Properties',
    sections: ['pattern-props', 'dependent-schemas', 'dependent-required', 'conditional'],
  },
  {
    id: 'documentation',
    label: 'Documentation',
    sections: ['examples', 'xml', 'schema-metadata', 'external-docs', 'extensions'],
  },
];

interface ClassEditDialogProps {
  open: boolean;
  onClose: () => void;
  editingClassData: any;
  nodes: any[];
  isReadOnly?: boolean;
  onSave?: () => void;
  projectId?: string;
  versionId?: string;
  projectTags?: any[];
  projectMetadata?: {
    summary?: string;
    termsOfService?: string;
    contact?: {
      name?: string;
      url?: string;
      email?: string;
    };
    license?: {
      name?: string;
      identifier?: string;
      url?: string;
    };
  };
}

const ClassEditDialog = ({ open, onClose, editingClassData, nodes, isReadOnly = false, onSave, projectId = '', versionId = '', projectTags = [], projectMetadata }: ClassEditDialogProps) => {
  const isDark = useDarkMode();

  const [viewSheetOpen, setViewSheetOpen] = useState(false);
  const [viewSheetFormat, setViewSheetFormat] = useState<ClassViewFormat>('schema-json');
  const [saving, setSaving] = useState(false);
  const [openApiDoc, setOpenApiDoc] = useState<any>(null);
  const [loadingOpenApiDoc, setLoadingOpenApiDoc] = useState(false);

  // View-mode state: `guided` shows one wizard step at a time, `advanced`
  // shows all sections with a sticky sidebar nav. Preference is persisted
  // per-user in sessionStorage so power users stay in Advanced mode.
  const [viewMode, setViewMode] = useFormViewMode(
    'ade.class-edit.view-mode',
    editingClassData ? 'advanced' : 'guided',
  );
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const advancedScrollRef = useRef<HTMLDivElement | null>(null);

  // Scroll-spy follows the user's position in Advanced mode so the sidebar
  // highlights the section currently in view. Disabled in Guided mode where
  // only one step's sections are rendered at a time.
  const { activeId: activeSectionId } = useFormScrollSpy({
    sectionIds: CLASS_SECTION_ORDER as unknown as string[],
    containerRef: advancedScrollRef,
    disabled: viewMode !== 'advanced',
    rootMarginTop: 24,
  });

  // AI Assistant — persistent sidekick panel (chat + patch suggestions)
  const [aiSidekickOpen, setAiSidekickOpen] = useState(false);
  const [aiPatchStates, setAiPatchStates] = useState<Record<number, PatchState>>({});
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStreamingContent, setAiStreamingContent] = useState('');
  const [aiSelectedModel, setAiSelectedModel] = useState('');
  const [aiModels, setAiModels] = useState<Array<{ name: string; model: string; modified_at: string; size: number }>>([]);
  const [aiLoadingModels, setAiLoadingModels] = useState(true);
  const [aiCreateError, setAiCreateError] = useState('');
  const [aiProjectProperties, setAiProjectProperties] = useState<Array<{ id: string; name: string; description?: string | null; data: any }>>([]);
  const [newDependentSchemaProperty, setNewDependentSchemaProperty] = useState('');
  const aiAbortControllerRef = useRef<AbortController | null>(null);

  // Snapshot of the last saved/hydrated formData. Used to drive the "X
  // unsaved" pill and the per-section dot indicator vs. just the
  // "non-default" indicator. We bump `snapshotTick` from the load and
  // save handlers, then a follow-up effect captures whatever formData
  // value won the latest setFormData race and stores it as the
  // snapshot.
  const [savedSnapshotJson, setSavedSnapshotJson] = useState<string>('');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [snapshotTick, setSnapshotTick] = useState(0);
  // Tick once a minute so the "Last saved Xm ago" label stays fresh.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, [open]);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    allOf: [] as string[],
    anyOf: [] as string[],
    oneOf: [] as string[],
    discriminatorProperty: '',
    discriminatorUseAuto: true,
    discriminatorMapping: {} as Record<string, string>, // Maps property value to schema name
    additionalProperties: null as boolean | null,
    additionalPropertiesType: 'default' as 'default' | 'allow' | 'disallow' | 'schema' | 'type',
    additionalPropertiesSchema: '', // Class name reference for "Must Match Schema" option
    additionalPropertiesInlineType: 'string' as 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array', // For inline type schema
    unevaluatedProperties: null as boolean | null,
    unevaluatedPropertiesType: 'default' as 'default' | 'allow' | 'disallow' | 'schema' | 'type',
    unevaluatedPropertiesSchema: '', // Class name reference for "Must Match Schema" option
    unevaluatedPropertiesInlineType: 'string' as 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array', // For inline type schema
    patternProperties: [] as Array<{ pattern: string; schemaType: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'ref'; schemaRef: string }>,
    dependentSchemas: {} as Record<string, any>, // Full dependent schemas objects (if/then/else, not just refs)
    dependentRequired: [] as Array<{ triggerProperty: string; requiredProperties: string[] }>, // When triggerProperty is present, these properties become required
    deprecated: false,
    deprecationMessage: '',
    selectedTags: [] as string[],
    extensions: {} as Record<string, any>,
    externalDocsUrl: '',
    externalDocsDescription: '',
    conditionalRules: [] as ConditionalRule[],
    // Object constraints (OpenAPI 3.1)
    minProperties: '',
    maxProperties: '',
    examples: [] as string[], // JSON Schema examples at class level
    // XML Object (OpenAPI 3.1) - class-level defaults
    xmlName: '',
    xmlNamespace: '',
    xmlPrefix: '',
    // Schema metadata (JSON Schema 2020-12)
    schemaId: '', // $id
    schemaAnchor: '', // $anchor
    schemaComment: '', // $comment
    error: ''
  });

  /**
   * Per-section "changed" indicator used by the sidebar nav dot and the
   * FormSection edge stripe. Keys map 1:1 to CLASS_SECTION_ORDER.
   */
  const changedSections = useMemo<Record<ClassSectionId, boolean>>(() => {
    const d = formData;
    const apType = d.additionalPropertiesType;
    const upType = d.unevaluatedPropertiesType;
    const apNonDefaultType = apType === 'type' && d.additionalPropertiesInlineType !== 'string';
    const upNonDefaultType = upType === 'type' && d.unevaluatedPropertiesInlineType !== 'string';
    const apChanged = apType !== 'default' || d.additionalPropertiesSchema !== '' || apNonDefaultType;
    const upChanged = upType !== 'default' || d.unevaluatedPropertiesSchema !== '' || upNonDefaultType;
    return {
      basics:
        d.description.trim() !== '' ||
        d.deprecated ||
        d.deprecationMessage.trim() !== '' ||
        d.selectedTags.length > 0,
      'object-constraints': d.minProperties.trim() !== '' || d.maxProperties.trim() !== '',
      'additional-props': apChanged,
      'unevaluated-props': upChanged,
      composition:
        d.allOf.length > 0 ||
        d.anyOf.length > 0 ||
        d.oneOf.length > 0 ||
        d.discriminatorProperty.trim() !== '' ||
        !d.discriminatorUseAuto ||
        Object.keys(d.discriminatorMapping).length > 0,
      'pattern-props': d.patternProperties.length > 0,
      'dependent-schemas': Object.keys(d.dependentSchemas).length > 0,
      'dependent-required': d.dependentRequired.length > 0,
      conditional: d.conditionalRules.length > 0,
      examples: d.examples.length > 0,
      xml: d.xmlName.trim() !== '' || d.xmlNamespace.trim() !== '' || d.xmlPrefix.trim() !== '',
      'schema-metadata':
        d.schemaId.trim() !== '' || d.schemaAnchor.trim() !== '' || d.schemaComment.trim() !== '',
      'external-docs': d.externalDocsUrl.trim() !== '' || d.externalDocsDescription.trim() !== '',
      extensions: Object.keys(d.extensions).length > 0,
    };
  }, [formData]);

  /**
   * Count of distinct top-level fields the user has touched since the
   * last load/save. Excludes the local `error` flag so transient validation
   * messages don't bump the counter.
   */
  const unsavedKeys = useMemo<string[]>(() => {
    if (!savedSnapshotJson) return [];
    let saved: Record<string, unknown>;
    try {
      saved = JSON.parse(savedSnapshotJson) as Record<string, unknown>;
    } catch {
      return [];
    }
    const keys = Object.keys(formData) as Array<keyof typeof formData>;
    const out: string[] = [];
    for (const k of keys) {
      if (k === 'error') continue;
      const a = formData[k];
      const b = saved[k as string];
      if (JSON.stringify(a) !== JSON.stringify(b)) out.push(String(k));
    }
    return out;
  }, [formData, savedSnapshotJson]);
  const unsavedCount = unsavedKeys.length;

  /**
   * Header progress ring. A class is considered "filled" when its name
   * is set (required) and a healthy spread of optional sections have
   * been touched. We weight name strongly so empty new-class dialogs
   * read as low completeness even after one or two sections are filled.
   */
  const completenessPercent = useMemo(() => {
    const totalSections = CLASS_SECTION_ORDER.length;
    const filledSections = (Object.keys(changedSections) as ClassSectionId[])
      .filter((id) => changedSections[id]).length;
    const nameWeight = formData.name.trim() ? 1 : 0;
    // 30% from name presence, 70% from filled sections coverage.
    return Math.round(nameWeight * 30 + (filledSections / totalSections) * 70);
  }, [formData.name, changedSections]);

  /**
   * Lightweight lint pass for Phase 1. Real validation (schema cycles,
   * dangling $ref, regex sanity, etc.) is added in a later phase. Each
   * issue carries an optional `sectionId` so the inspector can scroll
   * the form into view.
   */
  const lintIssues = useMemo<LintIssue[]>(() => {
    const issues: LintIssue[] = [];
    if (!formData.name.trim()) {
      issues.push({
        id: 'missing-name',
        severity: 'error',
        message: 'Class name is required',
        detail: 'Use PascalCase, letters and digits only (e.g. UserAccount).',
        sectionId: 'basics',
      });
    }
    if (
      formData.deprecated &&
      !formData.deprecationMessage.trim()
    ) {
      issues.push({
        id: 'deprecation-empty',
        severity: 'warn',
        message: 'Deprecated class has no replacement note',
        detail: 'Tell consumers what to migrate to.',
        sectionId: 'basics',
      });
    }
    if (formData.examples.length === 0) {
      issues.push({
        id: 'missing-examples',
        severity: 'warn',
        message: 'No examples provided',
        detail: 'Examples improve generated docs and let consumers preview real-looking payloads.',
        sectionId: 'examples',
      });
    }
    if (
      formData.minProperties.trim() &&
      formData.maxProperties.trim() &&
      Number(formData.minProperties) > Number(formData.maxProperties)
    ) {
      issues.push({
        id: 'min-greater-than-max',
        severity: 'error',
        message: 'minProperties is greater than maxProperties',
        detail: 'Adjust the bounds in Object Constraints so min ≤ max.',
        sectionId: 'object-constraints',
      });
    }
    return issues;
  }, [formData.name, formData.deprecated, formData.deprecationMessage, formData.examples, formData.minProperties, formData.maxProperties]);

  const errorCount = lintIssues.filter((i) => i.severity === 'error').length;
  const warnCount = lintIssues.filter((i) => i.severity === 'warn').length;

  /**
   * Sections that contain a lint error / warning, used to colour the
   * dots in the section nav.
   */
  const sectionLintMap = useMemo(() => {
    const map: Record<string, { error?: boolean; warn?: boolean }> = {};
    for (const issue of lintIssues) {
      if (!issue.sectionId) continue;
      const slot = (map[issue.sectionId] ||= {});
      if (issue.severity === 'error') slot.error = true;
      else if (issue.severity === 'warn') slot.warn = true;
    }
    return map;
  }, [lintIssues]);

  /**
   * Four-state per-section status used by the dot-state nav and the
   * collapsed-stub headers. Lint errors win over warnings, which win
   * over the "filled" indicator from `changedSections`.
   */
  type SectionStatus = 'empty' | 'filled' | 'warn' | 'error';
  const sectionStatus = useMemo<Record<ClassSectionId, SectionStatus>>(() => {
    const out: Partial<Record<ClassSectionId, SectionStatus>> = {};
    for (const id of CLASS_SECTION_ORDER) {
      const lint = sectionLintMap[id];
      if (lint?.error) out[id] = 'error';
      else if (lint?.warn) out[id] = 'warn';
      else if (changedSections[id]) out[id] = 'filled';
      else out[id] = 'empty';
    }
    return out as Record<ClassSectionId, SectionStatus>;
  }, [changedSections, sectionLintMap]);

  /**
   * Sections the user has explicitly opened in Advanced view. Empty
   * optional sections start collapsed; touching the section (via the
   * sidebar nav or a programmatic scroll) auto-expands it. Required
   * sections (basics) are always expanded regardless of this set.
   */
  const ALWAYS_EXPANDED: ReadonlySet<ClassSectionId> = useMemo(
    () => new Set<ClassSectionId>(['basics']),
    [],
  );
  const [expandedSections, setExpandedSections] = useState<Set<ClassSectionId>>(
    () => new Set<ClassSectionId>(),
  );

  /**
   * A section is expanded if (a) it's always expanded, (b) the user
   * has explicitly expanded it, or (c) it has non-default values or
   * lint signal — keeping live data visible.
   */
  const isSectionExpanded = useCallback(
    (id: ClassSectionId): boolean => {
      if (ALWAYS_EXPANDED.has(id)) return true;
      if (expandedSections.has(id)) return true;
      const status = sectionStatus[id];
      return status !== 'empty';
    },
    [ALWAYS_EXPANDED, expandedSections, sectionStatus],
  );

  const setSectionExpanded = useCallback((id: ClassSectionId, next: boolean) => {
    setExpandedSections((prev) => {
      const out = new Set(prev);
      if (next) out.add(id);
      else out.delete(id);
      return out;
    });
  }, []);

  /**
   * Reset the per-section expand overrides whenever the dialog reopens
   * with a new class so we get a clean default each time.
   */
  useEffect(() => {
    if (open) setExpandedSections(new Set<ClassSectionId>());
  }, [open]);

  /**
   * Reference summary for the "Used by" inspector card. We look at
   * `nodes` for any class whose schema mentions our class name in
   * composition (allOf/anyOf/oneOf) or via $ref. This is intentionally
   * approximate — a full graph traversal lives in the canvas.
   */
  const inspectorReferences = useMemo<ClassReference[]>(() => {
    const myName = (editingClassData?.name as string | undefined) ?? formData.name;
    if (!myName || !Array.isArray(nodes)) return [{ kind: 'classes', count: 0 }];
    let classCount = 0;
    const haystackNeedle = `"$ref":"#/components/schemas/${myName}"`;
    for (const node of nodes) {
      const data = node?.data;
      if (!data || data.name === myName) continue;
      const schemaJson = JSON.stringify(data.schema ?? {});
      if (schemaJson.includes(haystackNeedle)) {
        classCount += 1;
        continue;
      }
      const composition = [
        ...(data.allOf ?? []),
        ...(data.anyOf ?? []),
        ...(data.oneOf ?? []),
      ];
      if (composition.includes(myName)) classCount += 1;
    }
    return [{ kind: classCount === 1 ? 'class' : 'classes', count: classCount }];
  }, [nodes, editingClassData?.name, formData.name]);

  /** Human-friendly relative timestamp for "Last saved Xm ago". */
  const lastSavedLabel = useMemo<string | undefined>(() => {
    if (!lastSavedAt) return undefined;
    const diffMs = Date.now() - lastSavedAt;
    const min = Math.floor(diffMs / 60_000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
    // re-evaluates as `setNowTick` ticks every minute via the effect above
  }, [lastSavedAt]);

  // Reset view and form when dialog opens
  useEffect(() => {
    if (open) {
      setViewSheetOpen(false);
      setViewSheetFormat('schema-json');
      setAiSidekickOpen(false);
      setAiMessages([]);
      setAiInput('');
      setAiCreateError('');
      setAiPatchStates({});
      setNewDependentSchemaProperty('');
      setCurrentStepIndex(0);
      // Mirrors `editingClassData?.updated_at` when present; falls back
      // to `created_at` so newly hydrated classes still show "saved Xm
      // ago" instead of looking unsaved.
      setLastSavedAt(
        editingClassData
          ? Date.parse(
              editingClassData.updated_at ||
                editingClassData.updatedAt ||
                editingClassData.created_at ||
                editingClassData.createdAt ||
                ''
            ) || null
          : null,
      );

      if (editingClassData) {
        // Edit mode - populate form with existing class data
        const schema = typeof editingClassData.schema === 'string'
          ? JSON.parse(editingClassData.schema)
          : editingClassData.schema || {};

        const allOf = schema.allOf?.map((item: any) => item.$ref?.split('/').pop()).filter(Boolean) || [];
        const anyOf = schema.anyOf?.map((item: any) => item.$ref?.split('/').pop()).filter(Boolean) || [];
        const oneOf = schema.oneOf?.map((item: any) => item.$ref?.split('/').pop()).filter(Boolean) || [];

        // Extract discriminator mapping if present
        const discriminatorMapping: Record<string, string> = {};
        if (schema.discriminator?.mapping) {
          Object.entries(schema.discriminator.mapping).forEach(([key, value]) => {
            // Extract schema name from reference (e.g., "#/components/schemas/Dog" -> "Dog")
            const schemaName = typeof value === 'string' ? value.split('/').pop() || '' : '';
            if (schemaName) {
              discriminatorMapping[key] = schemaName;
            }
          });
        }

        // Extract extensions (x- prefixed properties)
        const extensions: Record<string, any> = {};
        Object.keys(schema).forEach(key => {
          if (key.startsWith('x-')) {
            extensions[key] = schema[key];
          }
        });

        // Extract conditional rules (if/then/else) from schema
        let conditionalRules: ConditionalRule[] = [];
        // Check for if/then/else in allOf array
        if (schema.allOf && Array.isArray(schema.allOf)) {
          conditionalRules = jsonSchemaToConditionalRules(schema.allOf);
        }
        // Also check for top-level if/then/else
        if (schema.if) {
          const topLevelRules = jsonSchemaToConditionalRules([{
            if: schema.if,
            then: schema.then,
            else: schema.else
          }]);
          conditionalRules.push(...topLevelRules);
        }

        // Load tags for this class
        const loadTags = async () => {
          try {
            const result = await getTagsForClass(editingClassData.id);
            const classTags = JSON.parse(result);
            const tagIds = classTags.map((ct: any) => ct.tag_id);

            // Determine additionalProperties type and schema
            let additionalPropsType: 'default' | 'allow' | 'disallow' | 'schema' | 'type' = 'default';
            let additionalPropsSchema = '';
            let additionalPropsInlineType: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' = 'string';
            if (schema.additionalProperties !== undefined) {
              if (schema.additionalProperties === true) {
                additionalPropsType = 'allow';
              } else if (schema.additionalProperties === false) {
                additionalPropsType = 'disallow';
              } else if (typeof schema.additionalProperties === 'object' && schema.additionalProperties.$ref) {
                additionalPropsType = 'schema';
                additionalPropsSchema = schema.additionalProperties.$ref.split('/').pop() || '';
              } else if (typeof schema.additionalProperties === 'object' && schema.additionalProperties.type) {
                // Inline type schema like { type: 'string' }
                additionalPropsType = 'type';
                additionalPropsInlineType = schema.additionalProperties.type;
              } else if (typeof schema.additionalProperties === 'object') {
                // Other inline schema - default to 'type' with string
                additionalPropsType = 'type';
              }
            }

            // Determine unevaluatedProperties type and schema
            let unevaluatedPropsType: 'default' | 'allow' | 'disallow' | 'schema' | 'type' = 'default';
            let unevaluatedPropsSchema = '';
            let unevaluatedPropsInlineType: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' = 'string';
            if (schema.unevaluatedProperties !== undefined) {
              if (schema.unevaluatedProperties === true) {
                unevaluatedPropsType = 'allow';
              } else if (schema.unevaluatedProperties === false) {
                unevaluatedPropsType = 'disallow';
              } else if (typeof schema.unevaluatedProperties === 'object' && schema.unevaluatedProperties.$ref) {
                unevaluatedPropsType = 'schema';
                unevaluatedPropsSchema = schema.unevaluatedProperties.$ref.split('/').pop() || '';
              } else if (typeof schema.unevaluatedProperties === 'object' && schema.unevaluatedProperties.type) {
                // Inline type schema like { type: 'string' }
                unevaluatedPropsType = 'type';
                unevaluatedPropsInlineType = schema.unevaluatedProperties.type;
              } else if (typeof schema.unevaluatedProperties === 'object') {
                // Other inline schema - default to 'type' with string
                unevaluatedPropsType = 'type';
              }
            }

            // Extract patternProperties
            const patternPropsArray: Array<{ pattern: string; schemaType: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'ref'; schemaRef: string }> = [];
            if (schema.patternProperties && typeof schema.patternProperties === 'object') {
              Object.entries(schema.patternProperties).forEach(([pattern, schemaValue]: [string, any]) => {
                if (schemaValue.$ref) {
                  patternPropsArray.push({ pattern, schemaType: 'ref', schemaRef: schemaValue.$ref.split('/').pop() || '' });
                } else if (schemaValue.type) {
                  patternPropsArray.push({ pattern, schemaType: schemaValue.type, schemaRef: '' });
                } else {
                  patternPropsArray.push({ pattern, schemaType: 'string', schemaRef: '' });
                }
              });
            }

            // Extract dependentSchemas - preserve full objects (if/then/else, not just refs)
            const dependentSchemasObj: Record<string, any> = {};
            if (schema.dependentSchemas && typeof schema.dependentSchemas === 'object') {
              Object.entries(schema.dependentSchemas).forEach(([key, value]) => {
                dependentSchemasObj[key] = value;
              });
            }

            // Extract dependentRequired
            const dependentRequiredArray: Array<{ triggerProperty: string; requiredProperties: string[] }> = [];
            if (schema.dependentRequired && typeof schema.dependentRequired === 'object') {
              Object.entries(schema.dependentRequired).forEach(([triggerProperty, requiredProps]: [string, any]) => {
                if (Array.isArray(requiredProps)) {
                  dependentRequiredArray.push({ triggerProperty, requiredProperties: requiredProps });
                }
              });
            }

            setFormData({
              name: editingClassData.name || '',
              description: editingClassData.description || '',
              allOf,
              anyOf,
              oneOf,
              discriminatorProperty: schema.discriminator?.propertyName || '',
              discriminatorUseAuto: !schema.discriminator?.mapping,
              discriminatorMapping,
              additionalProperties: schema.additionalProperties !== undefined ? schema.additionalProperties : null,
              additionalPropertiesType: additionalPropsType,
              additionalPropertiesSchema: additionalPropsSchema,
              additionalPropertiesInlineType: additionalPropsInlineType,
              unevaluatedProperties: schema.unevaluatedProperties !== undefined ? schema.unevaluatedProperties : null,
              unevaluatedPropertiesType: unevaluatedPropsType,
              unevaluatedPropertiesSchema: unevaluatedPropsSchema,
              unevaluatedPropertiesInlineType: unevaluatedPropsInlineType,
              patternProperties: patternPropsArray,
              dependentSchemas: dependentSchemasObj,
              dependentRequired: dependentRequiredArray,
              deprecated: schema.deprecated || false,
              deprecationMessage: schema.deprecationMessage || '',
              selectedTags: tagIds,
              extensions,
              externalDocsUrl: schema.externalDocs?.url || '',
              externalDocsDescription: schema.externalDocs?.description || '',
              conditionalRules,
              // Object constraints
              minProperties: schema.minProperties?.toString() || '',
              maxProperties: schema.maxProperties?.toString() || '',
              examples: schema.examples ? schema.examples.map((ex: any) => JSON.stringify(ex)) : [],
              // XML Object
              xmlName: schema.xml?.name || '',
              xmlNamespace: schema.xml?.namespace || '',
              xmlPrefix: schema.xml?.prefix || '',
              // Schema metadata
              schemaId: schema.$id || '',
              schemaAnchor: schema.$anchor || '',
              schemaComment: schema.$comment || '',
              error: ''
            });
            setSnapshotTick((t) => t + 1);
          } catch (error) {
            console.error('Error loading tags:', error);
            // Determine additionalProperties type and schema for error case
            let additionalPropsType: 'default' | 'allow' | 'disallow' | 'schema' | 'type' = 'default';
            let additionalPropsSchema = '';
            let additionalPropsInlineType: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' = 'string';
            if (schema.additionalProperties !== undefined) {
              if (schema.additionalProperties === true) {
                additionalPropsType = 'allow';
              } else if (schema.additionalProperties === false) {
                additionalPropsType = 'disallow';
              } else if (typeof schema.additionalProperties === 'object' && schema.additionalProperties.$ref) {
                additionalPropsType = 'schema';
                additionalPropsSchema = schema.additionalProperties.$ref.split('/').pop() || '';
              } else if (typeof schema.additionalProperties === 'object' && schema.additionalProperties.type) {
                additionalPropsType = 'type';
                additionalPropsInlineType = schema.additionalProperties.type;
              } else if (typeof schema.additionalProperties === 'object') {
                additionalPropsType = 'type';
              }
            }
            // Determine unevaluatedProperties type and schema for error case
            let unevaluatedPropsType: 'default' | 'allow' | 'disallow' | 'schema' | 'type' = 'default';
            let unevaluatedPropsSchema = '';
            let unevaluatedPropsInlineType: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' = 'string';
            if (schema.unevaluatedProperties !== undefined) {
              if (schema.unevaluatedProperties === true) {
                unevaluatedPropsType = 'allow';
              } else if (schema.unevaluatedProperties === false) {
                unevaluatedPropsType = 'disallow';
              } else if (typeof schema.unevaluatedProperties === 'object' && schema.unevaluatedProperties.$ref) {
                unevaluatedPropsType = 'schema';
                unevaluatedPropsSchema = schema.unevaluatedProperties.$ref.split('/').pop() || '';
              } else if (typeof schema.unevaluatedProperties === 'object' && schema.unevaluatedProperties.type) {
                unevaluatedPropsType = 'type';
                unevaluatedPropsInlineType = schema.unevaluatedProperties.type;
              } else if (typeof schema.unevaluatedProperties === 'object') {
                unevaluatedPropsType = 'type';
              }
            }
            // Extract patternProperties for error case
            const patternPropsArrayError: Array<{ pattern: string; schemaType: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'ref'; schemaRef: string }> = [];
            if (schema.patternProperties && typeof schema.patternProperties === 'object') {
              Object.entries(schema.patternProperties).forEach(([pattern, schemaValue]: [string, any]) => {
                if (schemaValue.$ref) {
                  patternPropsArrayError.push({ pattern, schemaType: 'ref', schemaRef: schemaValue.$ref.split('/').pop() || '' });
                } else if (schemaValue.type) {
                  patternPropsArrayError.push({ pattern, schemaType: schemaValue.type, schemaRef: '' });
                } else {
                  patternPropsArrayError.push({ pattern, schemaType: 'string', schemaRef: '' });
                }
              });
            }
            // Extract dependentSchemas for error case - preserve full objects
            const dependentSchemasObjError: Record<string, any> = {};
            if (schema.dependentSchemas && typeof schema.dependentSchemas === 'object') {
              Object.entries(schema.dependentSchemas).forEach(([key, value]) => {
                dependentSchemasObjError[key] = value;
              });
            }
            // Extract dependentRequired for error case
            const dependentRequiredArrayError: Array<{ triggerProperty: string; requiredProperties: string[] }> = [];
            if (schema.dependentRequired && typeof schema.dependentRequired === 'object') {
              Object.entries(schema.dependentRequired).forEach(([triggerProperty, requiredProps]: [string, any]) => {
                if (Array.isArray(requiredProps)) {
                  dependentRequiredArrayError.push({ triggerProperty, requiredProperties: requiredProps });
                }
              });
            }
            setFormData({
              name: editingClassData.name || '',
              description: editingClassData.description || '',
              allOf,
              anyOf,
              oneOf,
              discriminatorProperty: schema.discriminator?.propertyName || '',
              discriminatorUseAuto: !schema.discriminator?.mapping,
              discriminatorMapping,
              additionalProperties: schema.additionalProperties !== undefined ? schema.additionalProperties : null,
              additionalPropertiesType: additionalPropsType,
              additionalPropertiesSchema: additionalPropsSchema,
              additionalPropertiesInlineType: additionalPropsInlineType,
              unevaluatedProperties: schema.unevaluatedProperties !== undefined ? schema.unevaluatedProperties : null,
              unevaluatedPropertiesType: unevaluatedPropsType,
              unevaluatedPropertiesSchema: unevaluatedPropsSchema,
              unevaluatedPropertiesInlineType: unevaluatedPropsInlineType,
              patternProperties: patternPropsArrayError,
              dependentSchemas: dependentSchemasObjError,
              dependentRequired: dependentRequiredArrayError,
              deprecated: schema.deprecated || false,
              deprecationMessage: schema.deprecationMessage || '',
              selectedTags: [],
              extensions,
              externalDocsUrl: schema.externalDocs?.url || '',
              externalDocsDescription: schema.externalDocs?.description || '',
              conditionalRules,
              // Object constraints
              minProperties: schema.minProperties?.toString() || '',
              maxProperties: schema.maxProperties?.toString() || '',
              examples: schema.examples ? schema.examples.map((ex: any) => JSON.stringify(ex)) : [],
              // XML Object
              xmlName: schema.xml?.name || '',
              xmlNamespace: schema.xml?.namespace || '',
              xmlPrefix: schema.xml?.prefix || '',
              // Schema metadata
              schemaId: schema.$id || '',
              schemaAnchor: schema.$anchor || '',
              schemaComment: schema.$comment || '',
              error: ''
            });
            setSnapshotTick((t) => t + 1);
          }
        };

        loadTags();
      } else {
        // Add mode - reset form to empty state
        setFormData({
          name: '',
          description: '',
          allOf: [],
          anyOf: [],
          oneOf: [],
          discriminatorProperty: '',
          discriminatorUseAuto: true,
          discriminatorMapping: {},
          additionalProperties: null,
          additionalPropertiesType: 'default',
          additionalPropertiesSchema: '',
          additionalPropertiesInlineType: 'string',
          unevaluatedProperties: null,
          unevaluatedPropertiesType: 'default',
          unevaluatedPropertiesSchema: '',
          unevaluatedPropertiesInlineType: 'string',
          patternProperties: [],
          dependentSchemas: {},
          dependentRequired: [],
          deprecated: false,
          deprecationMessage: '',
          selectedTags: [],
          extensions: {},
          externalDocsUrl: '',
          externalDocsDescription: '',
          conditionalRules: [],
          // Object constraints
          minProperties: '',
          maxProperties: '',
          examples: [],
          // XML Object
          xmlName: '',
          xmlNamespace: '',
          xmlPrefix: '',
          // Schema metadata
          schemaId: '',
          schemaAnchor: '',
          schemaComment: '',
          error: ''
        });
        setSnapshotTick((t) => t + 1);
      }
    }
  }, [open, editingClassData]);

  // Load Ollama models and project properties the first time the
  // sidekick is opened in this session.
  useEffect(() => {
    if (open && aiSidekickOpen) {
      let cancelled = false;
      (async () => {
        setAiLoadingModels(true);
        try {
          const [modelsRes, propsRes] = await Promise.all([
            fetch('/api/ollama/models'),
            projectId ? fetch(`/api/properties/${projectId}`) : Promise.resolve(null),
          ]);
          if (cancelled) return;
          const modelsData = await modelsRes.json();
          if (modelsData.success && modelsData.models?.length) {
            setAiModels(modelsData.models);
            if (!aiSelectedModel) setAiSelectedModel(modelsData.models[0].name);
          }
          if (propsRes?.ok) {
            const propsData = await propsRes.json();
            if (propsData.success && Array.isArray(propsData.properties)) {
              setAiProjectProperties(propsData.properties);
            }
          }
        } catch (e) {
          console.error('Failed to load Ollama models or properties', e);
        } finally {
          if (!cancelled) setAiLoadingModels(false);
        }
      })();
      return () => { cancelled = true; };
    }
  }, [open, aiSidekickOpen, projectId]);

  // Capture the saved snapshot of formData. Bumped from the open effect
  // and after a successful save; runs on the next render so it picks up
  // whichever setFormData call won the race (sync add-mode reset or
  // async edit-mode hydration).
  useEffect(() => {
    if (snapshotTick === 0) return;
    setSavedSnapshotJson(JSON.stringify(formData));
  }, [snapshotTick, formData]);

  // Extract class definition JSON from assistant message (```json ... ```)
  const extractClassDefinition = (content: string): { name: string; description: string | null; schema: any } | null => {
    const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```/;
    const match = content.match(jsonBlockRegex);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[1].trim());
      if (!parsed || typeof parsed.name !== 'string' || !parsed.schema) return null;
      const name = parsed.name.replace(/[^A-Za-z0-9_]/g, '') || null;
      if (!name) return null;
      return {
        name,
        description: typeof parsed.description === 'string' ? parsed.description : null,
        schema: parsed.schema,
      };
    } catch {
      return null;
    }
  };

  const handleAiSendMessage = async () => {
    if (!aiInput.trim() || !aiSelectedModel || aiLoading) return;
    const userMessage = { role: 'user' as const, content: aiInput.trim() };
    setAiMessages(prev => [...prev, userMessage]);
    setAiInput('');
    setAiLoading(true);
    setAiStreamingContent('');
    setAiCreateError('');
    aiAbortControllerRef.current = new AbortController();
    try {
      const existingClassNames = nodes.map((n: any) => n.data?.name).filter(Boolean);
      const existingProperties = aiProjectProperties.map((p) => ({
        name: p.name,
        description: p.description ?? null,
        data: p.data,
      }));

      const response = await fetch('/api/ollama/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: aiSelectedModel,
          messages: [...aiMessages, userMessage],
          task: 'class_skeleton',
          existingClassNames,
          existingProperties,
        }),
        signal: aiAbortControllerRef.current.signal,
      });
      if (!response.ok) throw new Error('Failed to get response from LLM');
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let messageAdded = false;
      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) continue;
            const data = line.slice(6);
            if (data === '[DONE]') {
              setAiMessages(prev => [...prev, { role: 'assistant', content: accumulated }]);
              setAiStreamingContent('');
              messageAdded = true;
              break;
            }
            try {
              const event = JSON.parse(data);
              if (event.content) {
                accumulated += event.content;
                setAiStreamingContent(accumulated);
              }
            } catch (_) {}
          }
        }
        if (accumulated && !messageAdded && !aiAbortControllerRef.current?.signal.aborted) {
          setAiMessages(prev => [...prev, { role: 'assistant', content: accumulated }]);
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('AI chat error', err);
        setAiMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
      }
    } finally {
      setAiLoading(false);
      setAiStreamingContent('');
      aiAbortControllerRef.current = null;
    }
  };

  const handleAiCreateClass = async (content: string, messageIndex?: number) => {
    const def = extractClassDefinition(content);
    if (!def || !versionId) {
      setAiCreateError(def ? 'No version selected.' : 'No valid class definition in this message.');
      return;
    }
    if (!/^[A-Za-z0-9_]+$/.test(def.name)) {
      setAiCreateError('Class name can only contain letters, numbers, and underscores.');
      return;
    }
    setAiCreateError('');
    const schema = { ...def.schema };
    if (schema.type !== 'object') schema.type = 'object';
    if (typeof schema.properties !== 'object') schema.properties = {};
    try {
      const response = await createClassWithSession(versionId, def.name, def.description, schema);
      if (!response.success || !response.class) {
        setAiCreateError(response.error || 'Failed to create class');
        return;
      }
      const classId = response.class.id as string;
      const props = schema.properties as Record<string, any>;
      const propNames = Object.keys(props || {});
      for (const propName of propNames) {
        const propSchema = props[propName];
        if (!propSchema || typeof propSchema !== 'object') continue;
        const description = typeof propSchema.description === 'string' ? propSchema.description : null;
        const hasRef = !!(propSchema.$ref || (propSchema.type === 'array' && propSchema.items?.$ref));
        let propertyId: string | null = null;
        if (!hasRef && projectId) {
          const existing = aiProjectProperties.find((p) => p.name === propName);
          if (existing) {
            propertyId = existing.id;
          } else {
            const createRes = await fetch(`/api/properties/${projectId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: propName, description, data: propSchema }),
            });
            const createData = await createRes.json();
            if (createData.success && createData.property?.id) {
              propertyId = createData.property.id;
            } else {
              console.warn(`Could not create library property "${propName}": ${createData.error}`);
              continue;
            }
          }
        }
        if (!hasRef && !propertyId) continue;
        const addRes = await fetch(`/api/classes/${classId}/properties`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            property_id: propertyId,
            name: propName,
            description,
            data: propSchema,
          }),
        });
        const addData = await addRes.json();
        if (!addData.success) {
          console.warn(`Could not add property "${propName}" to class: ${addData.error}`);
        }
      }
      if (messageIndex != null) {
        setAiPatchStates((prev) => ({ ...prev, [messageIndex]: 'created' }));
      }
      onSave?.();
      onClose();
    } catch (e: any) {
      setAiCreateError(e?.message || 'Failed to create class');
    }
  };

  /**
   * Apply an AI-suggested class definition to the in-memory form. We
   * deliberately keep this conservative: name, description, composition
   * refs ($ref under allOf/anyOf/oneOf), and the discriminator property
   * name. Property creation requires API round-trips and stays in the
   * "Create class" flow. Anything not patched is still visible in the
   * raw JSON inside the message bubble.
   */
  const handleAiApplyToForm = (def: AiClassDefinition, messageIndex: number) => {
    setAiCreateError('');
    if (def.name && !/^[A-Za-z0-9_]*$/.test(def.name)) {
      setAiCreateError('Class name can only contain letters, numbers, and underscores.');
      return;
    }
    const schema = (def.schema ?? {}) as Record<string, unknown>;
    const refToName = (item: unknown): string | null => {
      if (!item || typeof item !== 'object') return null;
      const ref = (item as { $ref?: unknown }).$ref;
      if (typeof ref !== 'string') return null;
      const tail = ref.split('/').pop();
      return tail || null;
    };
    const collectRefs = (key: 'allOf' | 'anyOf' | 'oneOf'): string[] => {
      const v = schema[key];
      if (!Array.isArray(v)) return [];
      return v.map(refToName).filter((s): s is string => !!s);
    };
    const allOfNames = collectRefs('allOf');
    const anyOfNames = collectRefs('anyOf');
    const oneOfNames = collectRefs('oneOf');
    const discriminator = schema.discriminator as { propertyName?: unknown } | undefined;
    const discriminatorProperty =
      typeof discriminator?.propertyName === 'string' ? discriminator.propertyName : '';

    setFormData((prev) => ({
      ...prev,
      name: def.name || prev.name,
      description: typeof def.description === 'string' ? def.description : prev.description,
      allOf: allOfNames.length > 0 ? allOfNames : prev.allOf,
      anyOf: anyOfNames.length > 0 ? anyOfNames : prev.anyOf,
      oneOf: oneOfNames.length > 0 ? oneOfNames : prev.oneOf,
      discriminatorProperty: discriminatorProperty || prev.discriminatorProperty,
      error: '',
    }));
    setAiPatchStates((prev) => ({ ...prev, [messageIndex]: 'applied' }));
  };

  const handleAiRejectPatch = (messageIndex: number) => {
    setAiPatchStates((prev) => ({ ...prev, [messageIndex]: 'rejected' }));
  };

  const handleAiAbort = () => {
    aiAbortControllerRef.current?.abort();
  };

  const handleAiResetConversation = () => {
    aiAbortControllerRef.current?.abort();
    setAiMessages([]);
    setAiInput('');
    setAiCreateError('');
    setAiPatchStates({});
  };

  // Helper function to build schema from form data
  const buildSchemaFromFormData = () => {
    const schema: any = { type: 'object', properties: {} };

    // Add composition types
    if (formData.allOf.length > 0) {
      schema.allOf = formData.allOf.map(name => ({ $ref: `#/components/schemas/${name}` }));
    }
    if (formData.anyOf.length > 0) {
      schema.anyOf = formData.anyOf.map(name => ({ $ref: `#/components/schemas/${name}` }));
    }
    if (formData.oneOf.length > 0) {
      schema.oneOf = formData.oneOf.map(name => ({ $ref: `#/components/schemas/${name}` }));
    }

    // Add discriminator if specified (can be used on base classes or with composition)
    if (formData.discriminatorProperty) {
      schema.discriminator = { propertyName: formData.discriminatorProperty };
      if (!formData.discriminatorUseAuto && Object.keys(formData.discriminatorMapping).length > 0) {
        // Use custom mapping
        schema.discriminator.mapping = {};
        Object.entries(formData.discriminatorMapping).forEach(([propertyValue, schemaName]) => {
          schema.discriminator.mapping[propertyValue] = `#/components/schemas/${schemaName}`;
        });
      }
    }

    // Add additionalProperties based on the selected type
    if (formData.additionalPropertiesType === 'allow') {
      schema.additionalProperties = true;
    } else if (formData.additionalPropertiesType === 'disallow') {
      schema.additionalProperties = false;
    } else if (formData.additionalPropertiesType === 'schema' && formData.additionalPropertiesSchema) {
      schema.additionalProperties = { $ref: `#/components/schemas/${formData.additionalPropertiesSchema}` };
    } else if (formData.additionalPropertiesType === 'type') {
      schema.additionalProperties = { type: formData.additionalPropertiesInlineType };
    }
    // 'default' means no additionalProperties field is added

    // Add unevaluatedProperties based on the selected type
    if (formData.unevaluatedPropertiesType === 'allow') {
      schema.unevaluatedProperties = true;
    } else if (formData.unevaluatedPropertiesType === 'disallow') {
      schema.unevaluatedProperties = false;
    } else if (formData.unevaluatedPropertiesType === 'schema' && formData.unevaluatedPropertiesSchema) {
      schema.unevaluatedProperties = { $ref: `#/components/schemas/${formData.unevaluatedPropertiesSchema}` };
    } else if (formData.unevaluatedPropertiesType === 'type') {
      schema.unevaluatedProperties = { type: formData.unevaluatedPropertiesInlineType };
    }
    // 'default' means no unevaluatedProperties field is added

    // Add patternProperties if defined
    if (formData.patternProperties.length > 0) {
      schema.patternProperties = {};
      formData.patternProperties.forEach(({ pattern, schemaType, schemaRef }) => {
        if (pattern.trim()) {
          if (schemaType === 'ref' && schemaRef) {
            schema.patternProperties[pattern] = { $ref: `#/components/schemas/${schemaRef}` };
          } else {
            schema.patternProperties[pattern] = { type: schemaType };
          }
        }
      });
      // Remove patternProperties if empty after filtering
      if (Object.keys(schema.patternProperties).length === 0) {
        delete schema.patternProperties;
      }
    }

    // Preserve full schema objects (if/then/else, $ref, etc.) on dependentSchemas
    if (Object.keys(formData.dependentSchemas).length > 0) {
      schema.dependentSchemas = formData.dependentSchemas;
    } else {
      delete schema.dependentSchemas;
    }

    // Add dependentRequired if defined
    if (formData.dependentRequired.length > 0) {
      schema.dependentRequired = {};
      formData.dependentRequired.forEach(({ triggerProperty, requiredProperties }) => {
        if (triggerProperty.trim() && requiredProperties.length > 0) {
          schema.dependentRequired[triggerProperty] = requiredProperties;
        }
      });
      // Remove dependentRequired if empty after filtering
      if (Object.keys(schema.dependentRequired).length === 0) {
        delete schema.dependentRequired;
      }
    }

    // Add deprecated if true
    if (formData.deprecated) {
      schema.deprecated = true;
      if (formData.deprecationMessage.trim()) {
        schema.deprecationMessage = formData.deprecationMessage.trim();
      }
    }

    // Add object constraints (OpenAPI 3.1)
    if (formData.minProperties.trim()) {
      const val = parseInt(formData.minProperties.trim(), 10);
      if (!isNaN(val) && val >= 0) {
        schema.minProperties = val;
      }
    }
    if (formData.maxProperties.trim()) {
      const val = parseInt(formData.maxProperties.trim(), 10);
      if (!isNaN(val) && val >= 0) {
        schema.maxProperties = val;
      }
    }

    // Add examples array (JSON Schema)
    if (formData.examples.length > 0) {
      schema.examples = formData.examples.map((ex: string) => {
        try {
          return JSON.parse(ex);
        } catch {
          return ex;
        }
      });
    }

    // Add XML Object (OpenAPI 3.1)
    const hasXml = formData.xmlName.trim() || formData.xmlNamespace.trim() || formData.xmlPrefix.trim();
    if (hasXml) {
      schema.xml = {};
      if (formData.xmlName.trim()) schema.xml.name = formData.xmlName.trim();
      if (formData.xmlNamespace.trim()) schema.xml.namespace = formData.xmlNamespace.trim();
      if (formData.xmlPrefix.trim()) schema.xml.prefix = formData.xmlPrefix.trim();
    }

    // Add schema metadata (JSON Schema 2020-12)
    if (formData.schemaId.trim()) {
      schema.$id = formData.schemaId.trim();
    }
    if (formData.schemaAnchor.trim()) {
      schema.$anchor = formData.schemaAnchor.trim();
    }
    if (formData.schemaComment.trim()) {
      schema.$comment = formData.schemaComment.trim();
    }

    // Add externalDocs if URL is provided
    if (formData.externalDocsUrl.trim()) {
      schema.externalDocs = {
        url: formData.externalDocsUrl.trim()
      };
      if (formData.externalDocsDescription.trim()) {
        schema.externalDocs.description = formData.externalDocsDescription.trim();
      }
    }

    // Add extensions (x- prefixed properties)
    Object.keys(formData.extensions).forEach(key => {
      if (key.startsWith('x-')) {
        schema[key] = formData.extensions[key];
      }
    });

    // Add conditional rules (if/then/else)
    if (formData.conditionalRules.length > 0) {
      const conditionalSchemas = conditionalRulesToJsonSchema(formData.conditionalRules);
      if (conditionalSchemas.length === 1) {
        // Single rule: add at top level
        schema.if = conditionalSchemas[0].if;
        schema.then = conditionalSchemas[0].then;
        if (conditionalSchemas[0].else) {
          schema.else = conditionalSchemas[0].else;
        }
      } else if (conditionalSchemas.length > 1) {
        // Multiple rules: add to allOf array
        if (!schema.allOf) {
          schema.allOf = [];
        }
        schema.allOf.push(...conditionalSchemas);
      }
    }

    return schema;
  };

  // Create a stable stringified version of formData for dependency tracking
  const formDataString = useMemo(() => JSON.stringify(formData), [formData]);

  // Memoize the built schema from current form so the View ▾ side sheet stays in sync
  const builtSchema = useMemo(() => {
    if (editingClassData && !formData.name) {
      // Form not yet initialized (first frame after open) – use class schema
      return typeof editingClassData.schema === 'string'
        ? JSON.parse(editingClassData.schema)
        : editingClassData.schema || {};
    }
    return buildSchemaFromFormData();
  }, [editingClassData, formDataString, formData.name]);

  // Memoize all classes array to prevent reference changes
  const allClasses = useMemo(() => {
    return nodes.map(node => node.data).filter(data => data && data.name);
  }, [nodes]);

  /**
   * Pretty-printed schema for the inspector's Live Preview card.
   * Computed off `builtSchema` so it stays in sync as the user edits.
   */
  const inspectorPreviewJson = useMemo(() => {
    try {
      return JSON.stringify(builtSchema, null, 2);
    } catch {
      return '// Could not serialize schema';
    }
  }, [builtSchema]);

  // Generate OpenAPI doc asynchronously with debouncing
  useEffect(() => {
    if (!open) return;

    // Debounce the generation to prevent rapid successive calls
    const timeoutId = setTimeout(() => {
      const generateOpenApiDocAsync = async () => {
        setLoadingOpenApiDoc(true);
        try {
          // Use current form schema so Example tab reflects latest edits
          let previewClassData = editingClassData
            ? { ...editingClassData, schema: builtSchema }
            : {
                name: formData.name || 'NewClass',
                description: formData.description,
                schema: builtSchema
              };

          // When opened from sidebar, class data may lack properties – fetch full class for example generation
          if (
            previewClassData.id &&
            (!previewClassData.properties || previewClassData.properties.length === 0)
          ) {
            const res = await getClassWithPropertiesAndTagsWithSession(previewClassData.id);
            if (res.success && res.class) {
              previewClassData = { ...res.class, schema: builtSchema };
            }
          }

          const doc = await generateClassOpenApiSpec(previewClassData, allClasses, {
            title: `${previewClassData.name} Schema`,
            version: '1.0.0',
            description: 'OpenAPI 3.1.0 schema definition',
            metadata: projectMetadata
          });

          setOpenApiDoc(doc);
        } catch (error) {
          console.error('Failed to generate OpenAPI doc:', error);
          setOpenApiDoc(null);
        } finally {
          setLoadingOpenApiDoc(false);
        }
      };

      generateOpenApiDocAsync();
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [open, builtSchema, allClasses, editingClassData, projectMetadata]);

  // Get all available class names for composition selectors (excluding current class)
  const availableClasses = nodes
    .map(node => node.data)
    .filter(data => data && data.name && (!editingClassData || data.name !== editingClassData.name))
    .map(data => data.name);

  // Save handler
  const handleSave = async () => {
    if (!formData.name.trim()) {
      setFormData(prev => ({ ...prev, error: 'Class name is required' }));
      return;
    }

    // For create mode, versionId is required
    if (!editingClassData && !versionId) {
      setFormData(prev => ({ ...prev, error: 'Version ID is required to create a class' }));
      return;
    }

    setSaving(true);
    setFormData(prev => ({ ...prev, error: '' }));

    try {
      // Build schema from form data
      const schema = buildSchemaFromFormData();

      let response: { success: boolean; class?: any; error?: string };
      let classId: string;

      if (editingClassData) {
        // Update existing class via REST API
        response = await updateClassWithSession(
          editingClassData.id,
          formData.name,
          formData.description || null,
          schema
        );
        classId = editingClassData.id;
      } else {
        // Create new class via REST API
        response = await createClassWithSession(
          versionId!,
          formData.name,
          formData.description || null,
          schema
        );
        if (response.success && response.class) {
          classId = response.class.id;
        } else {
          setFormData(prev => ({ ...prev, error: response.error || 'Failed to create class' }));
          setSaving(false);
          return;
        }
      }

      if (!response.success) {
        setFormData(prev => ({ ...prev, error: response.error || 'Failed to save class' }));
        setSaving(false);
        return;
      }

      // Update tag assignments
      if (projectId && classId!) {
        try {
          // Get current tags
          const currentTagsResult = await getTagsForClass(classId);
          const currentTags = JSON.parse(currentTagsResult);
          const currentTagIds = currentTags.map((ct: any) => ct.tag_id);

          // Find tags to add and remove
          const tagsToAdd = formData.selectedTags.filter(id => !currentTagIds.includes(id));
          const tagsToRemove = currentTagIds.filter((id: string) => !formData.selectedTags.includes(id));

          // Add new tags
          for (const tagId of tagsToAdd) {
            await assignTagToClass(classId, tagId);
          }

          // Remove old tags
          for (const tagId of tagsToRemove) {
            await removeTagFromClass(classId, tagId);
          }
        } catch (error) {
          console.error('Error updating tags:', error);
          // Don't fail the whole save if tag update fails
        }
      }

      setLastSavedAt(Date.now());
      setSnapshotTick((t) => t + 1);
      if (onSave) {
        onSave();
      }
      onClose();
    } catch (error) {
      console.error('Error saving class:', error);
      setFormData(prev => ({ ...prev, error: 'An error occurred while saving the class' }));
    } finally {
      setSaving(false);
    }
  };

  // Get the preview class data for display
  const previewClassData = editingClassData || {
    name: formData.name || 'NewClass',
    description: formData.description,
    schema: { type: 'object', properties: {} }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()} modal={true}>
      <DialogContent
        className="max-w-[1480px] w-[96vw] h-[92vh] max-h-[940px] p-0 flex flex-col overflow-hidden"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        {/* Visually-hidden DialogTitle keeps Radix happy without
            duplicating the rich header below. */}
        <DialogTitle className="sr-only">
          {!editingClassData
            ? 'Add class'
            : isReadOnly
              ? `View class ${formData.name || editingClassData.name}`
              : `Edit class ${formData.name || editingClassData.name}`}
        </DialogTitle>
        <ClassEditHeader
          className={formData.name}
          originalName={editingClassData?.name}
          isCreating={!editingClassData}
          isReadOnly={isReadOnly}
          tags={formData.selectedTags.flatMap((tagId) => {
            const tag = (projectTags || []).find(
              (t: { id: string }) => t.id === tagId,
            ) as { id: string; name: string; color?: string } | undefined;
            return tag
              ? [{ id: tag.id, name: tag.name, color: tag.color }]
              : [];
          })}
          contextLabel={editingClassData?.id ? `id ${String(editingClassData.id).slice(0, 8)}` : undefined}
          subtitle={
            editingClassData
              ? [
                  Array.isArray(editingClassData.properties)
                    ? `${editingClassData.properties.length} propert${editingClassData.properties.length === 1 ? 'y' : 'ies'}`
                    : null,
                  inspectorReferences[0]?.count
                    ? `${inspectorReferences[0].count} reference${inspectorReferences[0].count === 1 ? '' : 's'}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || undefined
              : undefined
          }
          completenessPercent={completenessPercent}
          unsavedCount={unsavedCount}
          errorCount={errorCount}
          warnCount={warnCount}
          onClose={onClose}
          sidekickOpen={aiSidekickOpen}
          onToggleSidekick={() => setAiSidekickOpen((o) => !o)}
          onOpenViewMenu={() => {
            setViewSheetFormat('schema-json');
            setViewSheetOpen(true);
          }}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          {formData.error && <Alert variant="error" className="m-4 mb-0">{formData.error}</Alert>}

            <ClassEditStatusBar
              unsavedCount={unsavedCount}
              lastSavedLabel={lastSavedLabel}
              leftLabel={
                viewMode === 'guided' ? (
                  <>
                    <span className="font-semibold uppercase tracking-[0.1em] text-[10px] text-slate-500 dark:text-slate-400">
                      Wizard
                    </span>
                    <span className="text-slate-400">·</span>
                    <span>
                      Step {currentStepIndex + 1} of {CLASS_WIZARD_STEPS.length}
                      <span className="text-slate-400 mx-1">·</span>
                      {CLASS_WIZARD_STEPS[currentStepIndex].label}
                    </span>
                  </>
                ) : undefined
              }
              rightSlot={
                <>
                  <span className="text-slate-500">View as</span>
                  <FormViewModeToggle value={viewMode} onChange={setViewMode} />
                </>
              }
            />
            {viewMode === 'guided' && (
              <FormWizardStepper
                steps={CLASS_WIZARD_STEPS.map((step, idx) => ({
                  id: step.id,
                  label: step.label,
                  complete: idx < currentStepIndex,
                }))}
                currentIndex={currentStepIndex}
                onStepSelect={setCurrentStepIndex}
              />
            )}

            {/* Body: section nav (advanced) | scrolling sections | inspector (advanced) */}
            <div className="flex-1 flex overflow-hidden min-h-0">
              {viewMode === 'advanced' && (
                <FormSectionNav
                  title="Sections"
                  items={[
                    { id: 'basics', label: 'Basic Information', icon: <FileText className="h-3.5 w-3.5" />, group: 'Basics', status: sectionStatus.basics },
                    { id: 'object-constraints', label: 'Object Constraints', icon: <Settings className="h-3.5 w-3.5" />, group: 'Validation', status: sectionStatus['object-constraints'] },
                    { id: 'additional-props', label: 'Additional Properties', icon: <Layers className="h-3.5 w-3.5" />, group: 'Validation', status: sectionStatus['additional-props'] },
                    { id: 'unevaluated-props', label: 'Unevaluated Properties', icon: <Layers className="h-3.5 w-3.5" />, group: 'Validation', status: sectionStatus['unevaluated-props'] },
                    { id: 'composition', label: 'Composition', icon: <GitBranch className="h-3.5 w-3.5" />, group: 'Composition', status: sectionStatus.composition },
                    { id: 'pattern-props', label: 'Pattern Properties', icon: <Regex className="h-3.5 w-3.5" />, group: 'Dynamic Properties', status: sectionStatus['pattern-props'] },
                    { id: 'dependent-schemas', label: 'Dependent Schemas', icon: <Link className="h-3.5 w-3.5" />, group: 'Dynamic Properties', status: sectionStatus['dependent-schemas'] },
                    { id: 'dependent-required', label: 'Dependent Required', icon: <ListChecks className="h-3.5 w-3.5" />, group: 'Dynamic Properties', status: sectionStatus['dependent-required'] },
                    { id: 'conditional', label: 'Conditional Schema', icon: <GitBranch className="h-3.5 w-3.5" />, group: 'Dynamic Properties', status: sectionStatus.conditional },
                    { id: 'examples', label: 'Examples', icon: <Code className="h-3.5 w-3.5" />, group: 'Documentation', status: sectionStatus.examples },
                    { id: 'xml', label: 'XML Representation', icon: <Code className="h-3.5 w-3.5" />, group: 'Documentation', status: sectionStatus.xml },
                    { id: 'schema-metadata', label: 'Schema Metadata', icon: <FileText className="h-3.5 w-3.5" />, group: 'Documentation', status: sectionStatus['schema-metadata'] },
                    { id: 'external-docs', label: 'External Docs', icon: <ExternalLink className="h-3.5 w-3.5" />, group: 'Documentation', status: sectionStatus['external-docs'] },
                    { id: 'extensions', label: 'Extensions', icon: <Code className="h-3.5 w-3.5" />, group: 'Documentation', status: sectionStatus.extensions },
                  ]}
                  activeId={activeSectionId}
                  onSelect={(id) => {
                    setSectionExpanded(id as ClassSectionId, true);
                    // Scroll on the next paint so the section has expanded
                    // before the scroll target is computed.
                    requestAnimationFrame(() => {
                      scrollToSection(advancedScrollRef.current, id, 24);
                    });
                  }}
                  className="h-full"
                />
              )}

              <div
                ref={advancedScrollRef}
                className="flex-1 overflow-y-auto min-h-0"
              >

              {/* SECTION: Basic Information */}
              {(viewMode === 'advanced' || CLASS_WIZARD_STEPS[currentStepIndex].sections.includes('basics')) && (
              <FormSection
                id="basics"
                icon={<FileText size={16} />}
                eyebrow="Identity"
                title="Basic Information"
                description="Name, description, tags, and deprecation metadata."
                status={sectionStatus.basics}
              >
                <FormGrid cols={3} gap="md">
                  <FormFieldGroup label="Class Name" htmlFor="className" required helper="PascalCase recommended">
                    <Input
                      id="className"
                      autoFocus
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value.replace(/[^A-Za-z0-9_]/g, '') }))}
                      placeholder="e.g., UserAccount"
                      disabled={isReadOnly}
                    />
                  </FormFieldGroup>
                  <FormFieldGroup label="Description" htmlFor="description" className="md:col-span-2">
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Brief description of what this class represents"
                      disabled={isReadOnly}
                      rows={2}
                    />
                  </FormFieldGroup>
                </FormGrid>

                {/* Tags */}
                {projectId && projectTags && projectTags.length > 0 && (
                  <FormFieldGroup label="Tags">
                    <div className="flex flex-wrap gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-md min-h-[38px]">
                      {formData.selectedTags.map((tagId) => {
                        const tag = projectTags.find((t: any) => t.id === tagId);
                        return tag ? (
                          <Badge key={tagId} variant="secondary" className="gap-1">
                            <span style={{ color: tag.color }}>●</span>
                            {tag.name}
                            {!isReadOnly && (
                              <button type="button" onClick={() => setFormData(prev => ({ ...prev, selectedTags: prev.selectedTags.filter(id => id !== tagId) }))}>
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </Badge>
                        ) : null;
                      })}
                      {!isReadOnly && projectTags.filter((t: any) => !formData.selectedTags.includes(t.id)).length > 0 && (
                        <Select
                          value=""
                          onValueChange={(tagId) => {
                            if (tagId && !formData.selectedTags.includes(tagId)) {
                              setFormData(prev => ({ ...prev, selectedTags: [...prev.selectedTags, tagId] }));
                            }
                          }}
                        >
                          <SelectTrigger className="w-auto h-7 text-xs border-dashed">
                            <TagIcon className="h-3 w-3 mr-1" />
                            Add Tag
                          </SelectTrigger>
                          <SelectContent>
                            {projectTags.filter((t: any) => !formData.selectedTags.includes(t.id)).map((tag: any) => (
                              <SelectItem key={tag.id} value={tag.id}>
                                <span className="flex items-center gap-2">
                                  <span style={{ color: tag.color }}>●</span>
                                  {tag.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </FormFieldGroup>
                )}

                <FormToggleCard
                  id="deprecated"
                  icon={<AlertTriangle className="h-3.5 w-3.5" />}
                  accent="amber"
                  label="Deprecated"
                  description="Mark this class as deprecated. Consumers will see a warning."
                  checked={formData.deprecated}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, deprecated: checked }))}
                  disabled={isReadOnly}
                  stack={formData.deprecated}
                  trailing={formData.deprecated ? (
                    <Input
                      value={formData.deprecationMessage}
                      onChange={(e) => setFormData(prev => ({ ...prev, deprecationMessage: e.target.value }))}
                      placeholder="Deprecation message (e.g., Use NewClass instead)"
                      disabled={isReadOnly}
                      className="h-8 text-sm"
                    />
                  ) : undefined}
                />
              </FormSection>
              )}

              {/* SECTION: Object Constraints */}
              {(viewMode === 'advanced' || CLASS_WIZARD_STEPS[currentStepIndex].sections.includes('object-constraints')) && (
              <FormSection
                id="object-constraints"
                icon={<Settings size={16} />}
                eyebrow="Validation"
                title="Object Constraints"
                description="Limits on the number of properties an instance of this class may contain."
                badge={<Badge variant="secondary" className="text-xs">OpenAPI 3.1</Badge>}
                status={sectionStatus['object-constraints']}
                collapsible={viewMode === 'advanced'}
                expanded={isSectionExpanded('object-constraints')}
                onExpandedChange={(next) => setSectionExpanded('object-constraints', next)}
              >
                <FormGrid cols={2} gap="md">
                  <FormFieldGroup label="Min Properties" helper="Minimum number of properties required">
                    <Input
                      type="number"
                      min="0"
                      value={formData.minProperties}
                      onChange={(e) => setFormData(prev => ({ ...prev, minProperties: e.target.value }))}
                      placeholder="e.g., 1"
                      disabled={isReadOnly}
                    />
                  </FormFieldGroup>
                  <FormFieldGroup label="Max Properties" helper="Maximum number of properties allowed">
                    <Input
                      type="number"
                      min="0"
                      value={formData.maxProperties}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxProperties: e.target.value }))}
                      placeholder="e.g., 10"
                      disabled={isReadOnly}
                    />
                  </FormFieldGroup>
                </FormGrid>
              </FormSection>
              )}

              {/* SECTION: Additional Properties */}
              {(viewMode === 'advanced' || CLASS_WIZARD_STEPS[currentStepIndex].sections.includes('additional-props')) && (
              <FormSection
                id="additional-props"
                icon={<Layers size={16} />}
                eyebrow="Validation"
                title="Additional Properties"
                description="Controls validation for properties not defined in the schema."
                status={sectionStatus['additional-props']}
                collapsible={viewMode === 'advanced'}
                expanded={isSectionExpanded('additional-props')}
                onExpandedChange={(next) => setSectionExpanded('additional-props', next)}
              >
                <div className="space-y-2">
                      {(['default', 'allow', 'disallow', 'type', 'schema'] as const).map((value) => (
                        <label key={value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="additionalPropertiesType"
                            value={value}
                            checked={formData.additionalPropertiesType === value}
                            onChange={(e) => {
                              const val = e.target.value as typeof value;
                              setFormData(prev => ({
                                ...prev,
                                additionalPropertiesType: val,
                                additionalProperties: val === 'default' ? null : val === 'allow' ? true : val === 'disallow' ? false : null,
                                additionalPropertiesSchema: val === 'schema' ? prev.additionalPropertiesSchema : '',
                                additionalPropertiesInlineType: val === 'type' ? prev.additionalPropertiesInlineType : 'string'
                              }));
                            }}
                            disabled={isReadOnly}
                            className="w-4 h-4 text-indigo-600"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {value === 'default' && 'Not specified (default)'}
                            {value === 'allow' && 'Allow Any (true)'}
                            {value === 'disallow' && 'Disallow (false)'}
                            {value === 'type' && 'Must Be Type'}
                            {value === 'schema' && 'Must Match Schema'}
                          </span>
                        </label>
                      ))}
                      {formData.additionalPropertiesType === 'type' && (
                        <div className="mt-2 pl-6">
                          <Select
                            value={formData.additionalPropertiesInlineType}
                            onValueChange={(val) => setFormData(prev => ({ ...prev, additionalPropertiesInlineType: val as any }))}
                            disabled={isReadOnly}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a type..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="string">string</SelectItem>
                              <SelectItem value="number">number</SelectItem>
                              <SelectItem value="integer">integer</SelectItem>
                              <SelectItem value="boolean">boolean</SelectItem>
                              <SelectItem value="object">object</SelectItem>
                              <SelectItem value="array">array</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {formData.additionalPropertiesType === 'schema' && (
                        <div className="mt-2 pl-6">
                          <Select
                            value={formData.additionalPropertiesSchema || '__none__'}
                            onValueChange={(val) => setFormData(prev => ({ ...prev, additionalPropertiesSchema: val === '__none__' ? '' : val }))}
                            disabled={isReadOnly}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a class..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Select a class...</SelectItem>
                              {availableClasses.map((cls) => (
                                <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                </div>
              </FormSection>
              )}

              {/* SECTION: Unevaluated Properties */}
              {(viewMode === 'advanced' || CLASS_WIZARD_STEPS[currentStepIndex].sections.includes('unevaluated-props')) && (
              <FormSection
                id="unevaluated-props"
                icon={<Layers size={16} />}
                eyebrow="Validation"
                title="Unevaluated Properties"
                description="For properties not matched by allOf / oneOf / anyOf subschemas."
                status={sectionStatus['unevaluated-props']}
                collapsible={viewMode === 'advanced'}
                expanded={isSectionExpanded('unevaluated-props')}
                onExpandedChange={(next) => setSectionExpanded('unevaluated-props', next)}
              >
                <div className="space-y-2">
                      {(['default', 'allow', 'disallow', 'type', 'schema'] as const).map((value) => (
                        <label key={value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="unevaluatedPropertiesType"
                            value={value}
                            checked={formData.unevaluatedPropertiesType === value}
                            onChange={(e) => {
                              const val = e.target.value as typeof value;
                              setFormData(prev => ({
                                ...prev,
                                unevaluatedPropertiesType: val,
                                unevaluatedProperties: val === 'default' ? null : val === 'allow' ? true : val === 'disallow' ? false : null,
                                unevaluatedPropertiesSchema: val === 'schema' ? prev.unevaluatedPropertiesSchema : '',
                                unevaluatedPropertiesInlineType: val === 'type' ? prev.unevaluatedPropertiesInlineType : 'string'
                              }));
                            }}
                            disabled={isReadOnly}
                            className="w-4 h-4 text-indigo-600"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {value === 'default' && 'Not specified (default)'}
                            {value === 'allow' && 'Allow Any (true)'}
                            {value === 'disallow' && 'Disallow (false)'}
                            {value === 'type' && 'Must Be Type'}
                            {value === 'schema' && 'Must Match Schema'}
                          </span>
                        </label>
                      ))}
                      {formData.unevaluatedPropertiesType === 'type' && (
                        <div className="mt-2 pl-6">
                          <Select
                            value={formData.unevaluatedPropertiesInlineType}
                            onValueChange={(val) => setFormData(prev => ({ ...prev, unevaluatedPropertiesInlineType: val as any }))}
                            disabled={isReadOnly}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a type..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="string">string</SelectItem>
                              <SelectItem value="number">number</SelectItem>
                              <SelectItem value="integer">integer</SelectItem>
                              <SelectItem value="boolean">boolean</SelectItem>
                              <SelectItem value="object">object</SelectItem>
                              <SelectItem value="array">array</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {formData.unevaluatedPropertiesType === 'schema' && (
                        <div className="mt-2 pl-6">
                          <Select
                            value={formData.unevaluatedPropertiesSchema || '__none__'}
                            onValueChange={(val) => setFormData(prev => ({ ...prev, unevaluatedPropertiesSchema: val === '__none__' ? '' : val }))}
                            disabled={isReadOnly}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a class..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Select a class...</SelectItem>
                              {availableClasses.map((cls) => (
                                <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                </div>
              </FormSection>
              )}

              {/* SECTION: Composition & Inheritance */}
              {(viewMode === 'advanced' || CLASS_WIZARD_STEPS[currentStepIndex].sections.includes('composition')) && (
              <FormSection
                id="composition"
                icon={<GitBranch size={16} />}
                eyebrow="Composition"
                title="Composition & Inheritance"
                description="Define relationships with other classes using OpenAPI composition keywords."
                status={sectionStatus.composition}
                collapsible={viewMode === 'advanced'}
                expanded={isSectionExpanded('composition')}
                onExpandedChange={(next) => setSectionExpanded('composition', next)}
              >
                <ClassCompositionPicker
                  value={{
                    allOf: formData.allOf,
                    anyOf: formData.anyOf,
                    oneOf: formData.oneOf,
                  }}
                  availableClasses={availableClasses}
                  disabled={isReadOnly}
                  onChange={(next) =>
                    setFormData((prev) => ({
                      ...prev,
                      allOf: next.allOf,
                      anyOf: next.anyOf,
                      oneOf: next.oneOf,
                    }))
                  }
                />

                {/* Discriminator */}
                {(formData.allOf.length > 0 || formData.anyOf.length > 0 || formData.oneOf.length > 0) && (
                  <FormSubsection
                    tone="subtle"
                    accent="indigo"
                    icon={<GitBranch className="h-4 w-4" />}
                    title="Discriminator Configuration"
                    description="Helps tools understand which schema variant to use for polymorphic types."
                  >
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label>Discriminator Property</Label>
                        <Input
                          value={formData.discriminatorProperty}
                          onChange={(e) => setFormData(prev => ({ ...prev, discriminatorProperty: e.target.value }))}
                          placeholder="e.g., type, petType, kind"
                          disabled={isReadOnly}
                        />
                      </div>
                      {formData.discriminatorProperty && (
                        <>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="discriminatorUseAuto"
                              checked={formData.discriminatorUseAuto}
                              onCheckedChange={(checked) => setFormData(prev => ({
                                ...prev,
                                discriminatorUseAuto: !!checked,
                                discriminatorMapping: checked ? {} : prev.discriminatorMapping
                              }))}
                              disabled={isReadOnly}
                            />
                            <label htmlFor="discriminatorUseAuto" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                              Use automatic mapping (based on schema names)
                            </label>
                          </div>

                          {/* Custom Mapping UI */}
                          {!formData.discriminatorUseAuto && (
                            <div className="mt-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-gray-600">
                              <h5 className="text-xs font-semibold mb-2 text-gray-700 dark:text-gray-300">Custom Mapping</h5>
                              <p className="text-xs text-gray-500 mb-3">Map discriminator values to schema references</p>

                              {/* Existing mappings */}
                              {Object.entries(formData.discriminatorMapping).length > 0 && (
                                <div className="space-y-2 mb-3">
                                  {Object.entries(formData.discriminatorMapping).map(([value, schemaName]) => (
                                    <div key={value} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-slate-800 rounded">
                                      <code className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded">
                                        {value}
                                      </code>
                                      <ArrowRight size={14} className="text-gray-400" />
                                      <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                                        #/components/schemas/{schemaName}
                                      </span>
                                      {!isReadOnly && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                          onClick={() => {
                                            const newMapping = { ...formData.discriminatorMapping };
                                            delete newMapping[value];
                                            setFormData(prev => ({ ...prev, discriminatorMapping: newMapping }));
                                          }}
                                        >
                                          <X size={14} />
                                        </Button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Add new mapping */}
                              {!isReadOnly && (
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="Value (e.g., dog)"
                                    className="flex-1 text-sm"
                                    id="newDiscriminatorValue"
                                  />
                                  <Select
                                    onValueChange={(schemaName) => {
                                      const valueInput = document.getElementById('newDiscriminatorValue') as HTMLInputElement;
                                      const value = valueInput?.value?.trim();
                                      if (value && schemaName) {
                                        setFormData(prev => ({
                                          ...prev,
                                          discriminatorMapping: {
                                            ...prev.discriminatorMapping,
                                            [value]: schemaName
                                          }
                                        }));
                                        if (valueInput) valueInput.value = '';
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="w-[180px]">
                                      <SelectValue placeholder="Select schema..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {availableClasses.map((cls) => (
                                        <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {Object.entries(formData.discriminatorMapping).length === 0 && (
                                <p className="text-xs text-gray-400 italic mt-2">
                                  No mappings defined. Enter a discriminator value and select a target schema.
                                </p>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </FormSubsection>
                )}
              </FormSection>
              )}

              {/* SECTION: Pattern Properties */}
              {(viewMode === 'advanced' || CLASS_WIZARD_STEPS[currentStepIndex].sections.includes('pattern-props')) && (
              <FormSection
                id="pattern-props"
                icon={<Regex size={16} />}
                eyebrow="Dynamic Properties"
                title="Pattern Properties"
                description="Define regex patterns that map dynamic property names to schemas."
                status={sectionStatus['pattern-props']}
                collapsible={viewMode === 'advanced'}
                expanded={isSectionExpanded('pattern-props')}
                onExpandedChange={(next) => setSectionExpanded('pattern-props', next)}
                action={!isReadOnly ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      patternProperties: [...prev.patternProperties, { pattern: '', schemaType: 'string', schemaRef: '' }]
                    }))}
                  >
                    <Plus size={14} className="mr-1" /> Add Pattern
                  </Button>
                ) : undefined}
              >
                {formData.patternProperties.length === 0 ? (
                  <FormEmptyState
                    icon={<Regex className="h-5 w-5" />}
                    title="No pattern properties defined"
                    description="Add a regex pattern to validate properties whose names are not known in advance."
                  />
                ) : (
                  <div className="space-y-3">
                    {formData.patternProperties.map((patternProp, index) => (
                      <div key={index} className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 flex gap-3 items-end">
                        <div className="flex-1 flex flex-col md:flex-row gap-3">
                          <div className="flex-1 space-y-1">
                            <Label>Regex Pattern</Label>
                            <Input
                              value={patternProp.pattern}
                              onChange={(e) => {
                                const newPatternProps = [...formData.patternProperties];
                                newPatternProps[index] = { ...newPatternProps[index], pattern: e.target.value };
                                setFormData(prev => ({ ...prev, patternProperties: newPatternProps }));
                              }}
                              disabled={isReadOnly}
                              placeholder="^x-.*$"
                              className="font-mono"
                            />
                          </div>
                          <div className="flex-1 space-y-1">
                            <Label>Type</Label>
                            <Select
                              value={patternProp.schemaType}
                              onValueChange={(val) => {
                                const newPatternProps = [...formData.patternProperties];
                                newPatternProps[index] = { ...newPatternProps[index], schemaType: val as any, schemaRef: val === 'ref' ? patternProp.schemaRef : '' };
                                setFormData(prev => ({ ...prev, patternProperties: newPatternProps }));
                              }}
                              disabled={isReadOnly}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="string">String</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="integer">Integer</SelectItem>
                                <SelectItem value="boolean">Boolean</SelectItem>
                                <SelectItem value="object">Object</SelectItem>
                                <SelectItem value="array">Array</SelectItem>
                                <SelectItem value="ref">Schema Reference</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {patternProp.schemaType === 'ref' && (
                            <div className="flex-1 space-y-1">
                              <Label>Schema</Label>
                              <Select
                                value={patternProp.schemaRef || '__none__'}
                                onValueChange={(val) => {
                                  const newPatternProps = [...formData.patternProperties];
                                  newPatternProps[index] = { ...newPatternProps[index], schemaRef: val === '__none__' ? '' : val };
                                  setFormData(prev => ({ ...prev, patternProperties: newPatternProps }));
                                }}
                                disabled={isReadOnly}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Select...</SelectItem>
                                  {availableClasses.map((cls) => (
                                    <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                        {!isReadOnly && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0 h-9 w-9"
                            onClick={() => {
                              const newPatternProps = formData.patternProperties.filter((_, i) => i !== index);
                              setFormData(prev => ({ ...prev, patternProperties: newPatternProps }));
                            }}
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </FormSection>
              )}

              {/* SECTION: Dependent Schemas */}
              {(viewMode === 'advanced' || CLASS_WIZARD_STEPS[currentStepIndex].sections.includes('dependent-schemas')) && (
              <FormSection
                id="dependent-schemas"
                icon={<Link size={16} />}
                eyebrow="Dynamic Properties"
                title="Dependent Schemas"
                description="Apply additional constraints conditionally when a property has a specific value."
                status={sectionStatus['dependent-schemas']}
                collapsible={viewMode === 'advanced'}
                expanded={isSectionExpanded('dependent-schemas')}
                onExpandedChange={(next) => setSectionExpanded('dependent-schemas', next)}
              >
                {!isReadOnly && (
                  <div className="flex gap-2 mb-4 w-full">
                    <Input
                      value={newDependentSchemaProperty}
                      onChange={(e) => setNewDependentSchemaProperty(e.target.value)}
                      placeholder="Trigger property name"
                      className="flex-1 min-w-0 font-mono"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const name = newDependentSchemaProperty.trim();
                          if (name && !formData.dependentSchemas[name]) {
                            setFormData(prev => ({
                              ...prev,
                              dependentSchemas: {
                                ...prev.dependentSchemas,
                                [name]: {
                                  if: { properties: { [name]: {} } },
                                  then: { required: [] },
                                  else: { required: [] }
                                }
                              }
                            }));
                            setNewDependentSchemaProperty('');
                          }
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const name = newDependentSchemaProperty.trim();
                        if (!name) return;
                        if (formData.dependentSchemas[name]) return;
                        setFormData(prev => ({
                          ...prev,
                          dependentSchemas: {
                            ...prev.dependentSchemas,
                            [name]: {
                              if: { properties: { [name]: {} } },
                              then: { required: [] },
                              else: { required: [] }
                            }
                          }
                        }));
                        setNewDependentSchemaProperty('');
                      }}
                      disabled={!newDependentSchemaProperty.trim() || !!formData.dependentSchemas[newDependentSchemaProperty.trim()]}
                    >
                      <Plus size={14} className="mr-1" /> Add
                    </Button>
                  </div>
                )}

                {Object.keys(formData.dependentSchemas).length === 0 ? (
                  <FormEmptyState
                    icon={<Link className="h-5 w-5" />}
                    title="No dependent schemas defined"
                    description="Add conditional validation rules based on property values."
                  />
                ) : (
                  <div className="space-y-4">
                    {Object.entries(formData.dependentSchemas).map(([triggerProp, depSchema]: [string, any]) => {
                      // Extract values from the schema structure
                      const ifCondition = depSchema?.if?.properties?.[triggerProp] || depSchema?.if || {};
                      const thenRequired = depSchema?.then?.required || [];
                      const elseRequired = depSchema?.else?.required || [];
                      const conditionValue = ifCondition?.const || ifCondition?.enum?.[0] || '';
                      const conditionType = ifCondition?.const !== undefined ? 'const' : (ifCondition?.enum ? 'enum' : 'present');

                      return (
                        <div key={triggerProp} className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700">
                          {/* Header with delete button */}
                          <div className="flex gap-3 items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded text-sm font-mono font-semibold">
                                {triggerProp}
                              </span>
                              <span className="text-sm text-gray-500">triggers conditional validation</span>
                            </div>
                            {!isReadOnly && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0 h-8 w-8"
                                onClick={() => {
                                  const newDeps = { ...formData.dependentSchemas };
                                  delete newDeps[triggerProp];
                                  setFormData(prev => ({ ...prev, dependentSchemas: newDeps }));
                                }}
                              >
                                <Trash2 size={14} />
                              </Button>
                            )}
                          </div>

                          {/* IF Condition */}
                          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded">IF</span>
                              <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">{triggerProp}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center">
                              <Select
                                value={conditionType}
                                onValueChange={(val) => {
                                  const newDeps = { ...formData.dependentSchemas };
                                  const newSchema = { ...depSchema };
                                  if (val === 'const') {
                                    newSchema.if = { properties: { [triggerProp]: { const: conditionValue || '' } } };
                                  } else if (val === 'enum') {
                                    newSchema.if = { properties: { [triggerProp]: { enum: conditionValue ? [conditionValue] : [] } } };
                                  } else {
                                    newSchema.if = { properties: { [triggerProp]: {} }, required: [triggerProp] };
                                  }
                                  newDeps[triggerProp] = newSchema;
                                  setFormData(prev => ({ ...prev, dependentSchemas: newDeps }));
                                }}
                                disabled={isReadOnly}
                              >
                                <SelectTrigger className="w-[140px] h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="present">is present</SelectItem>
                                  <SelectItem value="const">equals</SelectItem>
                                  <SelectItem value="enum">is one of</SelectItem>
                                </SelectContent>
                              </Select>
                              {(conditionType === 'const' || conditionType === 'enum') && (
                                <Input
                                  className="flex-1 min-w-[150px] h-8 text-sm"
                                  value={conditionValue}
                                  onChange={(e) => {
                                    const newDeps = { ...formData.dependentSchemas };
                                    const newSchema = { ...depSchema };
                                    if (conditionType === 'const') {
                                      newSchema.if = { properties: { [triggerProp]: { const: e.target.value } } };
                                    } else {
                                      newSchema.if = { properties: { [triggerProp]: { enum: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } } };
                                    }
                                    newDeps[triggerProp] = newSchema;
                                    setFormData(prev => ({ ...prev, dependentSchemas: newDeps }));
                                  }}
                                  placeholder={conditionType === 'enum' ? 'value1, value2, ...' : 'value'}
                                  disabled={isReadOnly}
                                />
                              )}
                            </div>
                          </div>

                          {/* THEN - Required Properties */}
                          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded">THEN</span>
                              <span className="text-sm text-green-700 dark:text-green-300">require these properties:</span>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center">
                              {thenRequired.map((prop: string, idx: number) => (
                                <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-800/50 text-green-800 dark:text-green-200 rounded text-sm">
                                  {prop}
                                  {!isReadOnly && (
                                    <button
                                      className="ml-1 hover:text-red-500"
                                      onClick={() => {
                                        const newDeps = { ...formData.dependentSchemas };
                                        const newSchema = { ...depSchema, then: { ...depSchema.then, required: thenRequired.filter((_: any, i: number) => i !== idx) } };
                                        newDeps[triggerProp] = newSchema;
                                        setFormData(prev => ({ ...prev, dependentSchemas: newDeps }));
                                      }}
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </span>
                              ))}
                              {!isReadOnly && (
                                <Select
                                  value=""
                                  onValueChange={(val) => {
                                    if (val && !thenRequired.includes(val)) {
                                      const newDeps = { ...formData.dependentSchemas };
                                      const newSchema = { ...depSchema, then: { ...depSchema.then, required: [...thenRequired, val] } };
                                      newDeps[triggerProp] = newSchema;
                                      setFormData(prev => ({ ...prev, dependentSchemas: newDeps }));
                                    }
                                  }}
                                >
                                  <SelectTrigger className="w-[150px] h-8 text-sm">
                                    <SelectValue placeholder="+ Add property" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(editingClassData?.properties || [])
                                      .filter((p: any) => !thenRequired.includes(p.name))
                                      .map((p: any) => (
                                        <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </div>

                          {/* ELSE - Required Properties (Optional) */}
                          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded">ELSE</span>
                              <span className="text-sm text-amber-700 dark:text-amber-300">require these properties instead:</span>
                              <span className="text-xs text-amber-600 dark:text-amber-400">(optional)</span>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center">
                              {elseRequired.map((prop: string, idx: number) => (
                                <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-800/50 text-amber-800 dark:text-amber-200 rounded text-sm">
                                  {prop}
                                  {!isReadOnly && (
                                    <button
                                      className="ml-1 hover:text-red-500"
                                      onClick={() => {
                                        const newDeps = { ...formData.dependentSchemas };
                                        const newSchema = { ...depSchema, else: { ...depSchema.else, required: elseRequired.filter((_: any, i: number) => i !== idx) } };
                                        newDeps[triggerProp] = newSchema;
                                        setFormData(prev => ({ ...prev, dependentSchemas: newDeps }));
                                      }}
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </span>
                              ))}
                              {!isReadOnly && (
                                <Select
                                  value=""
                                  onValueChange={(val) => {
                                    if (val && !elseRequired.includes(val)) {
                                      const newDeps = { ...formData.dependentSchemas };
                                      const newSchema = { ...depSchema, else: { ...(depSchema.else || {}), required: [...elseRequired, val] } };
                                      newDeps[triggerProp] = newSchema;
                                      setFormData(prev => ({ ...prev, dependentSchemas: newDeps }));
                                    }
                                  }}
                                >
                                  <SelectTrigger className="w-[150px] h-8 text-sm">
                                    <SelectValue placeholder="+ Add property" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(editingClassData?.properties || [])
                                      .filter((p: any) => !elseRequired.includes(p.name))
                                      .map((p: any) => (
                                        <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </div>

                          {/* Show raw JSON toggle */}
                          <details className="mt-3">
                            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                              View/Edit Raw JSON
                            </summary>
                            <Textarea
                              className="mt-2 font-mono text-xs"
                              rows={6}
                              value={JSON.stringify(depSchema, null, 2)}
                              onChange={(e) => {
                                try {
                                  const parsed = JSON.parse(e.target.value);
                                  const newDeps = { ...formData.dependentSchemas };
                                  newDeps[triggerProp] = parsed;
                                  setFormData(prev => ({ ...prev, dependentSchemas: newDeps }));
                                } catch {
                                  // Invalid JSON, don't update
                                }
                              }}
                              disabled={isReadOnly}
                            />
                          </details>
                        </div>
                      );
                    })}
                  </div>
                )}
              </FormSection>
              )}

              {/* SECTION: Dependent Required */}
              {(viewMode === 'advanced' || CLASS_WIZARD_STEPS[currentStepIndex].sections.includes('dependent-required')) && (
              <FormSection
                id="dependent-required"
                icon={<ListChecks size={16} />}
                eyebrow="Dynamic Properties"
                title="Dependent Required"
                description="When a trigger property is present, other properties become required."
                status={sectionStatus['dependent-required']}
                collapsible={viewMode === 'advanced'}
                expanded={isSectionExpanded('dependent-required')}
                onExpandedChange={(next) => setSectionExpanded('dependent-required', next)}
                action={!isReadOnly ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      dependentRequired: [...prev.dependentRequired, { triggerProperty: '', requiredProperties: [] }]
                    }))}
                  >
                    <Plus size={14} className="mr-1" /> Add Rule
                  </Button>
                ) : undefined}
              >
                {formData.dependentRequired.length === 0 ? (
                  <FormEmptyState
                    icon={<ListChecks className="h-5 w-5" />}
                    title="No dependent required rules defined"
                    description="Add a rule to make additional properties required when a trigger property is present."
                  />
                ) : (
                  <div className="space-y-3">
                    {formData.dependentRequired.map((depReq, index) => (
                      <div key={index} className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 flex gap-3 items-end">
                        <div className="flex-1 flex flex-col md:flex-row gap-3">
                          <div className="flex-1 space-y-1">
                            <Label>Trigger Property</Label>
                            <Input
                              value={depReq.triggerProperty}
                              onChange={(e) => {
                                const newDeps = [...formData.dependentRequired];
                                newDeps[index] = { ...newDeps[index], triggerProperty: e.target.value };
                                setFormData(prev => ({ ...prev, dependentRequired: newDeps }));
                              }}
                              disabled={isReadOnly}
                              placeholder="e.g., billingAddress"
                            />
                          </div>
                          <div className="flex-1 space-y-1">
                            <Label>Required Properties (comma-separated)</Label>
                            <Input
                              value={depReq.requiredProperties.join(', ')}
                              onChange={(e) => {
                                const newDeps = [...formData.dependentRequired];
                                const props = e.target.value.split(',').map(p => p.trim()).filter(p => p);
                                newDeps[index] = { ...newDeps[index], requiredProperties: props };
                                setFormData(prev => ({ ...prev, dependentRequired: newDeps }));
                              }}
                              disabled={isReadOnly}
                              placeholder="e.g., billingCity, billingZip"
                            />
                          </div>
                        </div>
                        {!isReadOnly && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0 h-9 w-9"
                            onClick={() => {
                              const newDeps = formData.dependentRequired.filter((_, i) => i !== index);
                              setFormData(prev => ({ ...prev, dependentRequired: newDeps }));
                            }}
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </FormSection>
              )}

              {/* SECTION: Conditional Schema */}
              {(viewMode === 'advanced' || CLASS_WIZARD_STEPS[currentStepIndex].sections.includes('conditional')) && (
              <FormSection
                id="conditional"
                icon={<GitBranch size={16} />}
                eyebrow="Dynamic Properties"
                title="Conditional Schema"
                description="Apply branching validation rules using if / then / else."
                status={sectionStatus.conditional}
                collapsible={viewMode === 'advanced'}
                expanded={isSectionExpanded('conditional')}
                onExpandedChange={(next) => setSectionExpanded('conditional', next)}
              >
                <ConditionalSchemaBuilder
                  rules={formData.conditionalRules}
                  onChange={(rules) => setFormData(prev => ({ ...prev, conditionalRules: rules }))}
                  availableProperties={editingClassData?.properties?.map((p: any) => p.name) || []}
                  disabled={isReadOnly}
                  renderHeader={(addRule) => (
                    <div className="flex items-center justify-end mb-3">
                      <Button type="button" variant="outline" size="sm" onClick={addRule} disabled={isReadOnly}>
                        <Plus size={14} className="mr-1" /> Add Rule
                      </Button>
                    </div>
                  )}
                />
              </FormSection>
              )}

              {/* SECTION: Examples */}
              {(viewMode === 'advanced' || CLASS_WIZARD_STEPS[currentStepIndex].sections.includes('examples')) && (
              <FormSection
                id="examples"
                icon={<Code size={16} />}
                eyebrow="Documentation"
                title="Examples"
                description="Add example instances of this class schema (JSON format)."
                badge={<Badge variant="secondary" className="text-xs">JSON Schema</Badge>}
                status={sectionStatus.examples}
                collapsible={viewMode === 'advanced'}
                expanded={isSectionExpanded('examples')}
                onExpandedChange={(next) => setSectionExpanded('examples', next)}
              >
                <div className="space-y-2">
                      {formData.examples.map((example, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={example}
                            onChange={(e) => {
                              const newExamples = [...formData.examples];
                              newExamples[index] = e.target.value;
                              setFormData(prev => ({ ...prev, examples: newExamples }));
                            }}
                            placeholder='{"id": 1, "name": "Example"}'
                            disabled={isReadOnly}
                            className="font-mono text-sm"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const newExamples = formData.examples.filter((_, i) => i !== index);
                              setFormData(prev => ({ ...prev, examples: newExamples }));
                            }}
                            disabled={isReadOnly}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setFormData(prev => ({ ...prev, examples: [...prev.examples, ''] }))}
                        disabled={isReadOnly}
                      >
                        <Plus size={16} className="mr-1" /> Add Example
                      </Button>
                </div>
              </FormSection>
              )}

              {/* SECTION: XML Representation */}
              {(viewMode === 'advanced' || CLASS_WIZARD_STEPS[currentStepIndex].sections.includes('xml')) && (
              <FormSection
                id="xml"
                icon={<Code size={16} />}
                eyebrow="Documentation"
                title="XML Representation"
                description="Configure how this class is serialized to XML."
                badge={<Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">OpenAPI 3.1</Badge>}
                accent="orange"
                status={sectionStatus.xml}
                collapsible={viewMode === 'advanced'}
                expanded={isSectionExpanded('xml')}
                onExpandedChange={(next) => setSectionExpanded('xml', next)}
              >
                <FormGrid cols={3} gap="md">
                  <FormFieldGroup label="XML Name">
                    <Input
                      value={formData.xmlName}
                      onChange={(e) => setFormData(prev => ({ ...prev, xmlName: e.target.value }))}
                      placeholder="e.g., CustomName"
                      disabled={isReadOnly}
                    />
                  </FormFieldGroup>
                  <FormFieldGroup label="Namespace">
                    <Input
                      value={formData.xmlNamespace}
                      onChange={(e) => setFormData(prev => ({ ...prev, xmlNamespace: e.target.value }))}
                      placeholder="http://example.com/ns"
                      disabled={isReadOnly}
                    />
                  </FormFieldGroup>
                  <FormFieldGroup label="Prefix">
                    <Input
                      value={formData.xmlPrefix}
                      onChange={(e) => setFormData(prev => ({ ...prev, xmlPrefix: e.target.value }))}
                      placeholder="e.g., ns1"
                      disabled={isReadOnly}
                    />
                  </FormFieldGroup>
                </FormGrid>
              </FormSection>
              )}

              {/* SECTION: Schema Metadata */}
              {(viewMode === 'advanced' || CLASS_WIZARD_STEPS[currentStepIndex].sections.includes('schema-metadata')) && (
              <FormSection
                id="schema-metadata"
                icon={<FileText size={16} />}
                eyebrow="Documentation"
                title="Schema Metadata"
                description="Advanced schema identification and authoring metadata."
                badge={<Badge variant="secondary" className="text-xs">JSON Schema 2020-12</Badge>}
                status={sectionStatus['schema-metadata']}
                collapsible={viewMode === 'advanced'}
                expanded={isSectionExpanded('schema-metadata')}
                onExpandedChange={(next) => setSectionExpanded('schema-metadata', next)}
              >
                <FormFieldGroup label="$id" helper="Unique identifier URI for this schema">
                  <Input
                    value={formData.schemaId}
                    onChange={(e) => setFormData(prev => ({ ...prev, schemaId: e.target.value }))}
                    placeholder="https://example.com/schemas/myschema.json"
                    disabled={isReadOnly}
                  />
                </FormFieldGroup>
                <FormFieldGroup label="$anchor" helper="Define a reusable anchor within the schema">
                  <Input
                    value={formData.schemaAnchor}
                    onChange={(e) => setFormData(prev => ({ ...prev, schemaAnchor: e.target.value }))}
                    placeholder="e.g., myAnchor"
                    disabled={isReadOnly}
                  />
                </FormFieldGroup>
                <FormFieldGroup label="$comment" helper="Comments for schema authors (not shown to API consumers)">
                  <Textarea
                    value={formData.schemaComment}
                    onChange={(e) => setFormData(prev => ({ ...prev, schemaComment: e.target.value }))}
                    placeholder="Internal notes for schema authors..."
                    disabled={isReadOnly}
                    rows={2}
                  />
                </FormFieldGroup>
              </FormSection>
              )}

              {/* SECTION: External Documentation */}
              {(viewMode === 'advanced' || CLASS_WIZARD_STEPS[currentStepIndex].sections.includes('external-docs')) && (
              <FormSection
                id="external-docs"
                icon={<ExternalLink size={16} />}
                eyebrow="Documentation"
                title="External Documentation"
                description="Link out to human-readable docs, tutorials, or spec references."
                status={sectionStatus['external-docs']}
                collapsible={viewMode === 'advanced'}
                expanded={isSectionExpanded('external-docs')}
                onExpandedChange={(next) => setSectionExpanded('external-docs', next)}
              >
                <FormFieldGroup label="Documentation URL">
                  <Input
                    type="url"
                    value={formData.externalDocsUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, externalDocsUrl: e.target.value }))}
                    placeholder="https://docs.example.com/..."
                    disabled={isReadOnly}
                  />
                </FormFieldGroup>
                <FormFieldGroup label="Description">
                  <Textarea
                    value={formData.externalDocsDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, externalDocsDescription: e.target.value }))}
                    placeholder="Brief description of external docs"
                    disabled={isReadOnly}
                    rows={2}
                  />
                </FormFieldGroup>
              </FormSection>
              )}

              {/* SECTION: Custom Extensions */}
              {(viewMode === 'advanced' || CLASS_WIZARD_STEPS[currentStepIndex].sections.includes('extensions')) && (
              <FormSection
                id="extensions"
                icon={<Code size={16} />}
                eyebrow="Documentation"
                title="Custom Extensions"
                description="Add x- prefixed vendor extensions for tooling and codegen."
                status={sectionStatus.extensions}
                collapsible={viewMode === 'advanced'}
                expanded={isSectionExpanded('extensions')}
                onExpandedChange={(next) => setSectionExpanded('extensions', next)}
              >
                <ExtensionsEditor
                  value={formData.extensions}
                  onChange={(extensions) => setFormData(prev => ({ ...prev, extensions }))}
                  disabled={isReadOnly}
                />
              </FormSection>
              )}

              {/* Guided-mode wizard controls, rendered inside the scroll pane */}
              {viewMode === 'guided' && (
                <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 px-8 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
                  <FormWizardControls
                    currentIndex={currentStepIndex}
                    stepCount={CLASS_WIZARD_STEPS.length}
                    onBack={() => setCurrentStepIndex((i) => Math.max(0, i - 1))}
                    onNext={() => setCurrentStepIndex((i) => Math.min(CLASS_WIZARD_STEPS.length - 1, i + 1))}
                    onCancel={onClose}
                    onFinish={handleSave}
                    finishBusy={saving}
                    finishDisabled={isReadOnly || !formData.name.trim()}
                    finishLabel={editingClassData ? 'Save Changes' : 'Create Class'}
                  />
                </div>
              )}
              </div>

              {/* Right-side inspector: Validation, Live preview, Impact.
                  Hidden in guided mode where the wizard already provides
                  per-step focus, and yields to the sidekick when open. */}
              {viewMode === 'advanced' && !aiSidekickOpen && (
                <ClassEditInspector
                  className="w-72 max-w-[20rem] h-full"
                  issues={lintIssues}
                  previewJson={inspectorPreviewJson}
                  previewLanguage="JSON Schema"
                  previewLoading={loadingOpenApiDoc}
                  references={inspectorReferences}
                  onJumpToSection={(id) =>
                    scrollToSection(advancedScrollRef.current, id, 24)
                  }
                />
              )}

              <ClassEditAiSidekick
                open={aiSidekickOpen}
                onClose={() => setAiSidekickOpen(false)}
                messages={aiMessages}
                streamingContent={aiStreamingContent}
                loading={aiLoading}
                input={aiInput}
                onInputChange={setAiInput}
                onSend={handleAiSendMessage}
                onAbort={handleAiAbort}
                onReset={handleAiResetConversation}
                models={aiModels}
                loadingModels={aiLoadingModels}
                selectedModel={aiSelectedModel}
                onSelectModel={setAiSelectedModel}
                error={aiCreateError || undefined}
                extractClassDefinition={extractClassDefinition}
                patchStates={aiPatchStates}
                onApplyToForm={handleAiApplyToForm}
                onCreateClass={handleAiCreateClass}
                onRejectPatch={handleAiRejectPatch}
                canCreateClass={!editingClassData && !!versionId}
                isReadOnly={isReadOnly}
                isDark={isDark}
              />
            </div>
        </div>

        {/* Footer: only rendered in advanced mode. Guided mode keeps its
            wizard controls inline at the bottom of the scroll pane. */}
        {viewMode === 'advanced' && (
          <ClassEditFooter
            saving={saving}
            unsavedCount={unsavedCount}
            errorCount={errorCount}
            saveLabel={editingClassData ? 'Save changes' : 'Create class'}
            canSave={!isReadOnly && !!formData.name.trim() && errorCount === 0}
            onSave={handleSave}
            onClose={onClose}
            onDiscard={
              unsavedCount > 0 && !isReadOnly && !!savedSnapshotJson
                ? () => {
                    try {
                      const restored = JSON.parse(savedSnapshotJson);
                      setFormData(restored);
                    } catch {
                      /* swallow — snapshot was invalid */
                    }
                  }
                : undefined
            }
          />
        )}

        <ClassEditViewSheet
          open={viewSheetOpen}
          onClose={() => setViewSheetOpen(false)}
          openApiDoc={openApiDoc}
          loadingOpenApiDoc={loadingOpenApiDoc}
          className={previewClassData.name}
          initialFormat={viewSheetFormat}
          isDark={isDark}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ClassEditDialog;
