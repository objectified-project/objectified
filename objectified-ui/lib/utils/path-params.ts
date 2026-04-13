// Path parameter utility functions (client-safe)

/**
 * Extract parameter names from a path template
 * Example: '/v1/users/{userId}/groups/{groupId}' => ['userId', 'groupId']
 */
export function extractPathParameters(pathname: string): string[] {
  const regex = /\{([^}]+)\}/g;
  const matches: string[] = [];
  let match;

  while ((match = regex.exec(pathname)) !== null) {
    matches.push(match[1]);
  }

  return matches;
}

/**
 * Check if a pathname has parameters
 */
export function hasPathParameters(pathname: string): boolean {
  return /\{[^}]+\}/.test(pathname);
}

/**
 * Replace parameters in a pathname with values
 * Example: replacePath('/users/{userId}', { userId: '123' }) => '/users/123'
 */
export function replacePathParameters(
  pathname: string,
  values: Record<string, string>
): string {
  return pathname.replace(/\{([^}]+)\}/g, (match, paramName) => {
    return values[paramName] || match;
  });
}

/**
 * Generate a sample value for a path parameter based on schema (type/format).
 * Used for path template preview with sample values.
 */
export function getSampleValueForSchema(schema?: {
  type?: string;
  format?: string;
  enum?: unknown[];
} | null): string {
  if (!schema) return 'value';
  const type = (schema.type || 'string').toLowerCase();
  const format = (schema.format || '').toLowerCase();
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    const first = schema.enum[0];
    return String(typeof first === 'object' && first !== null && 'value' in first ? (first as { value: string }).value : first);
  }
  if (type === 'integer') return '1';
  if (type === 'number') return '1.0';
  if (type === 'boolean') return 'true';
  if (type === 'string') {
    if (format === 'uuid') return '550e8400-e29b-41d4-a716-446655440000';
    if (format === 'date') return '2025-01-15';
    if (format === 'date-time') return '2025-01-15T12:00:00Z';
    if (format === 'email') return 'user@example.com';
    if (format === 'uri') return 'https://example.com';
    if (format === 'hostname') return 'api.example.com';
    return 'value';
  }
  return 'value';
}

/**
 * Build a path with sample values for each path parameter.
 * paramSchemas: optional map of parameter name -> schema (type, format) for type-aware samples.
 */
export function getPathWithSampleValues(
  pathname: string,
  paramSchemas?: Record<string, { type?: string; format?: string; enum?: unknown[] } | null>
): { samplePath: string; values: Record<string, string> } {
  const paramNames = extractPathParameters(pathname);
  const values: Record<string, string> = {};
  for (const name of paramNames) {
    const schema = paramSchemas?.[name];
    values[name] = getSampleValueForSchema(schema ?? undefined);
  }
  return {
    samplePath: replacePathParameters(pathname, values),
    values,
  };
}

/**
 * Human-readable validation for OpenAPI path templates (leading slash, braces, unique `{param}` names).
 * Returns `null` when valid.
 */
export function getPathTemplateValidationError(pathname: string): string | null {
  const s = pathname.trim();
  if (s.length === 0) return 'Path cannot be empty.';
  if (s[0] !== '/') return 'Path must start with /.';
  if (/\{\s*\}/.test(s)) return 'Path parameters cannot be empty (use a name inside braces, e.g. {id}).';
  const open = (s.match(/\{/g) || []).length;
  const close = (s.match(/\}/g) || []).length;
  if (open !== close) return 'Curly braces { } are not balanced.';
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') depth--;
    if (depth < 0) return 'Invalid order of braces in the path template.';
  }
  if (depth !== 0) return 'Curly braces { } are not balanced.';

  const names = extractPathParameters(s);
  const seen = new Set<string>();
  for (const raw of names) {
    const name = raw.trim();
    if (name.length === 0) return 'Path parameter names cannot be empty.';
    if (seen.has(name)) {
      return `Duplicate path parameter name: {${name}}. Each template variable must be unique.`;
    }
    seen.add(name);
  }
  return null;
}

/**
 * Check if a path template is valid (OpenAPI-style).
 */
export function isValidPath(pathname: string): boolean {
  return getPathTemplateValidationError(pathname) === null;
}
