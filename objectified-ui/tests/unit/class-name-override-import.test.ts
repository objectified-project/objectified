/**
 * Unit tests for #754: Custom name override for imported classes.
 *
 * When importing, the custom name (classNameMap) is applied as an override on classes.
 * - Dashboard and studio import flows pass classNameMap through to the importer.
 * - OpenAPI importer uses classNameMap when present, otherwise getSmartClassName.
 */

import { describe, it, expect } from '@jest/globals';
import { openApiImporter } from '../../lib/importers/openapi';
import { getSmartClassName } from '../../lib/schema-context-naming';

describe('#754 Custom name override for imported classes', () => {
  describe('OpenAPI importer normalize with classNameMap', () => {
    it('uses classNameMap override when provided for selected schema', () => {
      const document = {
        components: {
          schemas: {
            order_item: {
              type: 'object',
              title: 'Order Item',
              properties: { qty: { type: 'integer' } },
            },
          },
        },
      };
      const result = openApiImporter.normalize({
        document,
        options: {
          selectedSchemas: ['order_item'],
          applyNamingConvention: false,
          classNameMap: { order_item: 'LineItem' },
        },
      });
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].name).toBe('LineItem');
      expect(result.classes[0].originalSchemaKey).toBe('order_item');
    });

    it('falls back to smart name when schema key not in classNameMap', () => {
      const schema = { type: 'object', title: 'User Profile', properties: {} };
      const document = {
        components: {
          schemas: {
            user_profile: schema,
          },
        },
      };
      const smartName = getSmartClassName('user_profile', schema);
      expect(smartName).toBe('User Profile');

      const result = openApiImporter.normalize({
        document,
        options: {
          selectedSchemas: ['user_profile'],
          applyNamingConvention: true,
          classNamingConvention: 'PascalCase',
          propertyNamingConvention: 'camelCase',
          classNameMap: {},
        },
      });
      expect(result.classes[0].name).toBe('UserProfile');
    });

    it('applies naming convention to classNameMap override', () => {
      const document = {
        components: {
          schemas: {
            item: {
              type: 'object',
              properties: { id: { type: 'string' } },
            },
          },
        },
      };
      const result = openApiImporter.normalize({
        document,
        options: {
          selectedSchemas: ['item'],
          applyNamingConvention: true,
          classNamingConvention: 'PascalCase',
          propertyNamingConvention: 'camelCase',
          classNameMap: { item: 'line_item' },
        },
      });
      expect(result.classes[0].name).toBe('LineItem');
    });

    it('allows mixed overrides: some schemas in map, others use smart name', () => {
      const document = {
        components: {
          schemas: {
            a: { type: 'object', title: 'SchemaA', properties: {} },
            b: { type: 'object', title: 'SchemaB', properties: {} },
            c: { type: 'object', title: 'SchemaC', properties: {} },
          },
        },
      };
      const result = openApiImporter.normalize({
        document,
        options: {
          selectedSchemas: ['a', 'b', 'c'],
          applyNamingConvention: true,
          classNamingConvention: 'PascalCase',
          propertyNamingConvention: 'camelCase',
          classNameMap: { b: 'CustomB' },
        },
      });
      expect(result.classes.find((c) => c.originalSchemaKey === 'a')!.name).toBe('SchemaA');
      expect(result.classes.find((c) => c.originalSchemaKey === 'b')!.name).toBe('CustomB');
      expect(result.classes.find((c) => c.originalSchemaKey === 'c')!.name).toBe('SchemaC');
    });

    it('ignores classNameMap entries for non-selected schemas', () => {
      const document = {
        components: {
          schemas: {
            selected_schema: { type: 'object', title: 'Selected', properties: {} },
            not_selected: { type: 'object', title: 'NotSelected', properties: {} },
          },
        },
      };
      const result = openApiImporter.normalize({
        document,
        options: {
          selectedSchemas: ['selected_schema'],
          applyNamingConvention: false,
          classNameMap: {
            selected_schema: 'MyClass',
            not_selected: 'ShouldBeIgnored',
          },
        },
      });
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].name).toBe('MyClass');
      expect(result.classes[0].originalSchemaKey).toBe('selected_schema');
    });
  });

  describe('getSmartClassName contract', () => {
    it('returns schema key when no title or x-class-name', () => {
      expect(getSmartClassName('api_response', { type: 'object' })).toBe('api_response');
    });

    it('returns title-derived name when title present', () => {
      expect(getSmartClassName('x', { title: 'User Profile', type: 'object' })).toBe('User Profile');
    });

    it('x-class-name takes precedence over title', () => {
      expect(
        getSmartClassName('k', { 'x-class-name': 'CustomName', title: 'Title', type: 'object' })
      ).toBe('CustomName');
    });
  });
});
