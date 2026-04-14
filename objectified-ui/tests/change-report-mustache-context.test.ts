import { buildMustacheContext } from '../lib/change-report-mustache-context';
import sampleFixture from '../lib/change-report-sample-fixture.json';

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
