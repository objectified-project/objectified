/**
 * OpenAPI Version Configuration
 *
 * This file manages OpenAPI specification versions and their corresponding templates.
 * Update this configuration when upgrading to newer OpenAPI versions.
 */

export interface OpenAPIVersion {
  version: string;
  templateFile: string;
  description: string;
  supportedFeatures: string[];
}

/**
 * Available OpenAPI versions and their configurations
 */
export const OPENAPI_VERSIONS: Record<string, OpenAPIVersion> = {
  '3.1.0': {
    version: '3.1.0',
    templateFile: 'openapi/openapi-spec.hbs',
    description: 'OpenAPI 3.1.0 specification (JSON Schema 2020-12 compatible)',
    supportedFeatures: [
      'JSON Schema 2020-12',
      'Webhooks',
      'Schema composition (allOf, anyOf, oneOf)',
      'Nested properties',
      'Full JSON Schema vocabulary'
    ]
  },
  // Add future versions here as they become available
  // '3.2.0': {
  //   version: '3.2.0',
  //   templateFile: 'openapi-3.2.0-spec.hbs',
  //   description: 'OpenAPI 3.2.0 specification',
  //   supportedFeatures: [...]
  // }
};

/**
 * Default OpenAPI version to use
 */
export const DEFAULT_OPENAPI_VERSION = '3.1.0';

/**
 * Get configuration for a specific OpenAPI version
 */
export function getOpenAPIVersionConfig(version?: string): OpenAPIVersion {
  const targetVersion = version || DEFAULT_OPENAPI_VERSION;
  const config = OPENAPI_VERSIONS[targetVersion];

  if (!config) {
    throw new Error(`Unsupported OpenAPI version: ${targetVersion}. Supported versions: ${Object.keys(OPENAPI_VERSIONS).join(', ')}`);
  }

  return config;
}

