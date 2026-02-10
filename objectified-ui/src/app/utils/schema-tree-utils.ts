/**
 * Schema tree utilities for import preview (#576).
 * Builds a hierarchical view of schemas from $ref relationships.
 */

export interface SchemaTreeNode {
  name: string;
  children: SchemaTreeNode[];
}

/**
 * Extract all schema reference names from a schema object (recursive).
 * Handles $ref in properties, items, allOf, oneOf, anyOf, etc.
 */
export function extractSchemaReferences(schema: unknown): string[] {
  const refs: string[] = [];

  const findRefs = (obj: unknown) => {
    if (obj == null || typeof obj !== 'object') return;

    if (
      typeof obj === 'object' &&
      '$ref' in obj &&
      typeof (obj as { $ref: unknown }).$ref === 'string'
    ) {
      const ref = (obj as { $ref: string }).$ref;
      const refName = ref.split('/').pop();
      if (refName && !refs.includes(refName)) {
        refs.push(refName);
      }
    }

    for (const key in obj as Record<string, unknown>) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        findRefs((obj as Record<string, unknown>)[key]);
      }
    }
  };

  findRefs(schema);
  return refs;
}

/**
 * Build a forest of schema trees. Each root is a schema name; children are
 * schemas it references via $ref. Cycles are avoided per path.
 */
export function buildSchemaTree(
  schemaObj: Record<string, unknown>,
  schemaNames: string[],
  nameFilter?: (name: string) => boolean
): SchemaTreeNode[] {
  const nameSet = new Set(schemaNames);
  const roots = nameFilter ? schemaNames.filter(nameFilter) : schemaNames;

  function buildNode(schemaName: string, path: Set<string>): SchemaTreeNode {
    const schema = schemaObj[schemaName];
    const refs = schema ? extractSchemaReferences(schema) : [];
    const childRefs = refs.filter((r) => nameSet.has(r) && !path.has(r));
    const childPath = new Set(path);
    childPath.add(schemaName);
    const children = childRefs.map((refName) => buildNode(refName, childPath));
    return { name: schemaName, children };
  }

  return roots.map((name) => buildNode(name, new Set()));
}

/**
 * Schema selection info for dependency resolution (#579).
 * Used to determine if a schema can be deselected (not referenced by others).
 */
export interface SchemaSelectionInfo {
  name: string;
  selected: boolean;
  exists: boolean;
}

/**
 * Get all schema names that the given schema references (transitively),
 * only from schemaObj. Used for auto-selecting dependencies on import (#579).
 */
export function getTransitiveDependencies(
  schemaName: string,
  schemaObj: Record<string, unknown>,
  visited = new Set<string>()
): string[] {
  if (visited.has(schemaName)) return [];
  visited.add(schemaName);
  const schema = schemaObj[schemaName];
  if (!schema) return [];
  const refs = extractSchemaReferences(schema);
  const result: string[] = [];
  for (const ref of refs) {
    if (schemaObj[ref]) {
      if (!visited.has(ref)) {
        result.push(ref);
        result.push(...getTransitiveDependencies(ref, schemaObj, visited));
      }
    }
  }
  return [...new Set(result)];
}

/**
 * True if any other selected (non-existing) schema references schemaName.
 * Used to prevent deselecting schemas that are required by others (#579).
 */
export function isReferencedBySelectedSchemas(
  schemaName: string,
  schemas: SchemaSelectionInfo[],
  schemaObj: Record<string, unknown>
): boolean {
  const selectedNames = schemas.filter((s) => s.selected && !s.exists).map((s) => s.name);
  for (const name of selectedNames) {
    if (name === schemaName) continue;
    const refs = extractSchemaReferences(schemaObj[name] ?? {});
    if (refs.includes(schemaName)) return true;
  }
  return false;
}

/** Schema type for filtering (#580). Composition takes precedence over JSON Schema type. */
export type SchemaDisplayType =
  | 'object'
  | 'array'
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'allOf'
  | 'oneOf'
  | 'anyOf'
  | 'enum'
  | 'null'
  | 'unknown';

/**
 * Derive a display type from a schema for search/filter (#580).
 * Composition (allOf/oneOf/anyOf) takes precedence; then enum; then type.
 */
export function getSchemaType(schema: unknown): SchemaDisplayType {
  if (schema == null || typeof schema !== 'object') return 'unknown';
  const s = schema as Record<string, unknown>;
  if (Array.isArray(s.allOf) && s.allOf.length > 0) return 'allOf';
  if (Array.isArray(s.oneOf) && s.oneOf.length > 0) return 'oneOf';
  if (Array.isArray(s.anyOf) && s.anyOf.length > 0) return 'anyOf';
  if (Array.isArray(s.enum) && s.enum.length > 0) return 'enum';
  const t = s.type;
  if (t === 'object' || t === 'array' || t === 'string' || t === 'number' || t === 'integer' || t === 'boolean' || t === 'null') {
    return t as SchemaDisplayType;
  }
  if (s.properties && typeof s.properties === 'object') return 'object';
  return 'unknown';
}

/**
 * Extract tags from a schema for search/filter (#580).
 * Supports x-tags (array), x-tag (string), and tags (array).
 */
export function getSchemaTags(schema: unknown): string[] {
  if (schema == null || typeof schema !== 'object') return [];
  const s = schema as Record<string, unknown>;
  const out: string[] = [];
  if (Array.isArray(s['x-tags'])) {
    s['x-tags'].forEach((v) => {
      if (typeof v === 'string' && v.trim()) out.push(v.trim());
    });
  }
  if (typeof s['x-tag'] === 'string' && s['x-tag'].trim()) {
    out.push((s['x-tag'] as string).trim());
  }
  if (Array.isArray(s.tags)) {
    s.tags.forEach((v) => {
      if (typeof v === 'string' && v.trim()) out.push(v.trim());
    });
  }
  return [...new Set(out)];
}
