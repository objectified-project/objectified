import type { PropertyFormData } from '@/app/components/ade/studio/PropertyFormFields';

/**
 * Normalizes LLM output into a single plain-text property description (#619).
 */
export function normalizeGeneratedPropertyDescription(raw: string): string {
  let t = raw.trim();
  if (!t) return '';
  const fenceWrapped = /^```[a-zA-Z]*\n?([\s\S]*?)\n?```$/;
  const m = t.match(fenceWrapped);
  if (m) t = m[1].trim();
  t = t.replace(/^#{1,6}\s+/gm, '').replace(/\*\*([^*]+)\*\*/g, '$1');
  const firstBlock = t.split(/\n\n+/)[0] ?? t;
  return firstBlock.replace(/\s+/g, ' ').trim().slice(0, 4000);
}

const DESCRIPTION_SCHEMA_KEYS = [
  'type',
  'format',
  'pattern',
  '$ref',
  'items',
  'enum',
  'const',
  'additionalProperties',
  'properties',
  'required',
  'oneOf',
  'anyOf',
  'allOf',
  'prefixItems',
  'tupleMode',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minItems',
  'maxItems',
  'uniqueItems',
  'nullable',
  'description',
  'title',
  'deprecated',
  'readOnly',
  'writeOnly',
] as const;

function truncateDeep(value: unknown, depth: number): unknown {
  if (depth <= 0) return '[…]';
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const cap = 12;
    const slice = value.slice(0, cap).map((x) => truncateDeep(x, depth - 1));
    return value.length > cap ? [...slice, `… +${value.length - cap} more`] : slice;
  }
  const o = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(o)) {
    out[k] = truncateDeep(o[k], depth - 1);
  }
  return out;
}

/**
 * Reduces persisted property `data` JSON for prompt size while keeping type semantics.
 */
export function summarizeStoredPropertyData(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const src = data as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of DESCRIPTION_SCHEMA_KEYS) {
    if (!(k in src)) continue;
    out[k] = truncateDeep(src[k], 3);
  }
  if (Object.keys(out).length > 0) return out;
  return truncateDeep(src, 2) as Record<string, unknown>;
}

type SeedPropertyLike = {
  $ref?: string;
  items?: { $ref?: string; type?: string };
  type?: string | string[];
} | null;

/**
 * Builds a compact JSON Schema snapshot from the property dialog form for AI description (#619).
 */
export function draftPropertySchemaFromDialogForm(input: {
  propertyType: string;
  propertyIsArray: boolean;
  formData: PropertyFormData;
  seedProperty: SeedPropertyLike;
}): Record<string, unknown> {
  const { propertyType, propertyIsArray, formData, seedProperty } = input;

  const valueHints = (): Record<string, unknown> => {
    const o: Record<string, unknown> = {};
    if (formData.format?.trim()) o.format = formData.format.trim();
    if (formData.pattern?.trim()) o.pattern = formData.pattern.trim();
    if (formData.enum && formData.enum.length > 0) o.enum = formData.enum.slice(0, 24);
    if (formData.minLength?.trim()) {
      const n = Number.parseInt(formData.minLength, 10);
      if (!Number.isNaN(n)) o.minLength = n;
    }
    if (formData.maxLength?.trim()) {
      const n = Number.parseInt(formData.maxLength, 10);
      if (!Number.isNaN(n)) o.maxLength = n;
    }
    if (formData.minimum?.trim()) {
      const n = Number.parseFloat(formData.minimum);
      if (!Number.isNaN(n)) {
        if (formData.minimumType === 'exclusive') o.exclusiveMinimum = n;
        else o.minimum = n;
      }
    }
    if (formData.maximum?.trim()) {
      const n = Number.parseFloat(formData.maximum);
      if (!Number.isNaN(n)) {
        if (formData.maximumType === 'exclusive') o.exclusiveMaximum = n;
        else o.maximum = n;
      }
    }
    return o;
  };

  const arrayHints = (): Record<string, unknown> => {
    const o: Record<string, unknown> = {};
    if (formData.minItems?.trim()) {
      const n = Number.parseInt(formData.minItems, 10);
      if (!Number.isNaN(n)) o.minItems = n;
    }
    if (formData.maxItems?.trim()) {
      const n = Number.parseInt(formData.maxItems, 10);
      if (!Number.isNaN(n)) o.maxItems = n;
    }
    if (formData.uniqueItems) o.uniqueItems = true;
    if (formData.tupleMode && formData.prefixItems?.length) {
      o.prefixItems = truncateDeep(formData.prefixItems, 3);
      o.tupleMode = true;
    }
    return o;
  };

  if (propertyType === '$ref') {
    const ref =
      (seedProperty && typeof seedProperty.$ref === 'string' && seedProperty.$ref) ||
      (seedProperty?.items && typeof seedProperty.items.$ref === 'string' && seedProperty.items.$ref) ||
      '';
    if (propertyIsArray) {
      return {
        type: 'array',
        items: ref ? { $ref: ref, ...valueHints() } : { type: 'object', ...valueHints() },
        ...arrayHints(),
      };
    }
    return ref ? { $ref: ref, ...valueHints() } : { type: 'object', ...valueHints() };
  }

  const nullable = Boolean(formData.nullable);
  const itemType = propertyType || 'string';

  const elementSchema = (): Record<string, unknown> => {
    const base = valueHints();
    if (nullable) return { type: [itemType, 'null'], ...base };
    return { type: itemType, ...base };
  };

  if (propertyIsArray) {
    return {
      type: 'array',
      items: elementSchema(),
      ...arrayHints(),
    };
  }

  return elementSchema();
}
