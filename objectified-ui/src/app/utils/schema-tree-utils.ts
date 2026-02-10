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
