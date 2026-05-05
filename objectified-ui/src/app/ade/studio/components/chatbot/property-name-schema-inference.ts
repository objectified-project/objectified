/**
 * JSON Schema shape hints from common property names (#277).
 * Used when chat refinement adds a property without an explicit type.
 */

export type InferredPropertySchema = Record<string, unknown>;

/**
 * Returns schema fields (type, format, minimum, etc.) inferred from `propertyName`,
 * or an empty object when nothing matches. Matching is case-insensitive on the
 * trimmed name for the known identifiers below.
 */
export function inferSchemaShapeFromPropertyName(propertyName: string): InferredPropertySchema {
  const key = propertyName.trim().toLowerCase();
  switch (key) {
    case 'email':
      return { type: 'string', format: 'email' };
    case 'createdat':
      return { type: 'string', format: 'date-time' };
    case 'age':
      return { type: 'integer', minimum: 0 };
    case 'price':
      return { type: 'number', minimum: 0 };
    case 'isactive':
      return { type: 'boolean' };
    default:
      return {};
  }
}
