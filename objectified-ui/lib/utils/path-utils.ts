/**
 * Generate an operation ID from path and operation verb
 * e.g., "/api/users" + "GET" = "getApiUsers"
 */
export function generateOperationId(pathname: string, operation: string): string {
  // Remove leading/trailing slashes and split by /
  const pathParts = pathname
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(part => part.length > 0);

  // Convert to camelCase
  const camelCasePath = pathParts
    .map((part, index) => {
      // Remove special characters and replace with nothing
      const cleaned = part.replace(/[^a-zA-Z0-9]/g, '');
      // Capitalize first letter except for first part
      return index === 0
        ? cleaned.toLowerCase()
        : cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
    })
    .join('');

  // Prepend the operation verb in lowercase
  return operation.toLowerCase() + camelCasePath.charAt(0).toUpperCase() + camelCasePath.slice(1);
}

