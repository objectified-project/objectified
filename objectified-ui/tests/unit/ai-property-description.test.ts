import {
  normalizeGeneratedPropertyDescription,
  summarizeStoredPropertyData,
  draftPropertySchemaFromDialogForm,
} from '../../lib/ai-property-description';
import type { PropertyFormData } from '../../src/app/components/ade/studio/PropertyFormFields';

describe('ai-property-description (#619)', () => {
  it('normalizeGeneratedPropertyDescription strips fences and markdown noise', () => {
    expect(normalizeGeneratedPropertyDescription('')).toBe('');
    expect(normalizeGeneratedPropertyDescription('  hello world  ')).toBe('hello world');
    expect(
      normalizeGeneratedPropertyDescription('```\nThe customer email.\n```'),
    ).toBe('The customer email.');
    expect(normalizeGeneratedPropertyDescription('First para.\n\nSecond ignored.')).toBe('First para.');
  });

  it('summarizeStoredPropertyData keeps schema semantics', () => {
    expect(summarizeStoredPropertyData(null)).toEqual({});
    const s = summarizeStoredPropertyData({
      type: 'string',
      format: 'email',
      description: 'x'.repeat(5000),
      extra: { nested: true },
    });
    expect(s.type).toBe('string');
    expect(s.format).toBe('email');
    expect(s.description).toBeDefined();
  });

  it('draftPropertySchemaFromDialogForm reflects array and nullable', () => {
    const formData: PropertyFormData = {
      nullable: true,
      format: 'uuid',
      minItems: '1',
      maxItems: '10',
    };
    const doc = draftPropertySchemaFromDialogForm({
      propertyType: 'string',
      propertyIsArray: true,
      formData,
      seedProperty: null,
    });
    expect(doc.type).toBe('array');
    expect(doc.items).toEqual({ type: ['string', 'null'], format: 'uuid' });
    expect(doc.minItems).toBe(1);
    expect(doc.maxItems).toBe(10);
  });

  it('draftPropertySchemaFromDialogForm handles $ref', () => {
    const formData: PropertyFormData = {};
    expect(
      draftPropertySchemaFromDialogForm({
        propertyType: '$ref',
        propertyIsArray: false,
        formData,
        seedProperty: { $ref: '#/components/schemas/Order' },
      }).$ref,
    ).toBe('#/components/schemas/Order');
    const arr = draftPropertySchemaFromDialogForm({
      propertyType: '$ref',
      propertyIsArray: true,
      formData,
      seedProperty: { items: { $ref: '#/components/schemas/LineItem' } },
    });
    expect(arr.type).toBe('array');
    expect((arr.items as { $ref?: string }).$ref).toBe('#/components/schemas/LineItem');
  });
});
