/**
 * Legacy transaction helpers bound to the UI pool singleton (dynamic require).
 * Prefer {@link PgTransactionalClient} with an injected {@link Pool} for new code.
 */

import { createImporterEngineRequire } from './importer-node-require';
import type { PgQueryable } from './pg-client';
import {
  addPropertyToClassTx as pgAddPropertyToClassTx,
  beginTransaction as pgBeginTransaction,
  commitTransaction as pgCommitTransaction,
  createClassTx as pgCreateClassTx,
  createProjectTx as pgCreateProjectTx,
  createPropertyTx as pgCreatePropertyTx,
  createVersionTx as pgCreateVersionTx,
  getClassesWithPropertiesAndTagsTx as pgGetClassesWithPropertiesAndTagsTx,
  getLatestVersionUuidForProjectTx as pgGetLatestVersionUuidForProjectTx,
  listProjectLibraryPropertiesTx as pgListProjectLibraryPropertiesTx,
  releaseClient as pgReleaseClient,
  rollbackTransaction as pgRollbackTransaction,
} from './pg-client';

const nodeRequire = createImporterEngineRequire();
const connectionPool = nodeRequire('../../../objectified-ui/lib/db/db');

export type PoolClient = PgQueryable;

export async function getTransactionClient(): Promise<PoolClient> {
  return connectionPool.connect();
}

export async function beginTransaction(client: PoolClient): Promise<void> {
  return pgBeginTransaction(client);
}

export async function commitTransaction(client: PoolClient): Promise<void> {
  return pgCommitTransaction(client);
}

export async function rollbackTransaction(client: PoolClient): Promise<void> {
  return pgRollbackTransaction(client);
}

export async function releaseClient(client: PoolClient): Promise<void> {
  return pgReleaseClient(client);
}

export async function createProjectTx(
  client: PoolClient,
  tenantId: string,
  creatorId: string,
  name: string,
  description: string,
  slug: string,
  metadata?: unknown
): Promise<string> {
  return pgCreateProjectTx(client, tenantId, creatorId, name, description, slug, metadata);
}

export async function createVersionTx(
  client: PoolClient,
  projectId: string,
  creatorId: string,
  versionId: string,
  description: string,
  changeLog: string,
  opts?: { parentVersionUuid?: string | null }
): Promise<string> {
  return pgCreateVersionTx(client, projectId, creatorId, versionId, description, changeLog, opts);
}

export async function getLatestVersionUuidForProjectTx(
  client: PoolClient,
  projectId: string
): Promise<string | null> {
  return pgGetLatestVersionUuidForProjectTx(client, projectId);
}

export async function listProjectLibraryPropertiesTx(
  client: PoolClient,
  projectId: string
): Promise<Array<{ id: string; name: string; description: string | null; data: unknown }>> {
  return pgListProjectLibraryPropertiesTx(client, projectId);
}

export async function createPropertyTx(
  client: PoolClient,
  projectId: string,
  name: string,
  description: string | null,
  data: unknown
): Promise<string> {
  return pgCreatePropertyTx(client, projectId, name, description, data);
}

export async function createClassTx(
  client: PoolClient,
  versionId: string,
  name: string,
  description: string | null,
  schema: unknown
): Promise<string> {
  return pgCreateClassTx(client, versionId, name, description, schema);
}

export async function addPropertyToClassTx(
  client: PoolClient,
  classId: string,
  propertyId: string | null,
  name: string,
  description: string | null,
  data: unknown,
  parentId: string | null = null
): Promise<string> {
  return pgAddPropertyToClassTx(client, classId, propertyId, name, description, data, parentId);
}

export async function getClassesWithPropertiesAndTagsTx(client: PoolClient, versionId: string): Promise<string> {
  return pgGetClassesWithPropertiesAndTagsTx(client, versionId);
}
