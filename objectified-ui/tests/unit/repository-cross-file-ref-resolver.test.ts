import { describe, it, expect } from '@jest/globals';
import YAML from 'yaml';
import { resolveRepositoryCrossFileRefs } from '../../lib/repositories/importers/cross-file-ref-resolver';

describe('repository cross-file ref resolver', () => {
  it('resolves relative file refs with JSON pointer fragments', () => {
    const content = `
openapi: 3.1.0
info:
  title: Relative refs
  version: 1.0.0
components:
  schemas:
    Account:
      type: object
      properties:
        owner:
          $ref: ./schemas/user.yaml#/User
`;

    const resolved = resolveRepositoryCrossFileRefs({
      source: 'repository://services/openapi.yaml',
      content,
      refs: [
        {
          path: 'services/schemas/user.yaml',
          content: `
User:
  type: object
  properties:
    id:
      type: string
`,
        },
      ],
    });

    const parsed = YAML.parse(resolved);
    expect(parsed.components.schemas.Account.properties.owner.properties.id.type).toBe('string');
  });

  it('resolves chained refs deeper than five levels without recursion', () => {
    const refs = [
      {
        path: 'specs/level-2.yaml',
        content: 'value:\n  $ref: ./level-3.yaml#/value\n',
      },
      {
        path: 'specs/level-3.yaml',
        content: 'value:\n  $ref: ./level-4.yaml#/value\n',
      },
      {
        path: 'specs/level-4.yaml',
        content: 'value:\n  $ref: ./level-5.yaml#/value\n',
      },
      {
        path: 'specs/level-5.yaml',
        content: 'value:\n  $ref: ./level-6.yaml#/value\n',
      },
      {
        path: 'specs/level-6.yaml',
        content: 'value:\n  $ref: ./level-7.yaml#/value\n',
      },
      {
        path: 'specs/level-7.yaml',
        content: 'value:\n  type: object\n  properties:\n    id:\n      type: string\n',
      },
    ];

    const resolved = resolveRepositoryCrossFileRefs({
      source: 'repository://specs/root.yaml',
      content: 'value:\n  $ref: ./level-2.yaml#/value\n',
      refs,
    });

    const parsed = YAML.parse(resolved);
    expect(parsed.value.properties.id.type).toBe('string');
  });

  it('detects cross-file cycles with deterministic member names', () => {
    expect(() =>
      resolveRepositoryCrossFileRefs({
        source: 'repository://specs/a.yaml',
        content: 'value:\n  $ref: ./b.yaml#/value\n',
        refs: [
          { path: 'specs/b.yaml', content: 'value:\n  $ref: ./c.yaml#/value\n' },
          { path: 'specs/c.yaml', content: 'value:\n  $ref: ./a.yaml#/value\n' },
        ],
      })
    ).toThrow('Cross-file $ref cycle detected: specs/a.yaml -> specs/b.yaml -> specs/c.yaml -> specs/a.yaml');
  });

  it('memoizes repeated external refs within the same scan', () => {
    const resolved = resolveRepositoryCrossFileRefs({
      source: 'repository://services/openapi.yaml',
      content: `
openapi: 3.1.0
info:
  title: Memoized refs
  version: 1.0.0
components:
  schemas:
    Team:
      type: object
      properties:
        lead:
          $ref: ./schemas/user.yaml#/User
        reviewer:
          $ref: ./schemas/user.yaml#/User
`,
      refs: [
        {
          path: 'services/schemas/user.yaml',
          content: `
User:
  type: object
  properties:
    id:
      type: string
`,
        },
      ],
    });

    const parsed = YAML.parse(resolved);
    expect(parsed.components.schemas.Team.properties.lead.properties.id.type).toBe('string');
    expect(parsed.components.schemas.Team.properties.reviewer.properties.id.type).toBe('string');
  });
});
