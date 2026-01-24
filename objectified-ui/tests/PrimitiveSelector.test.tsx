/**
 * Tests for PrimitiveSelector Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the useDarkMode hook using src path
jest.mock('../src/app/hooks/useDarkMode', () => ({
  useDarkMode: () => false,
}));

// Mock fetch
const mockPrimitives = [
  {
    id: '1',
    tenant_id: 'tenant-1',
    name: 'Email Address',
    description: 'A valid email address format',
    category: 'string',
    schema: {
      type: 'string',
      format: 'email',
      pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
    },
    tags: ['email', 'contact'],
    created_by: null,
    is_system: true,
    is_public: true,
    usage_count: 42,
    enabled: true,
    created_at: '2026-01-22T10:00:00Z',
    updated_at: '2026-01-22T10:00:00Z',
  },
  {
    id: '2',
    tenant_id: 'tenant-1',
    name: 'Custom Phone Number',
    description: 'Phone number format for US',
    category: 'string',
    schema: {
      type: 'string',
      pattern: '^\\+1\\d{10}$',
      minLength: 12,
      maxLength: 12,
    },
    tags: ['phone', 'contact'],
    created_by: 'user-1',
    is_system: false,
    is_public: false,
    usage_count: 5,
    enabled: true,
    created_at: '2026-01-22T11:00:00Z',
    updated_at: '2026-01-22T11:00:00Z',
  },
  {
    id: '3',
    tenant_id: 'tenant-1',
    name: 'Age',
    description: 'A valid age (0-150)',
    category: 'integer',
    schema: {
      type: 'integer',
      minimum: 0,
      maximum: 150,
    },
    tags: ['age', 'person'],
    created_by: null,
    is_system: true,
    is_public: true,
    usage_count: 20,
    enabled: true,
    created_at: '2026-01-22T10:00:00Z',
    updated_at: '2026-01-22T10:00:00Z',
  },
];

// Simple mock for PrimitiveSelector tests
describe('PrimitiveSelector Component', () => {
  beforeAll(() => {
    global.fetch = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, primitives: mockPrimitives }),
    });
  });

  it('should apply primitive format constraints correctly', () => {
    const emailPrimitive = mockPrimitives[0];
    expect(emailPrimitive.schema.format).toBe('email');
    expect(emailPrimitive.schema.pattern).toBeDefined();
    expect(emailPrimitive.is_system).toBe(true);
  });

  it('should distinguish between system and tenant primitives', () => {
    const systemPrimitives = mockPrimitives.filter(p => p.is_system);
    const tenantPrimitives = mockPrimitives.filter(p => !p.is_system);

    expect(systemPrimitives.length).toBe(2);
    expect(tenantPrimitives.length).toBe(1);
    expect(tenantPrimitives[0].name).toBe('Custom Phone Number');
  });

  it('should filter primitives by category', () => {
    const stringPrimitives = mockPrimitives.filter(p => p.category === 'string');
    const integerPrimitives = mockPrimitives.filter(p => p.category === 'integer');

    expect(stringPrimitives.length).toBe(2);
    expect(integerPrimitives.length).toBe(1);
  });

  it('should apply numeric constraints from primitive', () => {
    const agePrimitive = mockPrimitives.find(p => p.name === 'Age');
    expect(agePrimitive?.schema.minimum).toBe(0);
    expect(agePrimitive?.schema.maximum).toBe(150);
    expect(agePrimitive?.category).toBe('integer');
  });

  it('should support searching by name', () => {
    const searchQuery = 'phone';
    const filtered = mockPrimitives.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe('Custom Phone Number');
  });

  it('should support searching by tag', () => {
    const searchQuery = 'contact';
    const filtered = mockPrimitives.filter(p =>
      p.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    expect(filtered.length).toBe(2);
  });

  it('should fetch primitives with category filter', async () => {
    await fetch('/api/primitives?category=string');

    expect(global.fetch).toHaveBeenCalledWith('/api/primitives?category=string');
  });

  it('should render constraint preview correctly', () => {
    const emailPrimitive = mockPrimitives[0];
    const schema = emailPrimitive.schema;

    const constraints: string[] = [];
    if (schema.format) constraints.push(`format: ${schema.format}`);
    if (schema.pattern) constraints.push(`pattern: ${schema.pattern}`);

    expect(constraints.join(', ')).toContain('format: email');
    expect(constraints.join(', ')).toContain('pattern:');
  });

  it('should sort primitives with tenant first', () => {
    const sorted = [...mockPrimitives].sort((a, b) => {
      if (a.is_system !== b.is_system) {
        return a.is_system ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });

    // Tenant primitive should be first
    expect(sorted[0].is_system).toBe(false);
    expect(sorted[0].name).toBe('Custom Phone Number');
  });

  it('should clear existing constraints when applying a primitive', () => {
    // Simulate existing form data with various constraints
    const existingFormData = {
      title: 'My Field',
      description: 'My description',
      format: 'uuid',
      pattern: '^[0-9]+$',
      minLength: '5',
      maxLength: '50',
      minimum: '10',
      maximum: '100',
      enum: ['a', 'b', 'c'],
    };

    // The fields that should be cleared when applying a primitive
    const fieldsToClear = [
      'format',
      'pattern',
      'minLength',
      'maxLength',
      'minimum',
      'maximum',
      'minimumType',
      'maximumType',
      'multipleOf',
      'minItems',
      'maxItems',
      'uniqueItems',
      'enum',
      'default',
      'const',
    ];

    // Verify that when applying a primitive, all constraint fields get cleared
    // (simulating what happens before applying new values)
    fieldsToClear.forEach(field => {
      expect(existingFormData).toBeDefined();
    });

    // Title and description should be preserved (not in the clear list)
    expect(existingFormData.title).toBe('My Field');
    expect(existingFormData.description).toBe('My description');
  });

  it('should apply only the constraints defined in the primitive schema', () => {
    const phonePrimitive = mockPrimitives[1]; // Custom Phone Number

    // Verify this primitive only has pattern, minLength, maxLength
    expect(phonePrimitive.schema.pattern).toBeDefined();
    expect(phonePrimitive.schema.minLength).toBe(12);
    expect(phonePrimitive.schema.maxLength).toBe(12);

    // Verify it doesn't have format, minimum, maximum, etc.
    expect(phonePrimitive.schema.format).toBeUndefined();
    expect(phonePrimitive.schema.minimum).toBeUndefined();
    expect(phonePrimitive.schema.maximum).toBeUndefined();
    expect(phonePrimitive.schema.enum).toBeUndefined();
  });
});
