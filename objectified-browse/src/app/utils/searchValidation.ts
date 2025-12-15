/**
 * Search input validation utilities
 * Prevents injection attacks by restricting search input to safe characters
 */

// Regex pattern for valid search characters: alphanumeric, whitespace, dash, underscore
export const SAFE_SEARCH_PATTERN = /^[0-9A-Za-z\s\-_]*$/;

// HTML pattern attribute value (without the anchors, as pattern attribute auto-wraps)
export const SAFE_SEARCH_HTML_PATTERN = '[0-9A-Za-z\\s\\-_]*';

/**
 * Validates if a search string contains only safe characters
 * @param value - The search string to validate
 * @returns true if the string is safe, false otherwise
 */
export function isValidSearchInput(value: string): boolean {
  return SAFE_SEARCH_PATTERN.test(value);
}

/**
 * Sanitizes a search string by removing unsafe characters
 * @param value - The search string to sanitize
 * @returns The sanitized string with only safe characters
 */
export function sanitizeSearchInput(value: string): string {
  return value.replace(/[^0-9A-Za-z\s\-_]/g, '');
}

