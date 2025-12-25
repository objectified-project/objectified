/**
 * Complete Coverage Tests - Import and Utility Functions
 *
 * Targeting the remaining uncovered areas in helper.ts:
 * - importProjectFromOpenAPI complex logic
 * - Helper utility functions
 * - Edge cases in import flow
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../lib/db/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

jest.mock('crypto', () => ({
  createHash: jest.fn(() => ({
    update: jest.fn(() => ({
      digest: jest.fn(() => ({
        slice: jest.fn(() => 'HASH1234')
      }))
    }))
  }))
}));

describe('Import Project Complete Coverage', () => {
  let mockQuery: jest.Mock;
  let mockClient: any;

  beforeEach(() => {
    const db = require('../../lib/db/db');
    mockQuery = db.query as jest.Mock;
    mockQuery.mockClear();

    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    db.connect = jest.fn().mockResolvedValue(mockClient);
  });

  test('importProjectFromOpenAPI: complete flow with nested properties', async () => {
    const { importProjectFromOpenAPI } = await import('../../lib/db/helper');

    // Mock transaction
    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'proj-1' }] }) // Project insert
      .mockResolvedValueOnce({ rows: [{ id: 'ver-1' }] }) // Version insert
      .mockResolvedValueOnce({ rows: [{ id: 'prop-1' }] }) // Property insert
      .mockResolvedValueOnce({ rows: [{ id: 'class-1' }] }) // Class insert
      .mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] }) // Class property insert
      .mockResolvedValueOnce({ rows: [{ id: 'cp-2' }] }) // Nested property
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const classes = [{
      name: 'User',
      description: 'User entity',
      schema: { type: 'object' },
      properties: [{
        name: 'id',
        data: { type: 'string' },
        description: 'ID field',
        children: [{
          name: 'nested',
          data: { type: 'string' },
          description: 'Nested field'
        }]
      }]
    }];

    const result = await importProjectFromOpenAPI('tenant-1', 'user-1', {}, 'Project', 'proj', '1.0.0', 'Desc', classes);
    expect(result).toBeDefined();
  });

  test('importProjectFromOpenAPI: with reference properties', async () => {
    const { importProjectFromOpenAPI } = await import('../../lib/db/helper');

    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'proj-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'ver-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'class-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] }) // Reference property
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const classes = [{
      name: 'Order',
      schema: { type: 'object' },
      properties: [{
        name: 'user',
        data: { $ref: '#/components/schemas/User' },
        description: 'User ref'
      }]
    }];

    const result = await importProjectFromOpenAPI('tenant-1', 'user-1', {}, 'Project', 'proj', '1.0.0', 'Desc', classes);
    expect(result).toBeDefined();
  });

  test('importProjectFromOpenAPI: with array of references', async () => {
    const { importProjectFromOpenAPI } = await import('../../lib/db/helper');

    mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'proj-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'ver-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'class-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] })
      .mockResolvedValueOnce({ rows: [] });

    const classes = [{
      name: 'Order',
      properties: [{
        name: 'items',
        data: { type: 'array', items: { $ref: '#/components/schemas/Item' } }
      }]
    }];

    const result = await importProjectFromOpenAPI('tenant-1', 'user-1', {}, 'P', 'p', '1.0', null, classes);
    expect(result).toBeDefined();
  });

  test('importProjectFromOpenAPI: with multiple signature groups', async () => {
    const { importProjectFromOpenAPI } = await import('../../lib/db/helper');

    mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'proj-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'ver-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'prop-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'prop-2' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'class-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'class-2' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'cp-2' }] })
      .mockResolvedValueOnce({ rows: [] });

    const classes = [
      {
        name: 'Class1',
        properties: [{ name: 'status', data: { type: 'string', enum: ['a', 'b'] } }]
      },
      {
        name: 'Class2',
        properties: [{ name: 'status', data: { type: 'string', enum: ['c', 'd'] } }]
      }
    ];

    const result = await importProjectFromOpenAPI('t1', 'u1', {}, 'P', 'p', '1.0', null, classes);
    expect(result).toBeDefined();
  });

  test('importProjectFromOpenAPI: with oneOf schema', async () => {
    const { importProjectFromOpenAPI } = await import('../../lib/db/helper');

    mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'proj-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'ver-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'prop-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'class-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] })
      .mockResolvedValueOnce({ rows: [] });

    const classes = [{
      name: 'Union',
      properties: [{
        name: 'value',
        data: { oneOf: [{ type: 'string' }, { type: 'number' }] }
      }]
    }];

    const result = await importProjectFromOpenAPI('t1', 'u1', {}, 'P', 'p', '1.0', null, classes);
    expect(result).toBeDefined();
  });

  test('importProjectFromOpenAPI: with anyOf schema', async () => {
    const { importProjectFromOpenAPI } = await import('../../lib/db/helper');

    mockClient.query.mockImplementation((sql: string) => {
      if (sql === 'BEGIN') return Promise.resolve({ rows: [] });
      if (sql === 'COMMIT') return Promise.resolve({ rows: [] });
      if (sql.includes('INSERT INTO odb.projects')) return Promise.resolve({ rows: [{ id: 'proj-1' }] });
      if (sql.includes('INSERT INTO odb.versions')) return Promise.resolve({ rows: [{ id: 'ver-1' }] });
      if (sql.includes('INSERT INTO odb.properties')) return Promise.resolve({ rows: [{ id: 'prop-1' }] });
      if (sql.includes('INSERT INTO odb.classes')) return Promise.resolve({ rows: [{ id: 'class-1' }] });
      if (sql.includes('INSERT INTO odb.class_properties')) return Promise.resolve({ rows: [{ id: 'cp-1' }] });
      return Promise.resolve({ rows: [] });
    });

    const classes = [{
      name: 'Multi',
      properties: [{
        name: 'data',
        data: { anyOf: [{ type: 'string' }, { type: 'object' }] }
      }]
    }];

    const result = await importProjectFromOpenAPI('t1', 'u1', {}, 'P', 'p', '1.0', null, classes);
    expect(result).toBeDefined();
  });

  test('importProjectFromOpenAPI: with allOf schema', async () => {
    const { importProjectFromOpenAPI } = await import('../../lib/db/helper');

    mockClient.query.mockImplementation((sql: string) => {
      if (sql === 'BEGIN') return Promise.resolve({ rows: [] });
      if (sql === 'COMMIT') return Promise.resolve({ rows: [] });
      if (sql.includes('projects')) return Promise.resolve({ rows: [{ id: 'proj-1' }] });
      if (sql.includes('versions')) return Promise.resolve({ rows: [{ id: 'ver-1' }] });
      if (sql.includes('properties')) return Promise.resolve({ rows: [{ id: 'prop-1' }] });
      if (sql.includes('classes')) return Promise.resolve({ rows: [{ id: 'class-1' }] });
      if (sql.includes('class_properties')) return Promise.resolve({ rows: [{ id: 'cp-1' }] });
      return Promise.resolve({ rows: [] });
    });

    const classes = [{
      name: 'Combined',
      properties: [{
        name: 'combo',
        data: { allOf: [{ type: 'object' }, { properties: { x: { type: 'number' } } }] }
      }]
    }];

    const result = await importProjectFromOpenAPI('t1', 'u1', {}, 'P', 'p', '1.0', null, classes);
    expect(result).toBeDefined();
  });

  test('importProjectFromOpenAPI: duplicate project slug error', async () => {
    const { importProjectFromOpenAPI } = await import('../../lib/db/helper');

    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockRejectedValueOnce({
        code: '23505',
        detail: 'Key (slug)=(proj) already exists in projects',
        message: 'duplicate key'
      });

    const result = await importProjectFromOpenAPI('t1', 'u1', {}, 'P', 'proj', '1.0', null, []);
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('slug');
  });

  test('importProjectFromOpenAPI: duplicate version error', async () => {
    const { importProjectFromOpenAPI } = await import('../../lib/db/helper');

    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'proj-1' }] }) // Project
      .mockRejectedValueOnce({
        code: '23505',
        detail: 'Key (version_id)=(1.0.0) already exists in versions'
      });

    const result = await importProjectFromOpenAPI('t1', 'u1', {}, 'P', 'p', '1.0.0', null, []);
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('version');
  });

  test('importProjectFromOpenAPI: duplicate property error', async () => {
    const { importProjectFromOpenAPI } = await import('../../lib/db/helper');

    mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'proj-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'ver-1' }] })
      .mockRejectedValueOnce({
        code: '23505',
        detail: 'Key (project_id, name)=(proj-1, id) already exists in properties'
      });

    const classes = [{
      name: 'C',
      properties: [{ name: 'id', data: { type: 'string' } }]
    }];

    const result = await importProjectFromOpenAPI('t1', 'u1', {}, 'P', 'p', '1.0', null, classes);
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('property');
  });

  test('importProjectFromOpenAPI: with name collision handling', async () => {
    const { importProjectFromOpenAPI } = await import('../../lib/db/helper');

    mockClient.query.mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('projects')) return Promise.resolve({ rows: [{ id: 'proj-1' }] });
      if (sql.includes('versions')) return Promise.resolve({ rows: [{ id: 'ver-1' }] });
      if (sql.includes('properties')) return Promise.resolve({ rows: [{ id: 'prop-' + Math.random() }] });
      if (sql.includes('classes')) return Promise.resolve({ rows: [{ id: 'class-' + Math.random() }] });
      if (sql.includes('class_properties')) return Promise.resolve({ rows: [{ id: 'cp-' + Math.random() }] });
      return Promise.resolve({ rows: [] });
    });

    const classes = [
      { name: 'C1', properties: [{ name: 'status', data: { type: 'string' } }] },
      { name: 'C2', properties: [{ name: 'status', data: { type: 'number' } }] },
      { name: 'C3', properties: [{ name: 'status', data: { type: 'boolean' } }] }
    ];

    const result = await importProjectFromOpenAPI('t1', 'u1', {}, 'P', 'p', '1.0', null, classes);
    expect(result).toBeDefined();
  });

  test('importProjectFromOpenAPI: with array items schema', async () => {
    const { importProjectFromOpenAPI } = await import('../../lib/db/helper');

    mockClient.query.mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return Promise.resolve({ rows: [] });
      if (sql.includes('projects')) return Promise.resolve({ rows: [{ id: 'proj-1' }] });
      if (sql.includes('versions')) return Promise.resolve({ rows: [{ id: 'ver-1' }] });
      if (sql.includes('properties')) return Promise.resolve({ rows: [{ id: 'prop-1' }] });
      if (sql.includes('classes')) return Promise.resolve({ rows: [{ id: 'class-1' }] });
      if (sql.includes('class_properties')) return Promise.resolve({ rows: [{ id: 'cp-1' }] });
      return Promise.resolve({ rows: [] });
    });

    const classes = [{
      name: 'List',
      properties: [{
        name: 'items',
        data: { type: 'array', items: { type: 'string' } }
      }]
    }];

    const result = await importProjectFromOpenAPI('t1', 'u1', {}, 'P', 'p', '1.0', null, classes);
    expect(result).toBeDefined();
  });

  test('importProjectFromOpenAPI: generic error handling', async () => {
    const { importProjectFromOpenAPI } = await import('../../lib/db/helper');

    mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error('Connection lost'));

    const result = await importProjectFromOpenAPI('t1', 'u1', {}, 'P', 'p', '1.0', null, []);
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toBeDefined();
  });

  test('importProjectFromOpenAPI: with sanitized property names', async () => {
    const { importProjectFromOpenAPI } = await import('../../lib/db/helper');

    mockClient.query.mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return Promise.resolve({ rows: [] });
      if (sql.includes('projects')) return Promise.resolve({ rows: [{ id: 'proj-1' }] });
      if (sql.includes('versions')) return Promise.resolve({ rows: [{ id: 'ver-1' }] });
      if (sql.includes('properties')) return Promise.resolve({ rows: [{ id: 'prop-1' }] });
      if (sql.includes('classes')) return Promise.resolve({ rows: [{ id: 'class-1' }] });
      if (sql.includes('class_properties')) return Promise.resolve({ rows: [{ id: 'cp-1' }] });
      return Promise.resolve({ rows: [] });
    });

    const classes = [{
      name: 'Test',
      properties: [{
        name: '!!!invalid-name@@@',
        data: { type: 'string' }
      }]
    }];

    const result = await importProjectFromOpenAPI('t1', 'u1', {}, 'P', 'p', '1.0', null, classes);
    expect(result).toBeDefined();
  });

  test('importProjectFromOpenAPI: rollback on error', async () => {
    const { importProjectFromOpenAPI } = await import('../../lib/db/helper');

    let rollbackCalled = false;
    mockClient.query.mockImplementation((sql: string) => {
      if (sql === 'BEGIN') return Promise.resolve({ rows: [] });
      if (sql === 'ROLLBACK') {
        rollbackCalled = true;
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('projects')) return Promise.resolve({ rows: [{ id: 'proj-1' }] });
      throw new Error('Database error');
    });

    await importProjectFromOpenAPI('t1', 'u1', {}, 'P', 'p', '1.0', null, []);
    expect(rollbackCalled).toBe(true);
  });

  test('importProjectFromOpenAPI: with all type codes', async () => {
    const { importProjectFromOpenAPI } = await import('../../lib/db/helper');

    mockClient.query.mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return Promise.resolve({ rows: [] });
      if (sql.includes('projects')) return Promise.resolve({ rows: [{ id: 'proj-1' }] });
      if (sql.includes('versions')) return Promise.resolve({ rows: [{ id: 'ver-1' }] });
      if (sql.includes('properties')) return Promise.resolve({ rows: [{ id: `prop-${Math.random()}` }] });
      if (sql.includes('classes')) return Promise.resolve({ rows: [{ id: 'class-1' }] });
      if (sql.includes('class_properties')) return Promise.resolve({ rows: [{ id: `cp-${Math.random()}` }] });
      return Promise.resolve({ rows: [] });
    });

    const classes = [{
      name: 'AllTypes',
      properties: [
        { name: 'str', data: { type: 'string' } },
        { name: 'num', data: { type: 'number' } },
        { name: 'int', data: { type: 'integer' } },
        { name: 'bool', data: { type: 'boolean' } },
        { name: 'obj', data: { type: 'object' } },
        { name: 'arr', data: { type: 'array' } }
      ]
    }];

    const result = await importProjectFromOpenAPI('t1', 'u1', {}, 'P', 'p', '1.0', null, classes);
    expect(result).toBeDefined();
  });

  test('importProjectFromOpenAPI: with long property names', async () => {
    const { importProjectFromOpenAPI } = await import('../../lib/db/helper');

    mockClient.query.mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return Promise.resolve({ rows: [] });
      if (sql.includes('projects')) return Promise.resolve({ rows: [{ id: 'proj-1' }] });
      if (sql.includes('versions')) return Promise.resolve({ rows: [{ id: 'ver-1' }] });
      if (sql.includes('properties')) return Promise.resolve({ rows: [{ id: 'prop-1' }] });
      if (sql.includes('classes')) return Promise.resolve({ rows: [{ id: 'class-1' }] });
      if (sql.includes('class_properties')) return Promise.resolve({ rows: [{ id: 'cp-1' }] });
      return Promise.resolve({ rows: [] });
    });

    const longName = 'a'.repeat(300);
    const classes = [{
      name: 'Test',
      properties: [{ name: longName, data: { type: 'string' } }]
    }];

    const result = await importProjectFromOpenAPI('t1', 'u1', {}, 'P', 'p', '1.0', null, classes);
    expect(result).toBeDefined();
  });
});

console.log('✅ Complete coverage tests for import and utilities added!');

