import fs from 'fs';
import path from 'path';
import { importJsonSchemaFromRepository } from '../../lib/repositories/importers/json-schema';

describe('repository JSON Schema importer hook', () => {
  it('imports Draft 7, 2019-09, and 2020-12 schemas without errors', async () => {
    const fixtures = [
      {
        source: 'repository://schemas/draft-07-customer.json',
        content: JSON.stringify({
          $schema: 'http://json-schema.org/draft-07/schema#',
          $id: 'https://example.com/schemas/customer.json',
          title: 'Customer',
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
            email: { type: 'string', format: 'email' },
          },
        }),
        expectedClass: 'Customer',
        expectedDraft: 'draft-07',
      },
      {
        source: 'repository://schemas/draft-2019-account.json',
        content: JSON.stringify({
          $schema: 'https://json-schema.org/draft/2019-09/schema',
          $id: 'https://example.com/schemas/account.json',
          title: 'Account',
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { enum: ['active', 'disabled'] },
          },
        }),
        expectedClass: 'Account',
        expectedDraft: 'draft-2019-09',
      },
      {
        source: 'repository://schemas/draft-2020-product.json',
        content: JSON.stringify({
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          $id: 'https://example.com/schemas/product.json',
          title: 'Product',
          type: 'object',
          properties: {
            sku: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
          },
        }),
        expectedClass: 'Product',
        expectedDraft: 'draft-2020-12',
      },
    ];

    for (const fixture of fixtures) {
      const result = await importJsonSchemaFromRepository({
        source: fixture.source,
        format: 'json_schema',
        content: fixture.content,
        refs: [],
      });

      expect(result.success).toBe(true);
      const importedClass = result.parseResult?.classes.find((cls) => cls.name === fixture.expectedClass);
      expect(importedClass).toBeDefined();
      expect(importedClass?.isSupported).toBe(true);
      expect(importedClass?.schema?.['x-objectified-source']).toEqual({
        format: 'json_schema',
        draft: fixture.expectedDraft,
        $id: JSON.parse(fixture.content).$id,
      });
    }
  });

  it('matches the existing dialog parser across JSON Schema example fixtures', async () => {
    const fixturesDir = path.join(__dirname, '../../examples/json-schema');
    const fixtures = fs
      .readdirSync(fixturesDir)
      .filter((name) => name.endsWith('.json'))
      .sort();

    expect(fixtures.length).toBeGreaterThan(0);

    for (const fixture of fixtures) {
      const content = fs.readFileSync(path.join(fixturesDir, fixture), 'utf-8');
      const result = await importJsonSchemaFromRepository({
        source: `repository://json-schema/${fixture}`,
        format: 'json_schema',
        content,
        refs: [],
      });

      expect(result.success).toBe(true);
      expect(result.parseResult?.classes.length).toBeGreaterThan(0);
      expect(result.warnings.some((warning) => warning.includes('JSON Schema'))).toBe(true);
    }
  });

  it('preserves composition keywords on imported class schemas', async () => {
    const content = JSON.stringify({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://example.com/schemas/payment-method.json',
      title: 'PaymentMethod',
      type: 'object',
      allOf: [
        {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      ],
      oneOf: [{ $ref: '#/$defs/CardPayment' }, { $ref: '#/$defs/BankPayment' }],
      anyOf: [{ required: ['cardNumber'] }, { required: ['routingNumber'] }],
      $defs: {
        CardPayment: {
          type: 'object',
          properties: {
            cardNumber: { type: 'string' },
          },
        },
        BankPayment: {
          type: 'object',
          properties: {
            routingNumber: { type: 'string' },
          },
        },
      },
    });

    const result = await importJsonSchemaFromRepository({
      source: 'repository://schemas/payment-method.json',
      format: 'json_schema',
      content,
      refs: [],
    });

    expect(result.success).toBe(true);
    const paymentMethod = result.parseResult?.classes.find((cls) => cls.name === 'PaymentMethod');
    expect(paymentMethod?.schema?.allOf).toBeDefined();
    expect(paymentMethod?.schema?.oneOf).toBeDefined();
    expect(paymentMethod?.schema?.anyOf).toBeDefined();
    expect(paymentMethod?.schema?.oneOf[0].$ref).toBe('#/components/schemas/CardPayment');
  });

  it('delegates sibling refs to the REPO-3.8 resolver when refs are present', async () => {
    const unresolved = JSON.stringify({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://example.com/schemas/order.json',
      title: 'Order',
      type: 'object',
      properties: {
        user: { $ref: './user.schema.json' },
      },
    });
    const resolved = JSON.stringify({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://example.com/schemas/order.json',
      title: 'Order',
      type: 'object',
      properties: {
        user: { $ref: '#/$defs/User' },
      },
      $defs: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
      },
    });

    const resolveRefs = jest.fn().mockResolvedValue(resolved);
    const refs = [{ path: './user.schema.json', content: '{"title":"User","type":"object"}' }];

    const result = await importJsonSchemaFromRepository(
      {
        source: 'repository://schemas/order.json',
        format: 'json_schema',
        content: unresolved,
        refs,
      },
      { resolveRefs }
    );

    expect(resolveRefs).toHaveBeenCalledWith({
      source: 'repository://schemas/order.json',
      format: 'json_schema',
      content: unresolved,
      refs,
    });
    expect(result.success).toBe(true);
    expect(result.parseResult?.classes.some((cls) => cls.name === 'Order')).toBe(true);
    expect(result.parseResult?.classes.some((cls) => cls.name === 'User')).toBe(true);
  });

  it('returns success: false when refs are present but no resolver is configured', async () => {
    const result = await importJsonSchemaFromRepository({
      source: 'repository://schemas/order.json',
      format: 'json_schema',
      content: '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object"}',
      refs: [{ path: './user.schema.json', content: '{"type":"object"}' }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/REPO-3\.8/);
  });
});
