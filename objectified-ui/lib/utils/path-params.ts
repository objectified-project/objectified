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
 * Check if a path template is valid (OpenAPI-style).
 * Invalid: empty/whitespace, does not start with /, unclosed or empty braces.
 */
export function isValidPath(pathname: string): boolean {
  const s = pathname.trim();
  if (s.length === 0) return false;
  if (s[0] !== '/') return false;
  // Reject empty parameter {}
  if (/\{\s*\}/.test(s)) return false;
  // Unclosed brace: count { and }
  const open = (s.match(/\{/g) || []).length;
  const close = (s.match(/\}/g) || []).length;
  if (open !== close) return false;
  // No } before a matching {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}
