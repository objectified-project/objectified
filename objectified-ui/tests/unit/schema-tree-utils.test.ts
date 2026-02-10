/**
 * Unit tests for schema tree utilities (#576)
 * Hierarchical view of schemas for import preview and mapping.
 */

import { describe, test, expect } from '@jest/globals';
import {
  extractSchemaReferences,
  buildSchemaTree,
  getTransitiveDependencies,
  isReferencedBySelectedSchemas,
  type SchemaTreeNode,
  type SchemaSelectionInfo,
} from '../../src/app/utils/schema-tree-utils';

describe('extractSchemaReferences', () => {
  test('returns empty array for null or undefined', () => {
    expect(extractSchemaReferences(null)).toEqual([]);
    expect(extractSchemaReferences(undefined)).toEqual([]);
  });

  test('returns empty array for non-object', () => {
    expect(extractSchemaReferences(42)).toEqual([]);
    expect(extractSchemaReferences('string')).toEqual([]);
    expect(extractSchemaReferences(true)).toEqual([]);
  });

  test('extracts single $ref from property', () => {
    const schema = {
      type: 'object',
      properties: {
        owner: { $ref: '#/components/schemas/User' },
      },
    };
    expect(extractSchemaReferences(schema)).toEqual(['User']);
  });

  test('extracts ref name from last path segment', () => {
    expect(extractSchemaReferences({ $ref: '#/components/schemas/Order' })).toEqual(['Order']);
    expect(extractSchemaReferences({ $ref: '#/definitions/Address' })).toEqual(['Address']);
    expect(extractSchemaReferences({ $ref: 'https://example.com/schemas/Product' })).toEqual([
      'Product',
    ]);
  });

  test('extracts multiple refs and deduplicates', () => {
    const schema = {
      type: 'object',
      properties: {
        user: { $ref: '#/components/schemas/User' },
        profile: { $ref: '#/components/schemas/Profile' },
        role: { $ref: '#/components/schemas/User' },
      },
    };
    expect(extractSchemaReferences(schema)).toEqual(['User', 'Profile']);
  });

  test('extracts ref from array items', () => {
    const schema = {
      type: 'array',
      items: { $ref: '#/components/schemas/LineItem' },
    };
    expect(extractSchemaReferences(schema)).toEqual(['LineItem']);
  });

  test('extracts refs from allOf', () => {
    const schema = {
      allOf: [
        { $ref: '#/components/schemas/BaseEntity' },
        {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
        },
      ],
    };
    expect(extractSchemaReferences(schema)).toEqual(['BaseEntity']);
  });

  test('extracts refs from oneOf and anyOf', () => {
    const schema = {
      oneOf: [{ $ref: '#/schemas/A' }, { $ref: '#/schemas/B' }],
      anyOf: [{ $ref: '#/schemas/C' }],
    };
    expect(extractSchemaReferences(schema)).toEqual(['A', 'B', 'C']);
  });

  test('extracts refs recursively from nested objects', () => {
    const schema = {
      properties: {
        address: {
          type: 'object',
          properties: {
            country: { $ref: '#/schemas/Country' },
          },
        },
        items: {
          type: 'array',
          items: { $ref: '#/schemas/Item' },
        },
      },
    };
    expect(extractSchemaReferences(schema)).toEqual(['Country', 'Item']);
  });

  test('ignores invalid $ref (non-string)', () => {
    const schema = { $ref: 123 };
    expect(extractSchemaReferences(schema)).toEqual([]);
  });
});

describe('buildSchemaTree', () => {
  test('returns empty array for empty schemaNames', () => {
    expect(buildSchemaTree({}, [])).toEqual([]);
  });

  test('returns flat roots when no refs', () => {
    const schemaObj = {
      User: { type: 'object', properties: { name: { type: 'string' } } },
      Product: { type: 'object', properties: { title: { type: 'string' } } },
    };
    const tree = buildSchemaTree(schemaObj, ['User', 'Product']);
    expect(tree).toHaveLength(2);
    expect(tree[0]).toEqual({ name: 'User', children: [] });
    expect(tree[1]).toEqual({ name: 'Product', children: [] });
  });

  test('builds parent-child from $ref', () => {
    const schemaObj = {
      Order: {
        type: 'object',
        properties: {
          customer: { $ref: '#/components/schemas/Customer' },
          items: { type: 'array', items: { $ref: '#/components/schemas/LineItem' } },
        },
      },
      Customer: { type: 'object', properties: { name: { type: 'string' } } },
      LineItem: { type: 'object', properties: { qty: { type: 'integer' } } },
    };
    const tree = buildSchemaTree(schemaObj, ['Order', 'Customer', 'LineItem']);
    expect(tree).toHaveLength(3);

    const orderNode = tree.find((n) => n.name === 'Order') as SchemaTreeNode;
    expect(orderNode).toBeDefined();
    expect(orderNode.children.map((c) => c.name).sort()).toEqual(['Customer', 'LineItem']);
    expect(orderNode.children.every((c) => c.children.length === 0)).toBe(true);

    const customerNode = tree.find((n) => n.name === 'Customer') as SchemaTreeNode;
    expect(customerNode.children).toEqual([]);
  });

  test('builds multi-level hierarchy', () => {
    const schemaObj = {
      Order: {
        type: 'object',
        properties: { lines: { type: 'array', items: { $ref: '#/schemas/LineItem' } } },
      },
      LineItem: {
        type: 'object',
        properties: { product: { $ref: '#/schemas/Product' } },
      },
      Product: { type: 'object', properties: {} },
    };
    const tree = buildSchemaTree(schemaObj, ['Order', 'LineItem', 'Product']);

    const orderNode = tree.find((n) => n.name === 'Order') as SchemaTreeNode;
    expect(orderNode.children).toHaveLength(1);
    expect(orderNode.children[0].name).toBe('LineItem');

    const lineItemNode = orderNode.children[0];
    expect(lineItemNode.children).toHaveLength(1);
    expect(lineItemNode.children[0].name).toBe('Product');
    expect(lineItemNode.children[0].children).toEqual([]);
  });

  test('avoids cycles: A -> B -> A', () => {
    const schemaObj = {
      A: { type: 'object', properties: { b: { $ref: '#/schemas/B' } } },
      B: { type: 'object', properties: { a: { $ref: '#/schemas/A' } } },
    };
    const tree = buildSchemaTree(schemaObj, ['A', 'B']);

    const aNode = tree.find((n) => n.name === 'A') as SchemaTreeNode;
    expect(aNode.children).toHaveLength(1);
    expect(aNode.children[0].name).toBe('B');
    // B would reference A, but A is already in path so no child
    expect(aNode.children[0].children).toEqual([]);

    const bNode = tree.find((n) => n.name === 'B') as SchemaTreeNode;
    expect(bNode.children).toHaveLength(1);
    expect(bNode.children[0].name).toBe('A');
    expect(bNode.children[0].children).toEqual([]);
  });

  test('excludes refs not in schemaNames', () => {
    const schemaObj = {
      Order: {
        type: 'object',
        properties: {
          customer: { $ref: '#/schemas/Customer' },
          external: { $ref: '#/schemas/ExternalType' },
        },
      },
      Customer: { type: 'object', properties: {} },
    };
    const tree = buildSchemaTree(schemaObj, ['Order', 'Customer']);
    const orderNode = tree.find((n) => n.name === 'Order') as SchemaTreeNode;
    expect(orderNode.children.map((c) => c.name)).toEqual(['Customer']);
  });

  test('applies nameFilter to roots', () => {
    const schemaObj = {
      User: { type: 'object', properties: {} },
      UserProfile: { type: 'object', properties: {} },
      Product: { type: 'object', properties: {} },
    };
    const tree = buildSchemaTree(
      schemaObj,
      ['User', 'UserProfile', 'Product'],
      (name) => name.startsWith('User')
    );
    expect(tree).toHaveLength(2);
    expect(tree.map((n) => n.name).sort()).toEqual(['User', 'UserProfile']);
  });

  test('filter is case-insensitive when caller passes lowercase filter', () => {
    const schemaObj = {
      Order: { type: 'object', properties: {} },
      orderLine: { type: 'object', properties: {} },
    };
    const tree = buildSchemaTree(
      schemaObj,
      ['Order', 'orderLine'],
      (name) => name.toLowerCase().includes('order')
    );
    expect(tree).toHaveLength(2);
    expect(tree.map((n) => n.name).sort()).toEqual(['Order', 'orderLine']);
  });

  test('same schema can appear as child of multiple roots', () => {
    const schemaObj = {
      Order: { type: 'object', properties: { customer: { $ref: '#/schemas/Customer' } } },
      Invoice: { type: 'object', properties: { customer: { $ref: '#/schemas/Customer' } } },
      Customer: { type: 'object', properties: {} },
    };
    const tree = buildSchemaTree(schemaObj, ['Order', 'Invoice', 'Customer']);

    const orderNode = tree.find((n) => n.name === 'Order') as SchemaTreeNode;
    const invoiceNode = tree.find((n) => n.name === 'Invoice') as SchemaTreeNode;
    expect(orderNode.children.map((c) => c.name)).toEqual(['Customer']);
    expect(invoiceNode.children.map((c) => c.name)).toEqual(['Customer']);
  });
});

describe('getTransitiveDependencies (#579)', () => {
  test('returns empty array when schema is missing', () => {
    const schemaObj = { A: { type: 'object', properties: {} } };
    expect(getTransitiveDependencies('B', schemaObj)).toEqual([]);
  });

  test('returns empty array when schema has no refs', () => {
    const schemaObj = {
      User: { type: 'object', properties: { name: { type: 'string' } } },
    };
    expect(getTransitiveDependencies('User', schemaObj)).toEqual([]);
  });

  test('returns direct refs that exist in schemaObj', () => {
    const schemaObj = {
      Order: {
        type: 'object',
        properties: {
          customer: { $ref: '#/components/schemas/Customer' },
          items: { type: 'array', items: { $ref: '#/components/schemas/LineItem' } },
        },
      },
      Customer: { type: 'object', properties: {} },
      LineItem: { type: 'object', properties: {} },
    };
    const deps = getTransitiveDependencies('Order', schemaObj);
    expect(deps.sort()).toEqual(['Customer', 'LineItem']);
  });

  test('returns transitive refs (A -> B -> C)', () => {
    const schemaObj = {
      Order: {
        type: 'object',
        properties: { lines: { type: 'array', items: { $ref: '#/schemas/LineItem' } } },
      },
      LineItem: {
        type: 'object',
        properties: { product: { $ref: '#/schemas/Product' } },
      },
      Product: { type: 'object', properties: {} },
    };
    const deps = getTransitiveDependencies('Order', schemaObj);
    expect(deps.sort()).toEqual(['LineItem', 'Product']);
  });

  test('excludes refs not in schemaObj (external refs)', () => {
    const schemaObj = {
      Order: {
        type: 'object',
        properties: {
          customer: { $ref: '#/schemas/Customer' },
          external: { $ref: '#/schemas/ExternalType' },
        },
      },
      Customer: { type: 'object', properties: {} },
    };
    const deps = getTransitiveDependencies('Order', schemaObj);
    expect(deps).toEqual(['Customer']);
  });

  test('avoids infinite loop on cycles (A -> B -> A)', () => {
    const schemaObj = {
      A: { type: 'object', properties: { b: { $ref: '#/schemas/B' } } },
      B: { type: 'object', properties: { a: { $ref: '#/schemas/A' } } },
    };
    const deps = getTransitiveDependencies('A', schemaObj);
    expect(deps).toEqual(['B']);
  });

  test('deduplicates when same ref appears multiple times', () => {
    const schemaObj = {
      Order: {
        type: 'object',
        properties: {
          customer: { $ref: '#/schemas/Customer' },
          billing: { $ref: '#/schemas/Customer' },
        },
      },
      Customer: { type: 'object', properties: {} },
    };
    const deps = getTransitiveDependencies('Order', schemaObj);
    expect(deps).toEqual(['Customer']);
  });
});

describe('isReferencedBySelectedSchemas (#579)', () => {
  const schemaObj = {
    Order: {
      type: 'object',
      properties: {
        customer: { $ref: '#/schemas/Customer' },
        lines: { type: 'array', items: { $ref: '#/schemas/LineItem' } },
      },
    },
    Customer: { type: 'object', properties: { name: { type: 'string' } } },
    LineItem: { type: 'object', properties: { qty: { type: 'integer' } } },
  };

  function sel(name: string, selected: boolean, exists = false): SchemaSelectionInfo {
    return { name, selected, exists };
  }

  test('returns false when no schemas are selected', () => {
    const schemas: SchemaSelectionInfo[] = [
      sel('Order', false),
      sel('Customer', false),
      sel('LineItem', false),
    ];
    expect(isReferencedBySelectedSchemas('Customer', schemas, schemaObj)).toBe(false);
  });

  test('returns false when schema is only referenced by itself (no other selected)', () => {
    const schemas: SchemaSelectionInfo[] = [
      sel('Order', false),
      sel('Customer', true), // selected but "exists" so not counted
      sel('LineItem', false),
    ];
    expect(isReferencedBySelectedSchemas('Customer', schemas, schemaObj)).toBe(false);
  });

  test('returns true when another selected schema references this one', () => {
    const schemas: SchemaSelectionInfo[] = [
      sel('Order', true),
      sel('Customer', true),
      sel('LineItem', false),
    ];
    expect(isReferencedBySelectedSchemas('Customer', schemas, schemaObj)).toBe(true);
    expect(isReferencedBySelectedSchemas('LineItem', schemas, schemaObj)).toBe(true);
  });

  test('returns false when schema is referenced only by unselected schema', () => {
    const schemas: SchemaSelectionInfo[] = [
      sel('Order', false),
      sel('Customer', true),
      sel('LineItem', true),
    ];
    expect(isReferencedBySelectedSchemas('Customer', schemas, schemaObj)).toBe(false);
  });

  test('ignores "exists" schemas when determining who counts as selected', () => {
    const schemas: SchemaSelectionInfo[] = [
      sel('Order', true),
      sel('Customer', true, true), // exists: excluded from "selected" set for ref-check
      sel('LineItem', true),
    ];
    // Selected set is [Order, LineItem]. Order references Customer and LineItem.
    expect(isReferencedBySelectedSchemas('Customer', schemas, schemaObj)).toBe(true);
    expect(isReferencedBySelectedSchemas('LineItem', schemas, schemaObj)).toBe(true);
  });

  test('returns false for schema that no one references', () => {
    const schemas: SchemaSelectionInfo[] = [
      sel('Order', true),
      sel('Customer', true),
      sel('LineItem', true),
    ];
    // Order is not referenced by Customer or LineItem
    expect(isReferencedBySelectedSchemas('Order', schemas, schemaObj)).toBe(false);
  });
});
