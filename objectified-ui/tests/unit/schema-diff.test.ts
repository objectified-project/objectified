/**
 * Unit tests for schema-diff utility
 * Tests the comparison logic for OpenAPI schema differences
 */

import { compareSchemas, getPathLabel, type DiffSummary } from '../../lib/schema-diff';

describe('Schema Diff Utility', () => {
  describe('compareSchemas', () => {
    it('should detect added classes', () => {
      const spec1 = {
        openapi: '3.1.0',
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'string' }
              }
            }
          }
        }
      };

      const spec2 = {
        openapi: '3.1.0',
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'string' }
              }
            },
            Product: {
              type: 'object',
              properties: {
                name: { type: 'string' }
              }
            }
          }
        }
      };

      const result = compareSchemas(spec1, spec2);

      expect(result.added.length).toBeGreaterThan(0);
      const addedSchema = result.added.find(d => d.path === 'schemas.Product' && d.itemType === 'schema');
      expect(addedSchema).toBeDefined();
      expect(addedSchema?.type).toBe('added');
    });

    it('should detect removed classes', () => {
      const spec1 = {
        openapi: '3.1.0',
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'string' }
              }
            },
            OldClass: {
              type: 'object',
              properties: {
                data: { type: 'string' }
              }
            }
          }
        }
      };

      const spec2 = {
        openapi: '3.1.0',
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'string' }
              }
            }
          }
        }
      };

      const result = compareSchemas(spec1, spec2);

      expect(result.removed.length).toBeGreaterThan(0);
      const removedSchema = result.removed.find(d => d.path === 'schemas.OldClass' && d.itemType === 'schema');
      expect(removedSchema).toBeDefined();
      expect(removedSchema?.type).toBe('removed');
    });

    it('should detect added properties', () => {
      const spec1 = {
        openapi: '3.1.0',
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'string' }
              }
            }
          }
        }
      };

      const spec2 = {
        openapi: '3.1.0',
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string', format: 'email' }
              }
            }
          }
        }
      };

      const result = compareSchemas(spec1, spec2);

      const addedProperty = result.added.find(d => d.path === 'schemas.User.properties.email');
      expect(addedProperty).toBeDefined();
      expect(addedProperty?.itemType).toBe('property');
      expect(addedProperty?.type).toBe('added');
    });

    it('should detect removed properties', () => {
      const spec1 = {
        openapi: '3.1.0',
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                deprecated: { type: 'string' }
              }
            }
          }
        }
      };

      const spec2 = {
        openapi: '3.1.0',
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'string' }
              }
            }
          }
        }
      };

      const result = compareSchemas(spec1, spec2);

      const removedProperty = result.removed.find(d => d.path === 'schemas.User.properties.deprecated');
      expect(removedProperty).toBeDefined();
      expect(removedProperty?.itemType).toBe('property');
      expect(removedProperty?.type).toBe('removed');
    });

    it('should detect modified properties', () => {
      const spec1 = {
        openapi: '3.1.0',
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                age: { type: 'string' }
              }
            }
          }
        }
      };

      const spec2 = {
        openapi: '3.1.0',
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                age: { type: 'number', minimum: 0 }
              }
            }
          }
        }
      };

      const result = compareSchemas(spec1, spec2);

      const modifiedProperty = result.modified.find(d => d.path === 'schemas.User.properties.age');
      expect(modifiedProperty).toBeDefined();
      expect(modifiedProperty?.itemType).toBe('property');
      expect(modifiedProperty?.type).toBe('modified');
      expect(modifiedProperty?.changes).toContain('type');
    });

    it('should detect modified schema with required changes', () => {
      const spec1 = {
        openapi: '3.1.0',
        components: {
          schemas: {
            User: {
              type: 'object',
              required: ['id'],
              properties: {
                id: { type: 'string' },
                email: { type: 'string' }
              }
            }
          }
        }
      };

      const spec2 = {
        openapi: '3.1.0',
        components: {
          schemas: {
            User: {
              type: 'object',
              required: ['id', 'email'],
              properties: {
                id: { type: 'string' },
                email: { type: 'string' }
              }
            }
          }
        }
      };

      const result = compareSchemas(spec1, spec2);

      const modifiedSchema = result.modified.find(d => d.path === 'schemas.User' && d.itemType === 'schema');
      expect(modifiedSchema).toBeDefined();
      expect(modifiedSchema?.changes).toContain('required');
    });
  });

  describe('getPathLabel', () => {
    it('should format schema paths correctly', () => {
      expect(getPathLabel('schemas.User')).toBe('User');
      expect(getPathLabel('schemas.Product')).toBe('Product');
    });

    it('should format property paths correctly', () => {
      expect(getPathLabel('schemas.User.properties.email')).toBe('User.email');
      expect(getPathLabel('schemas.Product.properties.price')).toBe('Product.price');
    });

    it('should return original path for unknown formats', () => {
      expect(getPathLabel('unknown.path')).toBe('unknown.path');
    });
  });

  describe('complex scenarios', () => {
    it('should handle schemas with no components', () => {
      const spec1 = { openapi: '3.1.0' };
      const spec2 = { openapi: '3.1.0' };

      const result = compareSchemas(spec1, spec2);

      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(0);
      expect(result.modified.length).toBe(0);
    });

    it('should handle multiple simultaneous changes', () => {
      const spec1 = {
        openapi: '3.1.0',
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' }
              }
            },
            OldClass: {
              type: 'object',
              properties: {
                data: { type: 'string' }
              }
            }
          }
        }
      };

      const spec2 = {
        openapi: '3.1.0',
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' }
              }
            },
            NewClass: {
              type: 'object',
              properties: {
                value: { type: 'number' }
              }
            }
          }
        }
      };

      const result = compareSchemas(spec1, spec2);

      // Should have additions (NewClass and User.email)
      expect(result.added.length).toBeGreaterThan(0);

      // Should have removals (OldClass)
      expect(result.removed.length).toBeGreaterThan(0);

      // User schema should remain (with modifications)
      const userInAdded = result.added.find(d => d.path.includes('User'));
      expect(userInAdded).toBeDefined();
    });
  });
});

