import { getClassesWithPropertiesAndTags } from '../../../../../../lib/db/helper';
import { loadPathsForOpenAPIExport } from '../../../../../../lib/db/helper-paths-export';
import {
  getSecuritySchemesForVersion,
  securitySchemesToOpenAPI,
} from '../../../../../../lib/db/helper-security-schemes';
import { getServersForVersion, serversToOpenAPI } from '../../../../../../lib/db/helper-version-servers';
import { generatePathsForOpenAPI, type PathInfo } from '../../../../../../lib/utils/openapi-paths-generator';
import { generateOpenApiSpec } from '@/app/utils/openapi';

export interface PathsCodeSpecResult {
  pathsObject: Record<string, unknown>;
  mergedSpecJson: string;
}

/**
 * Loads the OpenAPI `paths` object and the full merged spec (paths + components/schemas)
 * for the Paths Code view (#2654). Mirrors Studio Code tab data sources.
 */
export async function loadPathsCodeSpec(options: {
  versionId: string;
  projectName: string;
  versionLabel: string;
  versionDescription: string;
}): Promise<PathsCodeSpecResult> {
  const { versionId, projectName, versionLabel, versionDescription } = options;

  const classesRaw = await getClassesWithPropertiesAndTags(versionId);
  const classesWithProperties = JSON.parse(classesRaw);

  let pathsObject: Record<string, unknown> = {};
  try {
    const pathsResult = await loadPathsForOpenAPIExport(versionId);
    const pathsData = JSON.parse(pathsResult);
    if (pathsData.success && pathsData.paths && pathsData.paths.length > 0) {
      pathsObject = generatePathsForOpenAPI(pathsData.paths as PathInfo[]) as Record<string, unknown>;
    }
  } catch {
    /* keep empty paths */
  }

  let securitySchemes: Record<string, unknown> = {};
  try {
    const schemes = await getSecuritySchemesForVersion(versionId);
    if (schemes.length > 0) {
      securitySchemes = (await securitySchemesToOpenAPI(schemes)) as Record<string, unknown>;
    }
  } catch {
    /* omit */
  }

  let servers: Array<{ url: string; description?: string }> = [];
  try {
    const serverList = await getServersForVersion(versionId);
    if (serverList.length > 0) {
      servers = await serversToOpenAPI(serverList);
    }
  } catch {
    /* omit */
  }

  const hasSecuritySchemes = Object.keys(securitySchemes).length > 0;
  const mergedSpecJson = await generateOpenApiSpec(
    classesWithProperties,
    {
      projectName,
      version: versionLabel,
      description: versionDescription,
      servers: servers.length > 0 ? servers : undefined,
      tags: [],
      security: hasSecuritySchemes ? Object.keys(securitySchemes).map((name) => ({ [name]: [] })) : undefined,
      externalDocs: undefined,
    },
    pathsObject,
    hasSecuritySchemes ? securitySchemes : undefined
  );

  return { pathsObject, mergedSpecJson };
}
