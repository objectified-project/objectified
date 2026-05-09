import { describe, test, expect } from '@jest/globals';
import { importJobInputToRestBody } from '../lib/import-job-rest-body';
import type { ImportJobInput } from 'objectified-importer/server';

describe('importJobInputToRestBody', () => {
  test('strips tenantId and userId', () => {
    const input: ImportJobInput = {
      tenantId: 't1',
      userId: 'u1',
      sourceKind: 'openapi' as ImportJobInput['sourceKind'],
      document: { openapi: '3.1.0' },
      project: { name: 'P', slug: 'p' },
      version: { versionId: '1.0.0' },
      options: { selectedSchemas: ['S'] },
      existingProjectId: 'proj-1',
      repositorySource: { repositoryId: 'r', branch: 'main', path: 'a.yaml', blobSha: 'abc' },
    };
    const body = importJobInputToRestBody(input);
    expect(body).not.toHaveProperty('tenantId');
    expect(body).not.toHaveProperty('userId');
    expect(body.existingProjectId).toBe('proj-1');
    expect(body.repositorySource).toEqual(input.repositorySource);
  });
});
