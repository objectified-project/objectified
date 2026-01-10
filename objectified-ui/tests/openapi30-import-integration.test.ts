/**
 * Integration tests for OpenAPI 3.0 import functionality
 */

import fs from 'fs';
import path from 'path';
import { parseOpenAPISpec } from '../src/app/utils/openapi-import';
import { analyzeSpecification } from '../src/app/utils/openapi-analyzer';

describe('OpenAPI 3.0 Import Integration', () => {
  const examplePath = path.join(__dirname, '../examples/openapi/30-openapi-3.0-petstore.yaml');

  it('should successfully import OpenAPI 3.0 petstore example', async () => {
    const content = fs.readFileSync(examplePath, 'utf-8');
    const result = await parseOpenAPISpec(content);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.classes.length).toBeGreaterThan(0);

    // Find Pet class
    const petClass = result.classes.find(c => c.name === 'Pet');
    expect(petClass).toBeDefined();

    // Verify properties exist
    expect(petClass?.properties).toBeDefined();
    const propertyNames = petClass?.properties.map(p => p.name) || [];
    expect(propertyNames).toContain('id');
    expect(propertyNames).toContain('name');
    expect(propertyNames).toContain('tag');
    expect(propertyNames).toContain('age');
    expect(propertyNames).toContain('weight');

    // Verify nullable was converted (tag should now be type array)
    const tagProp = petClass?.properties.find(p => p.name === 'tag');
    expect(tagProp).toBeDefined();
    // After conversion, nullable becomes a type array: ['string', 'null']
    expect(tagProp?.data.type).toEqual(['string', 'null']);

    // Verify exclusiveMinimum was converted (age should have numeric exclusiveMinimum)
    const ageProp = petClass?.properties.find(p => p.name === 'age');
    expect(ageProp).toBeDefined();
    expect(ageProp?.data.exclusiveMinimum).toBe(0);
    expect(ageProp?.data.minimum).toBeUndefined();

    // Verify exclusiveMaximum was converted (weight should have numeric exclusiveMaximum)
    const weightProp = petClass?.properties.find(p => p.name === 'weight');
    expect(weightProp).toBeDefined();
    expect(weightProp?.data.exclusiveMaximum).toBe(500);
    expect(weightProp?.data.maximum).toBeUndefined();

    // Find Category class
    const categoryClass = result.classes.find(c => c.name === 'Category');
    expect(categoryClass).toBeDefined();

    // Verify Category properties
    const categoryPropNames = categoryClass?.properties.map(p => p.name) || [];
    expect(categoryPropNames).toContain('id');
    expect(categoryPropNames).toContain('name');
    expect(categoryPropNames).toContain('description');

    // Verify nullable was converted in Category.description
    const descProp = categoryClass?.properties.find(p => p.name === 'description');
    expect(descProp).toBeDefined();
    expect(descProp?.data.type).toEqual(['string', 'null']);
  });

  it('should provide quality metrics for OpenAPI 3.0 spec', async () => {
    const content = fs.readFileSync(examplePath, 'utf-8');
    const analysis = await analyzeSpecification(content, '30-openapi-3.0-petstore.yaml');

    expect(analysis.qualityScore).toBeDefined();
    expect(analysis.qualityScore.overall).toBeGreaterThan(0);
    expect(analysis.qualityScore.grade).toBeDefined();
    expect(['A', 'B', 'C', 'D', 'F']).toContain(analysis.qualityScore.grade);

    expect(analysis.qualityScore.completeness).toBeGreaterThanOrEqual(0);
    expect(analysis.qualityScore.completeness).toBeLessThanOrEqual(100);

    expect(analysis.qualityScore.consistency).toBeGreaterThanOrEqual(0);
    expect(analysis.qualityScore.consistency).toBeLessThanOrEqual(100);

    expect(analysis.qualityScore.bestPractices).toBeGreaterThanOrEqual(0);
    expect(analysis.qualityScore.bestPractices).toBeLessThanOrEqual(100);
  });

  it('should handle OpenAPI 3.0 with complex schemas', async () => {
    const complexSpec = `
openapi: 3.0.0
info:
  title: Complex API
  version: 1.0.0
components:
  schemas:
    ComplexObject:
      type: object
      properties:
        simpleNullable:
          type: string
          nullable: true
        arrayNullable:
          type: array
          nullable: true
          items:
            type: string
        nestedObject:
          type: object
          nullable: true
          properties:
            field1:
              type: string
            field2:
              type: integer
              minimum: 10
              exclusiveMinimum: true
        allOfExample:
          allOf:
            - type: object
              properties:
                base:
                  type: string
            - type: object
              properties:
                extended:
                  type: string
                  nullable: true
    `;

    const result = await parseOpenAPISpec(complexSpec);

    expect(result.success).toBe(true);
    expect(result.classes.length).toBeGreaterThan(0);

    const complexClass = result.classes.find(c => c.name === 'ComplexObject');
    expect(complexClass).toBeDefined();

    // All nullable fields should be converted to type arrays
    const simpleNullable = complexClass?.properties.find(p => p.name === 'simpleNullable');
    expect(simpleNullable?.data.type).toEqual(['string', 'null']);

    const arrayNullable = complexClass?.properties.find(p => p.name === 'arrayNullable');
    expect(arrayNullable?.data.type).toEqual(['array', 'null']);

    // Nested object should handle nullable
    const nestedObject = complexClass?.properties.find(p => p.name === 'nestedObject');
    expect(nestedObject?.data.type).toEqual(['object', 'null']);
  });

  it('should report warnings for OpenAPI 3.0 conversion', async () => {
    const content = fs.readFileSync(examplePath, 'utf-8');
    const result = await parseOpenAPISpec(content);

    expect(result.success).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);

    // Should include conversion warning
    const conversionWarning = result.warnings.some(w =>
      w.includes('3.0') || w.includes('convert')
    );
    expect(conversionWarning).toBe(true);
  });
});

