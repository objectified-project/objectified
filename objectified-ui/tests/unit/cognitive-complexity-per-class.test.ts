import { buildGraphForSchemaMetrics } from '@/app/utils/schema-graph-from-classes';
import { computeSchemaMetrics, computeSchemaMetricsFromClasses } from '@/app/utils/schema-metrics';

describe('cognitive complexity per class (#610)', () => {
  it('sums properties and simple outgoing ref edges', () => {
    const classes = [
      { id: 'a', name: 'User', properties: [], schema: {} },
      {
        id: 'b',
        name: 'Post',
        properties: [
          {
            id: 'p1',
            name: 'author',
            data: JSON.stringify({ $ref: '#/components/schemas/User' }),
          },
        ],
        schema: {},
      },
    ];
    const m = computeSchemaMetricsFromClasses(classes);
    const byName = Object.fromEntries(m.cognitiveComplexityPerClass.map((c) => [c.className, c]));
    expect(byName.User).toMatchObject({ score: 0, propertyContribution: 0, referenceContribution: 0 });
    expect(byName.Post).toMatchObject({ score: 2, propertyContribution: 1, referenceContribution: 1 });
  });

  it('weights property-level anyOf refs higher than a single $ref', () => {
    const classes = [
      { id: 'u', name: 'User', properties: [], schema: {} },
      { id: 'p', name: 'Pet', properties: [], schema: {} },
      {
        id: 'o',
        name: 'OwnerRef',
        properties: [
          {
            id: 'p1',
            name: 'subject',
            data: JSON.stringify({
              anyOf: [{ $ref: '#/components/schemas/User' }, { $ref: '#/components/schemas/Pet' }],
            }),
          },
        ],
        schema: {},
      },
    ];
    const m = computeSchemaMetricsFromClasses(classes);
    const row = m.cognitiveComplexityPerClass.find((c) => c.className === 'OwnerRef');
    expect(row).toBeDefined();
    expect(row).toMatchObject({
      propertyContribution: 1,
      referenceContribution: 4,
      score: 5,
    });
  });

  it('uses weight 2 for class-level oneOf edges from built graph', () => {
    const classes = [
      {
        id: 'a',
        name: 'Shape',
        properties: [],
        schema: {
          oneOf: [{ $ref: '#/components/schemas/Circle' }, { $ref: '#/components/schemas/Square' }],
        },
      },
      { id: 'b', name: 'Circle', properties: [], schema: {} },
      { id: 'c', name: 'Square', properties: [], schema: {} },
    ];
    const { nodes, edges } = buildGraphForSchemaMetrics(classes);
    const m = computeSchemaMetrics(nodes, edges);
    const shape = m.cognitiveComplexityPerClass.find((r) => r.className === 'Shape');
    expect(shape).toBeDefined();
    expect(shape!.referenceContribution).toBe(4);
    expect(shape!.score).toBe(4);
  });
});
