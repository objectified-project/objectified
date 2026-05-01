import {
  extractRepositoryFileDetailTables,
  parseRepositoryFileSpecMetadata,
} from '@lib/repository-file-spec-metadata';

describe('parseRepositoryFileSpecMetadata', () => {
  it('parses OpenAPI 3 YAML with paths, components, servers', () => {
    const yaml = `
openapi: 3.0.1
info:
  title: Storefront
  version: 3.4.0
paths:
  /a:
    get:
      summary: A
  /b:
    post: {}
    put: {}
servers:
  - url: https://a.example
  - url: https://b.example
components:
  schemas:
    X: {}
    Y: {}
  parameters:
    P: {}
`;
    const m = parseRepositoryFileSpecMetadata(yaml, 'openapi.yaml');
    expect(m.format).toBe('openapi');
    expect(m.spec).toBe('OpenAPI 3.0.1');
    expect(m.title).toBe('Storefront');
    expect(m.version).toBe('3.4.0');
    expect(m.endpoints).toBe(3);
    expect(m.components).toBe(3);
    expect(m.servers).toBe(2);
    expect(m.parseError).toBeNull();
  });

  it('parses OpenAPI 3 JSON including webhooks', () => {
    const doc = {
      openapi: '3.1.0',
      info: { title: 'T', version: '1' },
      paths: { '/x': { delete: {} } },
      webhooks: { newPet: { post: {} } },
      components: { schemas: { A: {} } },
    };
    const m = parseRepositoryFileSpecMetadata(JSON.stringify(doc), 'spec.json');
    expect(m.endpoints).toBe(2);
    expect(m.components).toBe(1);
    expect(m.servers).toBe(0);
  });

  it('parses Swagger 2.0', () => {
    const doc = {
      swagger: '2.0',
      info: { title: 'Legacy', version: 'v2' },
      paths: { '/': { get: {} } },
      definitions: { A: {}, B: {} },
      schemes: ['https', 'http'],
    };
    const m = parseRepositoryFileSpecMetadata(JSON.stringify(doc), 'swagger.json');
    expect(m.format).toBe('swagger2');
    expect(m.spec).toBe('Swagger 2.0');
    expect(m.endpoints).toBe(1);
    expect(m.components).toBe(2);
    expect(m.servers).toBe(2);
  });

  it('parses AsyncAPI 2 channels', () => {
    const yaml = `
asyncapi: '2.6.0'
info:
  title: Events
  version: '1.0'
channels:
  user/signedup:
    subscribe:
      message:
        payload:
          type: object
  orders/created:
    publish:
      message:
        payload:
          type: object
servers:
  prod:
    url: kafka:9092
components:
  messages:
    UserSignedUp: {}
`;
    const m = parseRepositoryFileSpecMetadata(yaml, 'async.yaml');
    expect(m.format).toBe('asyncapi');
    expect(m.spec).toBe('AsyncAPI 2.6.0');
    expect(m.endpoints).toBe(2);
    expect(m.components).toBe(1);
    expect(m.servers).toBe(1);
  });

  it('parses GraphQL SDL', () => {
    const sdl = `
type Query {
  a: Int
  b: String
}
type Mutation {
  create: Boolean
}
`;
    const m = parseRepositoryFileSpecMetadata(sdl, 'schema.graphql');
    expect(m.format).toBe('graphql');
    expect(m.spec).toBe('GraphQL SDL');
    expect(m.endpoints).toBe(3);
  });

  it('parses Arazzo', () => {
    const yaml = `
arazzo: '1.0.0'
info:
  title: My Flows
  version: '0.1.0'
workflows:
  login:
    summary: Login
  checkout:
    summary: Buy
components:
  inputs:
    I: {}
servers:
  - url: https://api.example
`;
    const m = parseRepositoryFileSpecMetadata(yaml, 'flows.arazzo.yaml');
    expect(m.format).toBe('arazzo');
    expect(m.spec).toBe('Arazzo 1.0.0');
    expect(m.title).toBe('My Flows');
    expect(m.version).toBe('0.1.0');
    expect(m.endpoints).toBe(2);
    expect(m.components).toBe(1);
    expect(m.servers).toBe(1);
  });

  it('parses JSON Schema', () => {
    const doc = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: 'Person',
      $defs: { A: {}, B: {}, C: {} },
    };
    const m = parseRepositoryFileSpecMetadata(JSON.stringify(doc), 'person.schema.json');
    expect(m.format).toBe('json_schema');
    expect(m.title).toBe('Person');
    expect(m.components).toBe(3);
    expect(m.endpoints).toBeNull();
    expect(m.servers).toBeNull();
  });
});

describe('extractRepositoryFileDetailTables', () => {
  it('lists OpenAPI paths, schema classes, and properties', () => {
    const yaml = `
openapi: 3.0.1
info:
  title: Storefront
  version: 3.4.0
paths:
  /a:
    get:
      summary: List A
  /b:
    post: {}
components:
  schemas:
    Order:
      type: object
      properties:
        id:
          type: string
        total:
          type: number
`;
    const t = extractRepositoryFileDetailTables(yaml, 'openapi.yaml');
    expect(t.format).toBe('openapi');
    expect(t.parseError).toBeNull();
    expect(t.paths.map((p) => p.template).sort()).toEqual(['/a', '/b']);
    expect(t.paths.some((p) => p.template === '/a' && p.method === 'GET')).toBe(true);
    expect(t.paths.find((p) => p.template === '/a' && p.method === 'GET')?.summary).toBe('List A');
    expect(t.classes.some((c) => c.name === 'Order' && c.kind === 'schemas')).toBe(true);
    expect(t.properties.map((p) => p.name).sort()).toEqual(['id', 'total']);
    expect(t.properties.every((p) => p.context === 'Order')).toBe(true);
  });

  it('maps GraphQL operations to paths and types to classes', () => {
    const sdl = `
type Query {
  item: String
}
type Product {
  sku: ID!
  name: String
}
`;
    const t = extractRepositoryFileDetailTables(sdl, 'schema.graphql');
    expect(t.format).toBe('graphql');
    expect(t.paths.some((p) => p.template === 'item' && p.method === 'Query')).toBe(true);
    expect(t.classes.some((c) => c.name === 'Product' && c.kind === 'type')).toBe(true);
    expect(t.properties.some((p) => p.context === 'Product' && p.name === 'sku')).toBe(true);
  });

  it('returns empty tables for unknown payloads without parse errors', () => {
    const t = extractRepositoryFileDetailTables('hello: world\nfoo', 'notes.txt');
    expect(t.format).toBe('unknown');
    expect(t.paths).toHaveLength(0);
    expect(t.classes).toHaveLength(0);
    expect(t.properties).toHaveLength(0);
  });
});
