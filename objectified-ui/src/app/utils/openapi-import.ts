/**
 * OpenAPI Import Utilities
 *
 * Handles parsing and validation of OpenAPI specifications for import
 * into the Objectified platform
 */

import * as yaml from 'js-yaml';

export interface ParsedProperty {
  name: string;
  data: any;
  description?: string;
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

interface InlineObjectInfo {
  propertyName: string;
  isArray: boolean;
  suggestedClassName: string;
}

/**
 * Generates a suggested class name for an inline object property
 */
function generateSuggestedClassName(parentClassName: string, propertyName: string): string {
  // Capitalize first letter of property name
  const capitalizedProp = propertyName.charAt(0).toUpperCase() + propertyName.slice(1);

  // Remove 's' suffix if property is plural (common pattern)
  const singularProp = capitalizedProp.endsWith('s') && capitalizedProp.length > 2
    ? capitalizedProp.slice(0, -1)
    : capitalizedProp;

  return `${parentClassName}${singularProp}`;
}

/**
 * Checks if a schema has inline object properties (not supported)
 * Returns detailed information about inline objects with suggested class names
 */
function findInlineObjectProperties(schema: any, className: string): InlineObjectInfo[] {
  const inlineObjects: InlineObjectInfo[] = [];

  if (!schema.properties) return inlineObjects;

  for (const propName in schema.properties) {
    const prop = schema.properties[propName];

    // Check if property is an object type with inline properties
    if (prop.type === 'object' && prop.properties) {
      inlineObjects.push({
        propertyName: propName,
        isArray: false,
        suggestedClassName: generateSuggestedClassName(className, propName)
      });
    }

    // Check arrays of objects with inline properties
    if (prop.type === 'array' && prop.items) {
      if (prop.items.type === 'object' && prop.items.properties) {
        inlineObjects.push({
          propertyName: propName,
          isArray: true,
          suggestedClassName: generateSuggestedClassName(className, propName)
        });
      }
    }
  }

  return inlineObjects;
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
 * Converts an OpenAPI schema property to a property data object
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

  return {
    name: propName,
    data,
    description
  };
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
      spec = yaml.load(specContent);
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

      // Check for inline object properties
      const inlineObjects = findInlineObjectProperties(schema, schemaName);
      if (inlineObjects.length > 0) {
        const propList = inlineObjects.map(obj =>
          obj.isArray ? `${obj.propertyName}[]` : obj.propertyName
        ).join(', ');

        const suggestions = inlineObjects.map(obj => {
          const refPath = `$ref: "#/components/schemas/${obj.suggestedClassName}"`;
          return `  • Extract "${obj.propertyName}" → Create "${obj.suggestedClassName}" class and use ${refPath}`;
        }).join('\n');

        warnings.push(
          `Contains inline object properties: ${propList}. ` +
          `These properties have nested object structures that are not supported.\n\n` +
          `💡 Suggested fix:\n${suggestions}`
        );
        isSupported = false;
      }

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
        error: 'No supported schemas found to import. All schemas have inline object properties or unresolved references.'
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

/**
 * Finds or creates properties across multiple classes, reusing identical properties
 */
export function consolidateProperties(classes: ParsedClass[]): Map<string, ParsedProperty> {
  const propertyMap = new Map<string, ParsedProperty>();

  for (const cls of classes) {
    if (!cls.selected) continue;

    for (const prop of cls.properties) {
      const key = JSON.stringify({ name: prop.name, data: prop.data });

      if (!propertyMap.has(key)) {
        propertyMap.set(key, prop);
      }
    }
  }

  return propertyMap;
}

