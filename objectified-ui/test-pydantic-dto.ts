/**
 * Test Examples for Pydantic Python DTO Generator
 *
 * This file demonstrates test cases for:
 * - allOf (inheritance)
 * - oneOf (discriminated unions)
 * - anyOf (unions)
 * - Enumerations
 * - Regex patterns
 * - Field constraints
 */

import { generatePythonDTOs } from './python-dto';

// Test 1: Class with enum and regex pattern
const enumAndRegexTest = [
  {
    id: '1',
    name: 'User',
    description: 'User account with status and email validation',
    schema: {
      type: 'object',
      required: ['username', 'email', 'status']
    },
    properties: [
      {
        id: 'p1',
        name: 'username',
        parent_id: null,
        data: {
          type: 'string',
          description: 'Username with alphanumeric pattern',
          pattern: '^[a-zA-Z0-9_]{3,20}$',
          minLength: 3,
          maxLength: 20
        }
      },
      {
        id: 'p2',
        name: 'email',
        parent_id: null,
        data: {
          type: 'string',
          format: 'email',
          description: 'User email address'
        }
      },
      {
        id: 'p3',
        name: 'status',
        parent_id: null,
        data: {
          type: 'string',
          enum: ['active', 'inactive', 'suspended'],
          description: 'User account status'
        }
      },
      {
        id: 'p4',
        name: 'age',
        parent_id: null,
        data: {
          type: 'integer',
          minimum: 0,
          maximum: 150,
          description: 'User age'
        }
      }
    ]
  }
];

// Test 2: allOf - Inheritance/Composition
const allOfTest = [
  {
    id: '1',
    name: 'Animal',
    description: 'Base animal class',
    schema: {
      type: 'object',
      required: ['name', 'species']
    },
    properties: [
      {
        id: 'a1',
        name: 'name',
        parent_id: null,
        data: {
          type: 'string',
          description: 'Animal name'
        }
      },
      {
        id: 'a2',
        name: 'species',
        parent_id: null,
        data: {
          type: 'string',
          description: 'Species name'
        }
      }
    ]
  },
  {
    id: '2',
    name: 'Dog',
    description: 'Dog extends Animal',
    schema: {
      allOf: [
        { $ref: '#/components/schemas/Animal' }
      ],
      type: 'object',
      required: ['breed']
    },
    properties: [
      {
        id: 'd1',
        name: 'breed',
        parent_id: null,
        data: {
          type: 'string',
          description: 'Dog breed'
        }
      },
      {
        id: 'd2',
        name: 'isGoodBoy',
        parent_id: null,
        data: {
          type: 'boolean',
          default: true,
          description: 'Is this a good boy?'
        }
      }
    ]
  }
];

// Test 3: oneOf with discriminator
const oneOfTest = [
  {
    id: '1',
    name: 'Circle',
    description: 'Circle shape',
    schema: {
      type: 'object',
      required: ['type', 'radius']
    },
    properties: [
      {
        id: 'c1',
        name: 'type',
        parent_id: null,
        data: {
          type: 'string',
          enum: ['circle'],
          description: 'Shape type discriminator'
        }
      },
      {
        id: 'c2',
        name: 'radius',
        parent_id: null,
        data: {
          type: 'number',
          minimum: 0,
          description: 'Circle radius'
        }
      }
    ]
  },
  {
    id: '2',
    name: 'Rectangle',
    description: 'Rectangle shape',
    schema: {
      type: 'object',
      required: ['type', 'width', 'height']
    },
    properties: [
      {
        id: 'r1',
        name: 'type',
        parent_id: null,
        data: {
          type: 'string',
          enum: ['rectangle'],
          description: 'Shape type discriminator'
        }
      },
      {
        id: 'r2',
        name: 'width',
        parent_id: null,
        data: {
          type: 'number',
          minimum: 0,
          description: 'Rectangle width'
        }
      },
      {
        id: 'r3',
        name: 'height',
        parent_id: null,
        data: {
          type: 'number',
          minimum: 0,
          description: 'Rectangle height'
        }
      }
    ]
  },
  {
    id: '3',
    name: 'Shape',
    description: 'Union of shapes with discriminator',
    schema: {
      oneOf: [
        { $ref: '#/components/schemas/Circle' },
        { $ref: '#/components/schemas/Rectangle' }
      ],
      discriminator: {
        propertyName: 'type'
      }
    },
    properties: []
  }
];

// Test 4: anyOf (union without discriminator)
const anyOfTest = [
  {
    id: '1',
    name: 'StringOrNumber',
    description: 'Can be either string or number',
    schema: {
      anyOf: [
        { type: 'string' },
        { type: 'number' }
      ]
    },
    properties: []
  }
];

// Test 5: Complex example with nested objects and arrays
const complexTest = [
  {
    id: '1',
    name: 'Company',
    description: 'Company with employees and address',
    schema: {
      type: 'object',
      required: ['name', 'employees']
    },
    properties: [
      {
        id: 'c1',
        name: 'name',
        parent_id: null,
        data: {
          type: 'string',
          minLength: 1,
          maxLength: 100,
          description: 'Company name'
        }
      },
      {
        id: 'c2',
        name: 'website',
        parent_id: null,
        data: {
          type: 'string',
          format: 'uri',
          description: 'Company website URL'
        }
      },
      {
        id: 'c3',
        name: 'founded',
        parent_id: null,
        data: {
          type: 'string',
          format: 'date',
          description: 'Founding date'
        }
      },
      {
        id: 'c4',
        name: 'employees',
        parent_id: null,
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {}
          },
          minItems: 1,
          description: 'List of employees'
        }
      },
      {
        id: 'c4-1',
        name: 'fullName',
        parent_id: 'c4',
        data: {
          type: 'string',
          description: 'Employee full name'
        }
      },
      {
        id: 'c4-2',
        name: 'role',
        parent_id: 'c4',
        data: {
          type: 'string',
          enum: ['engineer', 'manager', 'designer', 'executive'],
          description: 'Employee role'
        }
      },
      {
        id: 'c4-3',
        name: 'salary',
        parent_id: 'c4',
        data: {
          type: 'number',
          minimum: 0,
          description: 'Annual salary'
        }
      }
    ]
  }
];

// Run tests
console.log('=== Test 1: Enums and Regex Patterns ===\n');
console.log(generatePythonDTOs(enumAndRegexTest, {
  projectName: 'Test 1',
  version: '1.0.0',
  description: 'Testing enums and regex patterns'
}));

console.log('\n\n=== Test 2: allOf (Inheritance) ===\n');
console.log(generatePythonDTOs(allOfTest, {
  projectName: 'Test 2',
  version: '1.0.0',
  description: 'Testing allOf composition'
}));

console.log('\n\n=== Test 3: oneOf with Discriminator ===\n');
console.log(generatePythonDTOs(oneOfTest, {
  projectName: 'Test 3',
  version: '1.0.0',
  description: 'Testing oneOf with discriminator'
}));

console.log('\n\n=== Test 4: anyOf (Union) ===\n');
console.log(generatePythonDTOs(anyOfTest, {
  projectName: 'Test 4',
  version: '1.0.0',
  description: 'Testing anyOf unions'
}));

console.log('\n\n=== Test 5: Complex with Nested Objects ===\n');
console.log(generatePythonDTOs(complexTest, {
  projectName: 'Test 5',
  version: '1.0.0',
  description: 'Testing complex nested structures'
}));

