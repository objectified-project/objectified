/**
 * Tests for the offline demo responder used by the Studio chatbot (#258).
 */

import { createDemoChatResponder } from '../../src/app/ade/studio/components/chatbot/demo-responder';
import { detectOpenApiSpecs } from '../../src/app/ade/studio/components/chatbot/openapi-detection';

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
});
