/**
 * Tests for the offline demo responder used by the Studio chatbot (#258, #259).
 *
 * Covers both the "no context" baseline behaviour designers see in isolated
 * previews and the context-aware grounding wired up in #259 — project /
 * version mention, canvas selection acknowledgement, and reuse of existing
 * class / property names inside the sample OpenAPI spec.
 */

import { createDemoChatResponder } from '../../src/app/ade/studio/components/chatbot/demo-responder';
import { detectOpenApiSpecs } from '../../src/app/ade/studio/components/chatbot/openapi-detection';
import {
  EMPTY_CHAT_STUDIO_CONTEXT,
  type ChatStudioContext,
} from '../../src/app/ade/studio/components/chatbot/chat-context';

const richContext: ChatStudioContext = {
  project: { id: 'proj-1', name: 'Acme Catalog' },
  version: { id: 'ver-1', label: 'v2.0.0' },
  classes: [
    { id: 'cls-cart', name: 'Cart', description: 'Shopping cart' },
    { id: 'cls-product', name: 'Product', description: 'Catalog item' },
  ],
  properties: [
    { id: 'prop-sku', name: 'sku', type: 'string', description: 'Stock keeping unit' },
    { id: 'prop-qty', name: 'quantity', type: 'integer', description: 'Units in cart' },
  ],
  selectedClassIds: ['cls-cart'],
};

describe('createDemoChatResponder', () => {
  const responder = createDemoChatResponder();

  it('returns an OpenAPI spec when the prompt mentions a spec keyword', async () => {
    const reply = await responder({
      messages: [],
      prompt: 'Generate an OpenAPI spec for me',
      isRegenerate: false,
    });
    expect(reply).toMatch(/```json/);
    expect(detectOpenApiSpecs(reply)).toHaveLength(1);
  });

  it('returns a generic onboarding reply for unrelated prompts', async () => {
    const reply = await responder({
      messages: [],
      prompt: 'tell me a joke',
      isRegenerate: false,
    });
    expect(reply).toMatch(/Markdown/);
    expect(detectOpenApiSpecs(reply)).toHaveLength(0);
  });

  it('annotates the reply when the user regenerates', async () => {
    const reply = await responder({
      messages: [],
      prompt: 'tell me a joke',
      isRegenerate: true,
    });
    expect(reply).toMatch(/Regenerated/);
  });

  it('treats an empty studio context the same as no context', async () => {
    const reply = await responder({
      messages: [],
      prompt: 'tell me a joke',
      isRegenerate: false,
      studioContext: EMPTY_CHAT_STUDIO_CONTEXT,
    });
    expect(reply).not.toMatch(/Acme Catalog/);
    expect(reply).not.toMatch(/v2\.0\.0/);
  });

  it('mentions the project, version, and selection when context is present', async () => {
    const reply = await responder({
      messages: [],
      prompt: 'tell me a joke',
      isRegenerate: false,
      studioContext: richContext,
    });
    expect(reply).toMatch(/Acme Catalog/);
    expect(reply).toMatch(/v2\.0\.0/);
    expect(reply).toMatch(/Cart/);
  });

  it('embeds the project name and reusable properties in the sample OpenAPI spec', async () => {
    const reply = await responder({
      messages: [],
      prompt: 'sketch a schema for me',
      isRegenerate: false,
      studioContext: richContext,
    });
    const specs = detectOpenApiSpecs(reply);
    expect(specs).toHaveLength(1);
    const spec = specs[0].spec as {
      info: { title: string; version: string };
      components: { schemas: Record<string, { properties: Record<string, unknown> }> };
    };
    expect(spec.info.title).toMatch(/Acme Catalog/);
    expect(spec.info.version).toBe('v2.0.0');
    // The selected class wins as the schema name; reusable properties are inlined.
    const schemaName = Object.keys(spec.components.schemas)[0];
    expect(schemaName).toBe('Cart');
    const props = spec.components.schemas[schemaName].properties;
    expect(props).toHaveProperty('sku');
    expect(props).toHaveProperty('quantity');
  });

  it('falls back to the canonical sample spec when no context is supplied', async () => {
    const reply = await responder({
      messages: [],
      prompt: 'openapi please',
      isRegenerate: false,
    });
    const specs = detectOpenApiSpecs(reply);
    expect(specs).toHaveLength(1);
    const spec = specs[0].spec as {
      info: { title: string };
      components: { schemas: Record<string, unknown> };
    };
    expect(spec.info.title).toBe('Sample Catalog API');
    expect(Object.keys(spec.components.schemas)).toContain('Product');
  });
});
