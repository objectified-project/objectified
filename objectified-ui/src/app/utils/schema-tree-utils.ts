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
