'use server';

// Server actions wrapper for path operations
// This allows client components to call server-side database functions

import {
  getApiPathsForVersion,
  createApiPath,
  updateApiPath,
  deleteApiPath,
  getOperationsForPath,
  createPathOperation,
  updatePathOperation,
  deletePathOperation,
  getTagsForPath,
  assignTagToPath,
  removeTagFromPath,
  setPathTags,
  getTagsForOperation,
  assignTagToOperation,
  removeTagFromOperation,
  setOperationTags
} from '../../../../../lib/db/helper-paths';

import { getTagsForProject, getClassesForVersion } from '../../../../../lib/db/helper';

export async function getTagsForProjectAction(projectId: string) {
  return await getTagsForProject(projectId);
}

export async function getClassesForVersionAction(versionId: string) {
  return await getClassesForVersion(versionId);
}

export async function getPathsForVersionAction(versionId: string) {
  return await getApiPathsForVersion(versionId);
}

export async function getOperationsForPathAction(pathId: string) {
  return await getOperationsForPath(pathId);
}

export async function createPathAction(
  versionId: string,
  path: string,
  summary?: string,
  description?: string,
  servers?: any,
  parameters?: any,
  sortOrder?: number
) {
  return await createApiPath(versionId, path, summary, description, servers, parameters, sortOrder);
}

export async function updatePathAction(
  pathId: string,
  updates: {
    path?: string;
    summary?: string;
    description?: string;
    servers?: any;
    parameters?: any;
    sortOrder?: number;
    enabled?: boolean;
  }
) {
  return await updateApiPath(pathId, updates);
}

export async function deletePathAction(pathId: string) {
  return await deleteApiPath(pathId);
}

export async function createOperationAction(
  pathId: string,
  method: string,
  operationId?: string,
  summary?: string,
  description?: string,
  externalDocs?: any,
  deprecated?: boolean,
  servers?: any
) {
  return await createPathOperation(pathId, method, operationId, summary, description, externalDocs, deprecated, servers);
}

export async function updateOperationAction(
  operationId: string,
  updates: {
    operationId?: string;
    summary?: string;
    description?: string;
    externalDocs?: any;
    deprecated?: boolean;
    deprecationMessage?: string;
    servers?: any;
    enabled?: boolean;
  }
) {
  return await updatePathOperation(operationId, updates);
}

export async function deleteOperationAction(operationId: string) {
  return await deletePathOperation(operationId);
}

// ============================================================================
// PATH TAG ACTIONS
// ============================================================================

export async function getTagsForPathAction(pathId: string) {
  return await getTagsForPath(pathId);
}

export async function assignTagToPathAction(pathId: string, tagId: string) {
  return await assignTagToPath(pathId, tagId);
}

export async function removeTagFromPathAction(pathId: string, tagId: string) {
  return await removeTagFromPath(pathId, tagId);
}

export async function setPathTagsAction(pathId: string, tagIds: string[]) {
  return await setPathTags(pathId, tagIds);
}

// ============================================================================
// OPERATION TAG ACTIONS
// ============================================================================

export async function getTagsForOperationAction(operationId: string) {
  return await getTagsForOperation(operationId);
}

export async function assignTagToOperationAction(operationId: string, tagId: string) {
  return await assignTagToOperation(operationId, tagId);
}

export async function removeTagFromOperationAction(operationId: string, tagId: string) {
  return await removeTagFromOperation(operationId, tagId);
}

export async function setOperationTagsAction(operationId: string, tagIds: string[]) {
  return await setOperationTags(operationId, tagIds);
}

