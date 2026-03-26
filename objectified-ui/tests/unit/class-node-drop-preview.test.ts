import { getDropPreviewPropertyType } from '@/app/components/ade/studio/ClassNode';

describe('ClassNode ghost drop preview type', () => {
  it('renders array reference type labels', () => {
    expect(
      getDropPreviewPropertyType({
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/Address' },
        },
      })
    ).toBe('Address[]');
  });

  it('renders direct ref labels', () => {
    expect(
      getDropPreviewPropertyType({
        data: { $ref: '#/components/schemas/User' },
      })
    ).toBe('User');
  });

  it('falls back to primitive/base type', () => {
    expect(
      getDropPreviewPropertyType({
        data: { type: ['string', 'null'] },
      })
    ).toBe('string');
  });
});
