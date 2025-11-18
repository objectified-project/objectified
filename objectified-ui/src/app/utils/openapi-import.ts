/**
 * OpenAPI Import Utilities
 *
 * Handles parsing and validation of OpenAPI specifications for import
 * into the Objectified platform
 */

import YAML from 'yaml';

export interface ParsedProperty {
  name: string;
  data: any;
  description?: string;
  children?: ParsedProperty[]; // For nested properties
}

export interface ParsedClass {
  name: string;
  description?: string;
  properties: ParsedProperty[];
  selected: boolean;
  warnings: string[];
  isSupported: boolean;
}

export interface OpenAPIParseResult {
  success: boolean;
  classes: ParsedClass[];
  error?: string;
  warnings: string[];
  version?: string;
  title?: string;
  description?: string;
}

/**
 * Extracts all $ref references from a schema
 */
function extractReferences(obj: any, refs: Set<string> = new Set()): Set<string> {
  if (!obj || typeof obj !== 'object') return refs;

  if (obj.$ref && typeof obj.$ref === 'string') {
    // Extract the schema name from the $ref path
    const match = obj.$ref.match(/#\/components\/schemas\/(.+)/);
    if (match) {
      refs.add(match[1]);
    }
  }

  // Recursively check nested objects and arrays
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      extractReferences(obj[key], refs);
    }
  }

  return refs;
}

/**
 * Finds unresolved $ref references in a schema
 */
function findUnresolvedReferences(schema: any, allSchemaNames: Set<string>): string[] {
  const refs = extractReferences(schema);
  const unresolved: string[] = [];

  for (const ref of refs) {
    if (!allSchemaNames.has(ref)) {
      unresolved.push(ref);
    }
  }

  return unresolved;
}

/**
 * Converts an OpenAPI schema property to a property data object with nested children
 */
function convertSchemaProperty(propName: string, propSchema: any, required: string[] = []): ParsedProperty {
  const data: any = { ...propSchema };

  // Remove description from data (it's stored separately)
  const description = data.description;
  delete data.description;

  // Handle required flag
  if (required.includes(propName)) {
    data.required = true;
  }

  const result: ParsedProperty = {
    name: propName,
    data,
    description
  };

  // Handle inline object properties with nested properties
  if (propSchema.type === 'object' && propSchema.properties) {
    const nestedRequired = propSchema.required || [];
    const children: ParsedProperty[] = [];

    // Remove properties and required from data (they'll be stored as children)
    delete data.properties;
    delete data.required;

    // Recursively convert nested properties
    for (const childName in propSchema.properties) {
      const childSchema = propSchema.properties[childName];
      children.push(convertSchemaProperty(childName, childSchema, nestedRequired));
    }

    result.children = children;
  }

  // Handle arrays of objects with inline properties
  if (propSchema.type === 'array' && propSchema.items?.type === 'object' && propSchema.items.properties) {
    const nestedRequired = propSchema.items.required || [];
    const children: ParsedProperty[] = [];

    // Remove properties and required from items in data
    const items = { ...propSchema.items };
    delete items.properties;
    delete items.required;
    data.items = items;

    // Recursively convert nested properties from items
    for (const childName in propSchema.items.properties) {
      const childSchema = propSchema.items.properties[childName];
      children.push(convertSchemaProperty(childName, childSchema, nestedRequired));
    }

    result.children = children;
  }

  return result;
}

/**
 * Parses an OpenAPI specification and extracts classes/schemas
 */
export function parseOpenAPISpec(specContent: string): OpenAPIParseResult {
  try {
    let spec: any;

    // Try to parse as JSON first, then YAML
    try {
      spec = JSON.parse(specContent);
    } catch {
      // If JSON parsing fails, try YAML
      spec = YAML.parse(specContent);
    }

    // Validate OpenAPI version
    if (!spec.openapi || !spec.openapi.startsWith('3.')) {
      return {
        success: false,
        classes: [],
        warnings: [],
        error: 'Only OpenAPI 3.x specifications are supported'
      };
    }

    // Extract components/schemas
    if (!spec.components || !spec.components.schemas) {
      return {
        success: false,
        classes: [],
        warnings: [],
        error: 'No schemas found in OpenAPI specification'
      };
    }

    const schemas = spec.components.schemas;
    const classes: ParsedClass[] = [];
    const globalWarnings: string[] = [];

    // Get all schema names for reference validation
    const allSchemaNames = new Set(Object.keys(schemas));

    // Convert each schema to a class
    for (const schemaName in schemas) {
      const schema = schemas[schemaName];
      const warnings: string[] = [];
      let isSupported = true;


      // Check for unresolved $ref references
      const unresolvedRefs = findUnresolvedReferences(schema, allSchemaNames);
      if (unresolvedRefs.length > 0) {
        warnings.push(
          `References undefined schemas: ${unresolvedRefs.join(', ')}. ` +
          `These referenced schemas do not exist in the specification.`
        );
        isSupported = false;
      }

      const properties: ParsedProperty[] = [];
      const required = schema.required || [];

      // Extract properties (even for unsupported classes, for display purposes)
      if (schema.properties) {
        for (const propName in schema.properties) {
          const propSchema = schema.properties[propName];
          properties.push(convertSchemaProperty(propName, propSchema, required));
        }
      }

      classes.push({
        name: schemaName,
        description: schema.description,
        properties,
        selected: isSupported, // Only select supported classes by default
        warnings,
        isSupported
      });

      // Add to global warnings if unsupported
      if (!isSupported) {
        globalWarnings.push(`${schemaName}: ${warnings.join(' ')}`);
      }
    }

    const supportedClasses = classes.filter(c => c.isSupported);

    if (supportedClasses.length === 0) {
      return {
        success: false,
        classes: [],
        warnings: globalWarnings,
        error: 'No supported schemas found to import. All schemas have unresolved references.'
      };
    }

    return {
      success: true,
      classes,
      warnings: globalWarnings,
      version: spec.info?.version,
      title: spec.info?.title,
      description: spec.info?.description
    };
  } catch (error: any) {
    return {
      success: false,
      classes: [],
      warnings: [],
      error: `Failed to parse OpenAPI specification: ${error.message}`
    };
  }
}

/**
 * Validates that imported classes don't have duplicate property names
 */
export function validateImportedClasses(classes: ParsedClass[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const cls of classes) {
    if (!cls.selected) continue;

    const propNames = new Set<string>();
    for (const prop of cls.properties) {
      if (propNames.has(prop.name)) {
        errors.push(`Class "${cls.name}" has duplicate property: ${prop.name}`);
      }
      propNames.add(prop.name);
    }

    if (cls.properties.length === 0) {
      errors.push(`Class "${cls.name}" has no properties`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
