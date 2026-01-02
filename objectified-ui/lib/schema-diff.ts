/**
 * Schema diff utility for comparing OpenAPI schemas
 * Detects additions (green), removals (red), and modifications (yellow) in classes and properties
 */

export interface SchemaDiff {
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  path: string;
  itemType: 'schema' | 'property';
  oldValue?: any;
  newValue?: any;
  changes?: string[]; // List of what changed for modified items
}

export interface DiffSummary {
  added: SchemaDiff[];
  removed: SchemaDiff[];
  modified: SchemaDiff[];
  unchanged: SchemaDiff[];
}

/**
 * Compare two OpenAPI schemas and detect differences
 */
export function compareSchemas(spec1: any, spec2: any): DiffSummary {
  const diffs: SchemaDiff[] = [];

  // Parse specs if they're strings
  const schema1 = typeof spec1 === 'string' ? JSON.parse(spec1) : spec1;
  const schema2 = typeof spec2 === 'string' ? JSON.parse(spec2) : spec2;

  const schemas1 = schema1?.components?.schemas || {};
  const schemas2 = schema2?.components?.schemas || {};

  const allSchemaNames = new Set([...Object.keys(schemas1), ...Object.keys(schemas2)]);

  for (const schemaName of allSchemaNames) {
    const schema1Exists = schemaName in schemas1;
    const schema2Exists = schemaName in schemas2;

    if (!schema1Exists && schema2Exists) {
      // Schema added
      diffs.push({
        type: 'added',
        path: `schemas.${schemaName}`,
        itemType: 'schema',
        newValue: schemas2[schemaName]
      });

      // All properties in new schema are also added
      const properties = schemas2[schemaName]?.properties || {};
      for (const propName of Object.keys(properties)) {
        diffs.push({
          type: 'added',
          path: `schemas.${schemaName}.properties.${propName}`,
          itemType: 'property',
          newValue: properties[propName]
        });
      }
    } else if (schema1Exists && !schema2Exists) {
      // Schema removed
      diffs.push({
        type: 'removed',
        path: `schemas.${schemaName}`,
        itemType: 'schema',
        oldValue: schemas1[schemaName]
      });

      // All properties in removed schema are also removed
      const properties = schemas1[schemaName]?.properties || {};
      for (const propName of Object.keys(properties)) {
        diffs.push({
          type: 'removed',
          path: `schemas.${schemaName}.properties.${propName}`,
          itemType: 'property',
          oldValue: properties[propName]
        });
      }
    } else if (schema1Exists && schema2Exists) {
      // Schema exists in both - check for modifications
      const changes = compareSchemaObjects(schemas1[schemaName], schemas2[schemaName]);

      if (changes.length > 0) {
        diffs.push({
          type: 'modified',
          path: `schemas.${schemaName}`,
          itemType: 'schema',
          oldValue: schemas1[schemaName],
          newValue: schemas2[schemaName],
          changes
        });
      } else {
        diffs.push({
          type: 'unchanged',
          path: `schemas.${schemaName}`,
          itemType: 'schema',
          oldValue: schemas1[schemaName],
          newValue: schemas2[schemaName]
        });
      }

      // Compare properties
      const props1 = schemas1[schemaName]?.properties || {};
      const props2 = schemas2[schemaName]?.properties || {};
      const allPropNames = new Set([...Object.keys(props1), ...Object.keys(props2)]);

      for (const propName of allPropNames) {
        const prop1Exists = propName in props1;
        const prop2Exists = propName in props2;

        if (!prop1Exists && prop2Exists) {
          // Property added
          diffs.push({
            type: 'added',
            path: `schemas.${schemaName}.properties.${propName}`,
            itemType: 'property',
            newValue: props2[propName]
          });
        } else if (prop1Exists && !prop2Exists) {
          // Property removed
          diffs.push({
            type: 'removed',
            path: `schemas.${schemaName}.properties.${propName}`,
            itemType: 'property',
            oldValue: props1[propName]
          });
        } else if (prop1Exists && prop2Exists) {
          // Property exists in both - check for modifications
          const propChanges = comparePropertyObjects(props1[propName], props2[propName]);

          if (propChanges.length > 0) {
            diffs.push({
              type: 'modified',
              path: `schemas.${schemaName}.properties.${propName}`,
              itemType: 'property',
              oldValue: props1[propName],
              newValue: props2[propName],
              changes: propChanges
            });
          } else {
            diffs.push({
              type: 'unchanged',
              path: `schemas.${schemaName}.properties.${propName}`,
              itemType: 'property',
              oldValue: props1[propName],
              newValue: props2[propName]
            });
          }
        }
      }
    }
  }

  // Group by type
  const added = diffs.filter(d => d.type === 'added');
  const removed = diffs.filter(d => d.type === 'removed');
  const modified = diffs.filter(d => d.type === 'modified');
  const unchanged = diffs.filter(d => d.type === 'unchanged');

  return { added, removed, modified, unchanged };
}

/**
 * Compare two schema objects and return list of changes
 */
function compareSchemaObjects(obj1: any, obj2: any): string[] {
  const changes: string[] = [];

  // Compare description
  if (obj1.description !== obj2.description) {
    changes.push('description');
  }

  // Compare type
  if (obj1.type !== obj2.type) {
    changes.push('type');
  }

  // Compare required fields
  const req1 = JSON.stringify(obj1.required || []);
  const req2 = JSON.stringify(obj2.required || []);
  if (req1 !== req2) {
    changes.push('required');
  }

  // Compare allOf, anyOf, oneOf
  ['allOf', 'anyOf', 'oneOf'].forEach(key => {
    if (JSON.stringify(obj1[key]) !== JSON.stringify(obj2[key])) {
      changes.push(key);
    }
  });

  return changes;
}

/**
 * Compare two property objects and return list of changes
 */
function comparePropertyObjects(prop1: any, prop2: any): string[] {
  const changes: string[] = [];

  // Compare type
  if (JSON.stringify(prop1.type) !== JSON.stringify(prop2.type)) {
    changes.push('type');
  }

  // Compare description
  if (prop1.description !== prop2.description) {
    changes.push('description');
  }

  // Compare format
  if (prop1.format !== prop2.format) {
    changes.push('format');
  }

  // Compare $ref
  if (prop1.$ref !== prop2.$ref) {
    changes.push('$ref');
  }

  // Compare enum
  if (JSON.stringify(prop1.enum) !== JSON.stringify(prop2.enum)) {
    changes.push('enum');
  }

  // Compare items (for arrays)
  if (JSON.stringify(prop1.items) !== JSON.stringify(prop2.items)) {
    changes.push('items');
  }

  // Compare constraints
  ['minimum', 'maximum', 'minLength', 'maxLength', 'pattern', 'minItems', 'maxItems'].forEach(key => {
    if (prop1[key] !== prop2[key]) {
      changes.push(key);
    }
  });

  return changes;
}

/**
 * Get human-readable label for a path
 */
export function getPathLabel(path: string): string {
  const parts = path.split('.');
  if (parts[0] === 'schemas' && parts.length >= 2) {
    if (parts.length === 2) {
      return parts[1]; // Schema name
    } else if (parts.length >= 4 && parts[2] === 'properties') {
      return `${parts[1]}.${parts[3]}`; // Schema.Property
    }
  }
  return path;
}

/**
 * Format diff for display
 */
export function formatDiffSummary(summary: DiffSummary): string {
  const lines: string[] = [];

  lines.push(`Changes Summary:`);
  lines.push(`  Added: ${summary.added.length} items`);
  lines.push(`  Removed: ${summary.removed.length} items`);
  lines.push(`  Modified: ${summary.modified.length} items`);
  lines.push(``);

  if (summary.added.length > 0) {
    lines.push(`Added:`);
    summary.added.forEach(diff => {
      lines.push(`  + ${getPathLabel(diff.path)} (${diff.itemType})`);
    });
    lines.push(``);
  }

  if (summary.removed.length > 0) {
    lines.push(`Removed:`);
    summary.removed.forEach(diff => {
      lines.push(`  - ${getPathLabel(diff.path)} (${diff.itemType})`);
    });
    lines.push(``);
  }

  if (summary.modified.length > 0) {
    lines.push(`Modified:`);
    summary.modified.forEach(diff => {
      const changesList = diff.changes?.join(', ') || 'unknown';
      lines.push(`  ~ ${getPathLabel(diff.path)} (${diff.itemType}): ${changesList}`);
    });
  }

  return lines.join('\n');
}

