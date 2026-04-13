/**
 * Surface-level validation for OpenAPI ParameterObject `name` by `in` location.
 * Reduces illegal exports without claiming full HTTP stack compliance.
 */

export type ParameterInLocation = 'path' | 'query' | 'header' | 'cookie';

/**
 * @returns An error message if invalid, or `null` if the name is acceptable.
 */
export function validateOpenApiParameterName(
  name: string,
  inLocation: ParameterInLocation
): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Name is required.';
  }

  if (inLocation === 'path') {
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      return 'Path parameter names may only contain letters, digits, and underscores.';
    }
    return null;
  }

  if (inLocation === 'query') {
    if (!/^[a-zA-Z0-9._~-]+$/.test(trimmed)) {
      return 'Query parameter names may only contain letters, digits, and . _ ~ - (no spaces).';
    }
    return null;
  }

  if (inLocation === 'header') {
    // HTTP field-name `token` (RFC 9110): visible ASCII except separators — common safe subset
    if (!/^[!#$%&'*+.^_`|~A-Za-z0-9-]+$/.test(trimmed)) {
      return 'Header names must be valid HTTP field names (no spaces). Examples: Authorization, X-Request-ID.';
    }
    return null;
  }

  if (inLocation === 'cookie') {
    if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(trimmed)) {
      return 'Cookie names must use allowed token characters. Browser cookie rules can differ; this checks OpenAPI-safe naming.';
    }
    return null;
  }

  return null;
}
