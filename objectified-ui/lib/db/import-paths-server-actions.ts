'use server';

import type { ParsedPath, ParsedSecurityScheme } from '@/app/utils/openapi-import';
import { importPathsFromOpenAPIForVersion as runImportPathsFromOpenAPIForVersion } from 'objectified-importer/server';

export async function importPathsFromOpenAPIForVersion(
  versionId: string,
  paths: ParsedPath[],
  securitySchemes: ParsedSecurityScheme[]
): Promise<{ success: boolean; error?: string }> {
  return runImportPathsFromOpenAPIForVersion(versionId, paths, securitySchemes);
}
