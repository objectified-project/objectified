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

