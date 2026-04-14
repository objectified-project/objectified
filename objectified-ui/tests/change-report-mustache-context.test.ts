import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from '@jest/globals';
import { buildMustacheContext } from '../lib/change-report-mustache-context';

const sampleFixture = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../lib/change-report-sample-fixture.json'),
    'utf8',
  ),
) as Record<string, unknown>;

describe('buildMustacheContext', () => {
  it('merges counts and schema buckets for preview', () => {
    const ctx = buildMustacheContext(sampleFixture as Record<string, unknown>, {
      productName: 'P',
      fromVersionLabel: 'a',
      toVersionLabel: 'b',
    });
    expect(ctx.schemaCounts).toEqual({ added: 1, removed: 1, modified: 1 });
    expect(ctx.propertyCount).toBe(1);
    expect(ctx.generatorVersion).toBe('objectified-ui/preview');
    expect(ctx.schemaSection).toBe(true);
  });
});
