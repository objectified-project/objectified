/**
 * Validate a data payload against a JSON Schema (e.g. class_schema.schema).
 * Uses Ajv with JSON Schema 2020-12 support.
 */

import Ajv, { type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';

export interface ValidationResult {
  valid: boolean;
  errors?: Array<{ path?: string; message: string }>;
}

function getDefaultAjv(): Ajv {
  const ajv = new Ajv({ strictSchema: false });
  addFormats(ajv);
  return ajv;
}

/**
 * Validate payload against a JSON Schema (draft 2020-12 supported).
 */
export function validatePayloadAgainstSchema(
  payload: unknown,
  schema: object
): ValidationResult {
  const ajv = getDefaultAjv();
  try {
    const validate = ajv.compile(schema);
    const valid = validate(payload);
    if (valid) {
      return { valid: true };
    }
    const errors: Array<{ path?: string; message: string }> = (validate.errors ?? []).map(
      (err: ErrorObject) => ({
        path: err.instancePath || (err.params?.propertyName ?? undefined),
        message: err.message ?? 'Validation failed',
      })
    );
    return { valid: false, errors };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Schema compilation failed';
    return { valid: false, errors: [{ message }] };
  }
}
