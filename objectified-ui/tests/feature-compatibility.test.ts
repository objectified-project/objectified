/**
 * Unit tests for Feature Compatibility (#573): identify unsupported features
 * in OpenAPI/spec documents during pre-import analysis.
 */

import { analyzeSpecification, UnsupportedFeature } from '../src/app/utils/openapi-analyzer';

describe('Feature compatibility – unsupported features (#573)', () => {
  describe('result shape', () => {
    it('always returns unsupportedFeatures array on analysis result', async () => {
      const minimal = `
openapi: 3.1.0
info:
  title: Minimal
  version: 1.0.0
components:
  schemas:
    Foo:
      type: object
      properties:
        id:
          type: string
`;
      const analysis = await analyzeSpecification(minimal, 'minimal.yaml');
      expect(analysis).toHaveProperty('unsupportedFeatures');
      expect(Array.isArray(analysis.unsupportedFeatures)).toBe(true);
    });

    it('each unsupported feature has required fields', async () => {
      const withExternalRef = `
openapi: 3.1.0
info:
  title: With ref
  version: 1.0.0
components:
  schemas:
    A:
      type: object
      properties:
        ext:
          $ref: 'https://example.com/schema.json#/External'
`;
      const analysis = await analyzeSpecification(withExternalRef, 'spec.yaml');
      expect(analysis.unsupportedFeatures.length).toBeGreaterThan(0);
      analysis.unsupportedFeatures.forEach((f: UnsupportedFeature) => {
        expect(f).toHaveProperty('id');
        expect(typeof f.id).toBe('string');
        expect(f.id.length).toBeGreaterThan(0);
        expect(f).toHaveProperty('label');
        expect(typeof f.label).toBe('string');
        expect(f).toHaveProperty('description');
        expect(typeof f.description).toBe('string');
        expect(f).toHaveProperty('severity');
        expect(['warning', 'info']).toContain(f.severity);
      });
    });
  });

  describe('no unsupported features', () => {
    it('returns empty unsupportedFeatures for minimal valid OpenAPI with simple schemas', async () => {
      const minimal = `
openapi: 3.1.0
info:
  title: Simple API
  version: 1.0.0
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
`;
      const analysis = await analyzeSpecification(minimal, 'minimal.yaml');
      expect(analysis.unsupportedFeatures).toEqual([]);
    });
  });

  describe('external references', () => {
    it('detects external $ref and reports external-refs with warning severity', async () => {
      const spec = `
openapi: 3.1.0
info:
  title: External refs
  version: 1.0.0
components:
  schemas:
    A:
      type: object
      properties:
        ref1:
          $ref: 'https://example.com/schema.json#/External'
`;
      const analysis = await analyzeSpecification(spec, 'spec.yaml');
      const f = analysis.unsupportedFeatures.find(x => x.id === 'external-refs');
      expect(f).toBeDefined();
      expect(f?.severity).toBe('warning');
      expect(f?.count).toBe(1);
    });

    it('counts multiple external refs', async () => {
      const spec = `
openapi: 3.1.0
info:
  title: Multiple refs
  version: 1.0.0
components:
  schemas:
    A:
      type: object
      properties:
        a:
          $ref: 'https://a.com/s.json'
        b:
          $ref: 'https://b.com/s.json'
`;
      const analysis = await analyzeSpecification(spec, 'spec.yaml');
      const f = analysis.unsupportedFeatures.find(x => x.id === 'external-refs');
      expect(f).toBeDefined();
      expect(f?.count).toBe(2);
    });

    it('does not report in-document $ref as unsupported', async () => {
      const spec = `
openapi: 3.1.0
info:
  title: Local refs
  version: 1.0.0
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
    RefUser:
      type: object
      properties:
        user:
          $ref: '#/components/schemas/User'
`;
      const analysis = await analyzeSpecification(spec, 'spec.yaml');
      const f = analysis.unsupportedFeatures.find(x => x.id === 'external-refs');
      expect(f).toBeUndefined();
    });
  });

  describe('variant-type schemas (oneOf/anyOf only)', () => {
    it('detects oneOf-only schema with no properties', async () => {
      const spec = `
openapi: 3.1.0
info:
  title: Variant
  version: 1.0.0
components:
  schemas:
    StringOrInt:
      oneOf:
        - type: string
        - type: integer
`;
      const analysis = await analyzeSpecification(spec, 'spec.yaml');
      const f = analysis.unsupportedFeatures.find(x => x.id === 'oneof-anyof-only');
      expect(f).toBeDefined();
      expect(f?.severity).toBe('warning');
      expect(f?.count).toBe(1);
    });

    it('detects anyOf-only schema', async () => {
      const spec = `
openapi: 3.1.0
info:
  title: AnyOf
  version: 1.0.0
components:
  schemas:
    Flexible:
      anyOf:
        - type: string
        - type: number
`;
      const analysis = await analyzeSpecification(spec, 'spec.yaml');
      const f = analysis.unsupportedFeatures.find(x => x.id === 'oneof-anyof-only');
      expect(f).toBeDefined();
      expect(f?.count).toBe(1);
    });

    it('does not flag schema with oneOf and inline properties', async () => {
      const spec = `
openapi: 3.1.0
info:
  title: Mixed
  version: 1.0.0
components:
  schemas:
    WithProps:
      type: object
      properties:
        id:
          type: string
      oneOf:
        - type: object
          properties:
            kind:
              type: string
`;
      const analysis = await analyzeSpecification(spec, 'spec.yaml');
      const f = analysis.unsupportedFeatures.find(x => x.id === 'oneof-anyof-only');
      expect(f).toBeUndefined();
    });
  });

  describe('conditional schemas (if/then/else)', () => {
    it('detects if/then/else in schema', async () => {
      const spec = `
openapi: 3.1.0
info:
  title: Conditional
  version: 1.0.0
components:
  schemas:
    Conditional:
      type: object
      if:
        properties:
          type:
            const: A
      then:
        required: [name]
      properties:
        type:
          type: string
        name:
          type: string
`;
      const analysis = await analyzeSpecification(spec, 'spec.yaml');
      const f = analysis.unsupportedFeatures.find(x => x.id === 'conditional-schemas');
      expect(f).toBeDefined();
      expect(f?.severity).toBe('info');
      expect((f?.count ?? 0)).toBeGreaterThan(0);
    });
  });

  describe('patternProperties', () => {
    it('detects patternProperties in schema', async () => {
      const spec = `
openapi: 3.1.0
info:
  title: Pattern props
  version: 1.0.0
components:
  schemas:
    WithPattern:
      type: object
      properties:
        id:
          type: string
      patternProperties:
        "^x-":
          type: string
`;
      const analysis = await analyzeSpecification(spec, 'spec.yaml');
      const f = analysis.unsupportedFeatures.find(x => x.id === 'pattern-properties');
      expect(f).toBeDefined();
      expect(f?.severity).toBe('info');
    });
  });

  describe('discriminator', () => {
    it('detects discriminator on schema', async () => {
      const spec = `
openapi: 3.1.0
info:
  title: Discriminator
  version: 1.0.0
components:
  schemas:
    Polymorphic:
      type: object
      discriminator:
        propertyName: kind
      properties:
        kind:
          type: string
`;
      const analysis = await analyzeSpecification(spec, 'spec.yaml');
      const f = analysis.unsupportedFeatures.find(x => x.id === 'discriminator');
      expect(f).toBeDefined();
      expect(f?.count).toBe(1);
      expect(f?.path).toBeDefined();
    });
  });

  describe('callbacks', () => {
    it('detects operation callbacks', async () => {
      const spec = `
openapi: 3.1.0
info:
  title: Callbacks
  version: 1.0.0
paths:
  /subscribe:
    post:
      summary: Subscribe
      callbacks:
        onData:
          "{$request.body#/url}":
            post:
              summary: Callback
components:
  schemas:
    Empty:
      type: object
`;
      const analysis = await analyzeSpecification(spec, 'spec.yaml');
      const f = analysis.unsupportedFeatures.find(x => x.id === 'callbacks');
      expect(f).toBeDefined();
      expect(f?.count).toBe(1);
      expect(f?.path).toBe('paths');
    });
  });

  describe('webhooks', () => {
    it('detects webhooks section (OpenAPI 3.1)', async () => {
      const spec = `
openapi: 3.1.0
info:
  title: Webhooks
  version: 1.0.0
webhooks:
  onEvent:
    post:
      summary: Webhook
components:
  schemas:
    Empty:
      type: object
`;
      const analysis = await analyzeSpecification(spec, 'spec.yaml');
      const f = analysis.unsupportedFeatures.find(x => x.id === 'webhooks');
      expect(f).toBeDefined();
      expect(f?.count).toBe(1);
      expect(f?.path).toBe('webhooks');
    });
  });

  describe('readOnly / writeOnly', () => {
    it('detects readOnly on property', async () => {
      const spec = `
openapi: 3.1.0
info:
  title: ReadOnly
  version: 1.0.0
components:
  schemas:
    Entity:
      type: object
      properties:
        id:
          type: string
          readOnly: true
        name:
          type: string
`;
      const analysis = await analyzeSpecification(spec, 'spec.yaml');
      const f = analysis.unsupportedFeatures.find(x => x.id === 'readonly-writeonly');
      expect(f).toBeDefined();
      expect(f?.count).toBe(1);
      expect(f?.severity).toBe('info');
    });

    it('detects writeOnly on property', async () => {
      const spec = `
openapi: 3.1.0
info:
  title: WriteOnly
  version: 1.0.0
components:
  schemas:
    Credentials:
      type: object
      properties:
        password:
          type: string
          writeOnly: true
`;
      const analysis = await analyzeSpecification(spec, 'spec.yaml');
      const f = analysis.unsupportedFeatures.find(x => x.id === 'readonly-writeonly');
      expect(f).toBeDefined();
      expect(f?.count).toBe(1);
    });
  });

  describe('multiple unsupported features', () => {
    it('reports all applicable features in one analysis', async () => {
      const spec = `
openapi: 3.1.0
info:
  title: Many features
  version: 1.0.0
webhooks:
  w1:
    post:
      summary: W1
paths:
  /p:
    post:
      callbacks:
        c1:
          "https://example.com":
            post: {}
components:
  schemas:
    Variant:
      oneOf:
        - type: string
        - type: integer
    WithExtRef:
      type: object
      properties:
        ext:
          $ref: 'https://example.com/schema.json'
    WithDiscriminator:
      type: object
      discriminator:
        propertyName: type
      properties:
        type:
          type: string
    WithReadOnly:
      type: object
      properties:
        id:
          type: string
          readOnly: true
`;
      const analysis = await analyzeSpecification(spec, 'spec.yaml');

      expect(analysis.unsupportedFeatures.length).toBeGreaterThanOrEqual(4);

      expect(analysis.unsupportedFeatures.some(x => x.id === 'external-refs')).toBe(true);
      expect(analysis.unsupportedFeatures.some(x => x.id === 'oneof-anyof-only')).toBe(true);
      expect(analysis.unsupportedFeatures.some(x => x.id === 'discriminator')).toBe(true);
      expect(analysis.unsupportedFeatures.some(x => x.id === 'callbacks')).toBe(true);
      expect(analysis.unsupportedFeatures.some(x => x.id === 'webhooks')).toBe(true);
      expect(analysis.unsupportedFeatures.some(x => x.id === 'readonly-writeonly')).toBe(true);
    });
  });

  describe('converted formats', () => {
    it('reports unsupported features on Swagger 2 converted to OpenAPI 3.1', async () => {
      const swagger = `
swagger: "2.0"
info:
  title: Swagger with external ref
  version: 1.0.0
definitions:
  Model:
    type: object
    properties:
      ref:
        $ref: 'https://other.com/schema.json'
`;
      const analysis = await analyzeSpecification(swagger, 'swagger.yaml');
      expect(analysis.format === 'swagger' || analysis.format === 'openapi').toBe(true);
      expect(analysis.unsupportedFeatures).toBeDefined();
      const f = analysis.unsupportedFeatures.find(x => x.id === 'external-refs');
      expect(f).toBeDefined();
    });
  });
});
