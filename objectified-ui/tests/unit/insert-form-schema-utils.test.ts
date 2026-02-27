/**
 * Unit tests for insert form schema utilities (database insert modal).
 * Covers getPropertyType, getEnumOptions, getPattern, isMoneyField, getInitialFormData, getOrderedPropertyEntries.
 */

import {
  getPropertyType,
  getEnumOptions,
  getPattern,
  isMoneyField,
  getInitialFormData,
  getOrderedPropertyEntries,
} from '../../lib/database/insert-form-schema-utils';

describe('getPropertyType', () => {
  test('returns string for type string', () => {
    expect(getPropertyType({ type: 'string' })).toBe('string');
  });

  test('returns number for type number', () => {
    expect(getPropertyType({ type: 'number' })).toBe('number');
  });

  test('returns integer for type integer', () => {
    expect(getPropertyType({ type: 'integer' })).toBe('integer');
  });

  test('returns boolean for type boolean', () => {
    expect(getPropertyType({ type: 'boolean' })).toBe('boolean');
  });

  test('returns array for type array', () => {
    expect(getPropertyType({ type: 'array' })).toBe('array');
  });

  test('returns object for type object', () => {
    expect(getPropertyType({ type: 'object' })).toBe('object');
  });

  test('returns first non-null type from union type array', () => {
    expect(getPropertyType({ type: ['string', 'null'] })).toBe('string');
    expect(getPropertyType({ type: ['null', 'integer'] })).toBe('integer');
  });

  test('returns string when type is missing or invalid', () => {
    expect(getPropertyType({})).toBe('string');
    expect(getPropertyType({ type: [] })).toBe('string');
    expect(getPropertyType({ type: ['null'] })).toBe('string');
  });
});

describe('getEnumOptions', () => {
  test('returns enum array when present', () => {
    expect(getEnumOptions({ enum: ['a', 'b', 'c'] })).toEqual(['a', 'b', 'c']);
    expect(getEnumOptions({ enum: [1, 2, 3] })).toEqual([1, 2, 3]);
  });

  test('returns empty array when enum is missing or not array', () => {
    expect(getEnumOptions({})).toEqual([]);
    expect(getEnumOptions({ enum: null })).toEqual([]);
    expect(getEnumOptions({ enum: 'single' })).toEqual([]);
  });
});

describe('getPattern', () => {
  test('returns pattern string when present', () => {
    expect(getPattern({ pattern: '^[a-z]+$' })).toBe('^[a-z]+$');
    expect(getPattern({ pattern: '[0-9]{2}' })).toBe('[0-9]{2}');
  });

  test('returns undefined when pattern is missing or not string', () => {
    expect(getPattern({})).toBeUndefined();
    expect(getPattern({ pattern: null })).toBeUndefined();
    expect(getPattern({ pattern: /regex/ })).toBeUndefined();
  });
});

describe('isMoneyField', () => {
  test('returns true for format currency, amount, money', () => {
    expect(isMoneyField({ format: 'currency' }, 'x')).toBe(true);
    expect(isMoneyField({ format: 'amount' }, 'x')).toBe(true);
    expect(isMoneyField({ format: 'money' }, 'x')).toBe(true);
    expect(isMoneyField({ format: 'something-currency' }, 'x')).toBe(true);
  });

  test('returns true for property names containing money keywords', () => {
    expect(isMoneyField({}, 'price')).toBe(true);
    expect(isMoneyField({}, 'amount')).toBe(true);
    expect(isMoneyField({}, 'total')).toBe(true);
    expect(isMoneyField({}, 'subtotal')).toBe(true);
    expect(isMoneyField({}, 'unit_price')).toBe(true);
  });

  test('returns false for unrelated format and key', () => {
    expect(isMoneyField({ format: 'email' }, 'name')).toBe(false);
    expect(isMoneyField({}, 'title')).toBe(false);
  });
});

describe('getInitialFormData', () => {
  test('returns empty object when schema has no properties', () => {
    expect(getInitialFormData({})).toEqual({});
    expect(getInitialFormData({ type: 'object' })).toEqual({});
    expect(getInitialFormData({ properties: null })).toEqual({});
  });

  test('uses default when present', () => {
    const schema = {
      properties: {
        name: { type: 'string', default: 'Alice' },
        count: { type: 'integer', default: 10 },
      },
    };
    expect(getInitialFormData(schema)).toEqual({ name: 'Alice', count: 10 });
  });

  test('uses const when default is missing', () => {
    const schema = {
      properties: {
        status: { type: 'string', const: 'draft' },
      },
    };
    expect(getInitialFormData(schema)).toEqual({ status: 'draft' });
  });

  test('prefers default over const', () => {
    const schema = {
      properties: {
        x: { type: 'string', default: 'a', const: 'b' },
      },
    };
    expect(getInitialFormData(schema)).toEqual({ x: 'a' });
  });

  test('empty values by type when no default or const', () => {
    const schema = {
      properties: {
        s: { type: 'string' },
        n: { type: 'number' },
        i: { type: 'integer' },
        b: { type: 'boolean' },
        a: { type: 'array' },
        o: { type: 'object' },
      },
    };
    const result = getInitialFormData(schema);
    expect(result.s).toBe('');
    expect(result.n).toBeUndefined();
    expect(result.i).toBeUndefined();
    expect(result.b).toBe(false);
    expect(result.a).toEqual([]);
    expect(result.o).toEqual({});
  });

  test('deep-clones object and array defaults', () => {
    const nested = { foo: 1 };
    const schema = {
      properties: {
        obj: { type: 'object', default: nested },
        arr: { type: 'array', default: [1, 2] },
      },
    };
    const result = getInitialFormData(schema);
    expect(result.obj).toEqual({ foo: 1 });
    expect(result.obj).not.toBe(nested);
    expect((result.arr as number[]).slice()).toEqual([1, 2]);
    expect(result.arr).not.toBe(schema.properties.arr.default);
  });

  test('handles type as array (union with null)', () => {
    const schema = {
      properties: {
        s: { type: ['string', 'null'] },
      },
    };
    expect(getInitialFormData(schema)).toEqual({ s: '' });
  });
});

describe('getOrderedPropertyEntries', () => {
  test('returns entries for each property', () => {
    const schema = {
      properties: {
        a: { type: 'string' },
        b: { type: 'number' },
      },
    };
    const entries = getOrderedPropertyEntries(schema);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual(['a', { type: 'string' }]);
    expect(entries[1]).toEqual(['b', { type: 'number' }]);
  });

  test('returns empty array when no properties', () => {
    expect(getOrderedPropertyEntries({})).toEqual([]);
    expect(getOrderedPropertyEntries({ properties: {} })).toEqual([]);
    expect(getOrderedPropertyEntries({ properties: null })).toEqual([]);
  });

  test('skips non-object property values', () => {
    const schema = {
      properties: {
        valid: { type: 'string' },
        invalid: null,
      },
    };
    const entries = getOrderedPropertyEntries(schema);
    expect(entries).toHaveLength(1);
    expect(entries[0][0]).toBe('valid');
  });
});
