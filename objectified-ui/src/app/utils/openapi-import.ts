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
}

export interface OpenAPIParseResult {
  success: boolean;
  classes: ParsedClass[];
  error?: string;
  version?: string;
  title?: string;
  description?: string;
}

/**
 * Checks if a schema has inline object properties (not supported)
 */
function hasInlineObjectProperties(schema: any): boolean {
  if (!schema.properties) return false;

  for (const propName in schema.properties) {
    const prop = schema.properties[propName];

    // Check if property is an object type with inline properties
    if (prop.type === 'object' && prop.properties) {
      return true;
    }

    // Check arrays of objects with inline properties
    if (prop.type === 'array' && prop.items) {
      if (prop.items.type === 'object' && prop.items.properties) {
        return true;
      }
    }
  }

  return false;
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
        error: 'Only OpenAPI 3.x specifications are supported'
      };
    }

    // Extract components/schemas
    if (!spec.components || !spec.components.schemas) {
      return {
        success: false,
        classes: [],
        error: 'No schemas found in OpenAPI specification'
      };
    }

    const schemas = spec.components.schemas;
    const classes: ParsedClass[] = [];

    // Convert each schema to a class
    for (const schemaName in schemas) {
      const schema = schemas[schemaName];

      // Skip schemas with inline object properties
      if (hasInlineObjectProperties(schema)) {
        console.warn(`Skipping schema ${schemaName}: contains inline object properties`);
        continue;
      }

      const properties: ParsedProperty[] = [];
      const required = schema.required || [];

      // Extract properties
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
        selected: true // Default to selected
      });
    }

    if (classes.length === 0) {
      return {
        success: false,
        classes: [],
        error: 'No valid schemas found to import (inline object properties are not supported)'
      };
    }

    return {
      success: true,
      classes,
      version: spec.info?.version,
      title: spec.info?.title,
      description: spec.info?.description
    };
  } catch (error: any) {
    return {
      success: false,
      classes: [],
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

