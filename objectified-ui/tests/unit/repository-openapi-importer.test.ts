import fs from 'fs';
import path from 'path';
import { parseOpenAPISpec } from '../../src/app/utils/openapi-import';
import { importOpenApiFromRepository } from '../../lib/repositories/importers/openapi';

describe('repository OpenAPI importer hook', () => {
  it('matches one-shot OpenAPI dialog parsing across the OpenAPI fixture set', async () => {
    const fixturesDir = path.join(__dirname, '../../examples/openapi');
    const fixtures = fs
      .readdirSync(fixturesDir)
      .filter((name) => name.endsWith('.yaml') || name.endsWith('.yml') || name.endsWith('.json'))
      .sort();

    expect(fixtures.length).toBeGreaterThan(0);

    for (const fixture of fixtures) {
      const content = fs.readFileSync(path.join(fixturesDir, fixture), 'utf-8');
      const oneShotResult = parseOpenAPISpec(content);
      const repositoryResult = await importOpenApiFromRepository({
        source: `repository://${fixture}`,
        format: fixture.includes('30-openapi-3.0') ? 'openapi_3_0' : 'openapi_3_1',
        content,
        refs: [],
      });

      expect(repositoryResult.success).toBe(oneShotResult.success);
      if (oneShotResult.success) {
        expect(repositoryResult.parseResult).toEqual(oneShotResult);
      } else {
        expect(repositoryResult.parseResult).toBeUndefined();
      }
      expect(repositoryResult.warnings).toEqual(oneShotResult.warnings);
      expect(repositoryResult.error).toBe(oneShotResult.error);
    }
  });

  it('delegates cross-file refs to the REPO-3.8 resolver when refs are present', async () => {
    const resolved = `
openapi: 3.1.0
info:
  title: Resolved
  version: 1.0.0
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
`;

    const resolveRefs = jest.fn().mockResolvedValue(resolved);

    const result = await importOpenApiFromRepository(
      {
        source: 'repository://services/openapi.yaml',
        format: 'openapi_3_1',
        content: 'openapi: 3.1.0',
        refs: [{ path: './schemas/user.yaml', content: 'type: object' }],
      },
      { resolveRefs }
    );

    expect(resolveRefs).toHaveBeenCalledTimes(1);
    expect(resolveRefs).toHaveBeenCalledWith({
      source: 'repository://services/openapi.yaml',
      format: 'openapi_3_1',
      content: 'openapi: 3.1.0',
      refs: [{ path: './schemas/user.yaml', content: 'type: object' }],
    });
    expect(result.success).toBe(true);
    expect(result.parseResult?.success).toBe(true);
    expect(result.parseResult?.classes.some((cls) => cls.name === 'User')).toBe(true);
  });
});
