/**
 * Utilities for building insert form state from JSON Schema (class_schema).
 * Used by the database insert modal to derive initial form data, property types, enum, pattern, and money detection.
 */

export type SchemaProperty = Record<string, unknown>;

export function getPropertyType(propSchema: SchemaProperty): string {
  const t = propSchema.type;
  if (typeof t === 'string') return t;
  if (Array.isArray(t) && t.length > 0) {
    const first = t.find((x) => x !== 'null');
    return typeof first === 'string' ? first : 'string';
  }
  return 'string';
}

export function getEnumOptions(propSchema: SchemaProperty): unknown[] {
  const e = propSchema.enum;
  return Array.isArray(e) ? e : [];
}

export function getPattern(propSchema: SchemaProperty): string | undefined {
  const p = propSchema.pattern;
  return typeof p === 'string' ? p : undefined;
}

export function isMoneyField(propSchema: SchemaProperty, key: string): boolean {
  const format = (propSchema.format as string) || '';
  const keyLower = key.toLowerCase();
  const moneyFormats = ['currency', 'amount', 'money'];
  const moneyKeys = ['price', 'amount', 'cost', 'money', 'currency', 'total', 'subtotal', 'fee'];
  return (
    moneyFormats.some((f) => format.toLowerCase().includes(f)) ||
    moneyKeys.some((k) => keyLower.includes(k))
  );
}

/**
 * Build initial form data from a JSON Schema (e.g. class_schema.schema).
 * Uses default or const when present; otherwise empty value by type.
 * Deep-clones object/array defaults so form state is independent.
 */
export function getInitialFormData(schema: Record<string, unknown>): Record<string, unknown> {
  const props = schema.properties as Record<string, SchemaProperty> | undefined;
  if (!props || typeof props !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [key, propSchema] of Object.entries(props)) {
    if (typeof propSchema !== 'object' || propSchema === null) continue;
    const def = propSchema.default !== undefined ? propSchema.default : propSchema.const;
    if (def !== undefined) {
      out[key] =
        typeof def === 'object' && def !== null
          ? JSON.parse(JSON.stringify(def))
          : def;
      continue;
    }
    const type = getPropertyType(propSchema);
    if (type === 'string') out[key] = '';
    else if (type === 'number' || type === 'integer') out[key] = undefined;
    else if (type === 'boolean') out[key] = false;
    else if (type === 'array') out[key] = [];
    else if (type === 'object') out[key] = {};
    else out[key] = '';
  }
  return out;
}

export function getOrderedPropertyEntries(
  schema: Record<string, unknown>
): [string, SchemaProperty][] {
  const props = schema.properties as Record<string, SchemaProperty> | undefined;
  if (!props || typeof props !== 'object') return [];
  return Object.entries(props).filter(
    (entry): entry is [string, SchemaProperty] =>
      typeof entry[1] === 'object' && entry[1] !== null
  );
}
