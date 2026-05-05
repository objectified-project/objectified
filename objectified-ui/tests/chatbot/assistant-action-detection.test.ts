import {
  detectChatQuickActions,
  extractFirstJsonOrYamlFenceBody,
  parseClassDefinitionFromAssistantMarkdown,
} from '../../src/app/ade/studio/components/chatbot/assistant-action-detection';

describe('extractFirstJsonOrYamlFenceBody', () => {
  it('prefers JSON over YAML even when YAML appears first', () => {
    const md = [
      'Intro',
      '```yaml',
      'a: 1',
      '```',
      '```json',
      '{"x":1}',
      '```',
    ].join('\n');
    expect(extractFirstJsonOrYamlFenceBody(md)).toBe('{"x":1}');
  });

  it('falls back to yaml when no json fence exists', () => {
    const md = '```yaml\nhello: world\n```';
    expect(extractFirstJsonOrYamlFenceBody(md)).toBe('hello: world');
  });

  it('returns null when there are no json or yaml fences', () => {
    expect(extractFirstJsonOrYamlFenceBody('```ts\nconst x = 1\n```')).toBeNull();
  });
});

describe('detectChatQuickActions', () => {
  it('detects bold-wrapped phrases case-insensitively', () => {
    const md = 'Please review.\n\n**Create this class**\n\n**Add these properties**';
    const kinds = detectChatQuickActions(md).map((a) => a.kind);
    expect(kinds).toContain('create_class');
    expect(kinds).toContain('batch_add_properties');
  });

  it('includes copy when phrase and a json fence are present', () => {
    const md = [
      '**Copy to clipboard**',
      '',
      '```json',
      '{"ok":true}',
      '```',
    ].join('\n');
    const actions = detectChatQuickActions(md);
    const copy = actions.find((a) => a.kind === 'copy_generated_payload');
    expect(copy && copy.kind === 'copy_generated_payload' ? copy.payload : '').toBe('{"ok":true}');
  });

  it('omits copy when the phrase is missing even if json exists', () => {
    const md = '```json\n{}\n```';
    expect(detectChatQuickActions(md).some((a) => a.kind === 'copy_generated_payload')).toBe(false);
  });

  it('dedupes by action kind', () => {
    const md = 'Create this class\n\ncreate this class';
    const kinds = detectChatQuickActions(md).map((a) => a.kind);
    expect(kinds.filter((k) => k === 'create_class').length).toBe(1);
  });
});

describe('parseClassDefinitionFromAssistantMarkdown', () => {
  it('parses name, description, and schema from the first json fence', () => {
    const md = [
      'Here you go.',
      '',
      '```json',
      JSON.stringify({
        name: 'User',
        description: 'A user',
        schema: { type: 'object', properties: { email: { type: 'string' } } },
      }),
      '```',
    ].join('\n');
    const parsed = parseClassDefinitionFromAssistantMarkdown(md);
    expect(parsed?.name).toBe('User');
    expect(parsed?.description).toBe('A user');
    expect(parsed?.schema).toEqual({ type: 'object', properties: { email: { type: 'string' } } });
  });

  it('returns null when the json block is missing name or schema', () => {
    expect(parseClassDefinitionFromAssistantMarkdown('```json\n{}\n```')).toBeNull();
    expect(parseClassDefinitionFromAssistantMarkdown('no fence')).toBeNull();
  });
});
