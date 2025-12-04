/**
 * JSON Schema Generator Utilities
 *
 * Generates JSON Schema (Draft 2020-12) documents from class definitions.
 * JSON Schema is a vocabulary that allows you to annotate and validate JSON documents.
 */

import { buildClassSchema } from './openapi';

/**
 * Generates a JSON Schema document from class definitions
 * @param classes - Array of class data objects with properties
 * @param options - Optional metadata for the schema
 * @returns JSON Schema document as a JSON string
 */
export function generateJsonSchema(
  classes: any[],
  options?: {
    projectName?: string;
    version?: string;
    description?: string;
  }
): string {
  const definitions: any = {};

  // Build schema for each class using the same logic as OpenAPI
  // JSON Schema uses $defs instead of components/schemas for definitions
  classes.forEach((cls) => {
    definitions[cls.name] = buildClassSchema(cls);
  });

  const jsonSchemaDoc = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://example.com/${options?.projectName?.toLowerCase().replace(/\s+/g, '-') || 'schema'}.json`,
    title: options?.projectName || 'JSON Schema',
    description: options?.description || `Generated JSON Schema from Objectified Studio - Version ${options?.version || '1.0.0'}`,
    type: 'object',
    $defs: definitions
  };

  return JSON.stringify(jsonSchemaDoc, null, 2);
}

