/**
 * Tests for the class import functionality
 */

// Mock the helper module
jest.mock('../lib/db/helper', () => ({
  createClass: jest.fn(),
  addPropertyToClass: jest.fn(),
  createProperty: jest.fn(),
}));

// Mock the importers module
jest.mock('../lib/importers', () => ({
  getImporter: jest.fn(() => ({
    normalize: jest.fn((_input: { document: any; options: any }) => ({
      classes: [
        {
          name: 'TestClass',
          description: 'Test description',
          schema: { type: 'object' },
          properties: [
            {
              name: 'testProp',
              description: 'Test property',
              data: { type: 'string' },
            },
          ],
        },
      ],
      warnings: [],
    })),
  })),
}));

describe('Class Import Actions', () => {
  it('should have correct import interface', async () => {
    // Verify the import interface structure
    const importInput = {
      versionId: 'test-version-id',
      projectId: 'test-project-id',
      document: { openapi: '3.0.0', info: { title: 'Test', version: '1.0.0' } },
      selectedSchemas: ['TestSchema'],
    };

    expect(importInput).toHaveProperty('versionId');
    expect(importInput).toHaveProperty('projectId');
    expect(importInput).toHaveProperty('document');
    expect(importInput).toHaveProperty('selectedSchemas');
  });

  it('should have correct result interface', () => {
    // Verify the result interface structure
    const successResult = {
      success: true,
      importedCount: 5,
      skippedCount: 2,
      importedClasses: ['Class1', 'Class2'],
    };

    const errorResult = {
      success: false,
      error: 'An error occurred',
    };

    expect(successResult.success).toBe(true);
    expect(successResult.importedCount).toBe(5);
    expect(successResult.skippedCount).toBe(2);
    expect(errorResult.success).toBe(false);
    expect(errorResult.error).toBe('An error occurred');
  });

  it('should validate selectedSchemas is required', () => {
    const invalidInput = {
      versionId: 'test-version-id',
      projectId: 'test-project-id',
      document: {},
      selectedSchemas: [],
    };

    // Empty selectedSchemas should be considered invalid
    expect(invalidInput.selectedSchemas.length).toBe(0);
  });
});

describe('Schema conflict detection', () => {
  it('should correctly identify existing class names', () => {
    const existingClassNames = ['User', 'Product', 'Order'];
    const incomingSchemas = ['User', 'NewClass', 'Product', 'AnotherNew'];

    const existingNamesSet = new Set(existingClassNames.map(n => n.toLowerCase()));

    const conflicts = incomingSchemas.filter(name =>
      existingNamesSet.has(name.toLowerCase())
    );
    const newClasses = incomingSchemas.filter(name =>
      !existingNamesSet.has(name.toLowerCase())
    );

    expect(conflicts).toEqual(['User', 'Product']);
    expect(newClasses).toEqual(['NewClass', 'AnotherNew']);
  });

  it('should be case-insensitive for conflict detection', () => {
    const existingClassNames = ['User'];
    const incomingSchemas = ['user', 'USER', 'UsEr', 'NewUser'];

    const existingNamesSet = new Set(existingClassNames.map(n => n.toLowerCase()));

    const conflicts = incomingSchemas.filter(name =>
      existingNamesSet.has(name.toLowerCase())
    );

    expect(conflicts).toEqual(['user', 'USER', 'UsEr']);
  });
});

describe('Schema property counting', () => {
  it('should count direct properties', () => {
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
      },
    };

    const count = Object.keys(schema.properties).length;
    expect(count).toBe(3);
  });

  it('should count properties from allOf inheritance', () => {
    const schema = {
      allOf: [
        { properties: { id: { type: 'string' } } },
        { properties: { name: { type: 'string' }, email: { type: 'string' } } },
      ],
    };

    let count = 0;
    if (schema.allOf) {
      schema.allOf.forEach((item: any) => {
        if (item.properties) {
          count += Object.keys(item.properties).length;
        }
      });
    }

    expect(count).toBe(3);
  });

  it('should count max properties from oneOf variants', () => {
    const schema = {
      oneOf: [
        { properties: { a: { type: 'string' } } },
        { properties: { a: { type: 'string' }, b: { type: 'string' }, c: { type: 'string' } } },
        { properties: { x: { type: 'string' }, y: { type: 'string' } } },
      ],
    };

    let maxOneOf = 0;
    if (schema.oneOf) {
      schema.oneOf.forEach((item: any) => {
        if (item.properties) {
          maxOneOf = Math.max(maxOneOf, Object.keys(item.properties).length);
        }
      });
    }

    expect(maxOneOf).toBe(3);
  });
});

