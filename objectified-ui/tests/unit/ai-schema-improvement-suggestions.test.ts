import { parseAiSchemaImprovementSuggestionsResponse } from '../../lib/ai-schema-improvement-suggestions';

describe('parseAiSchemaImprovementSuggestionsResponse', () => {
  it('parses a valid fenced JSON payload', () => {
    const md = `intro\n\n\`\`\`json\n{"thinking":"t","summary":"s","suggestions":[{"title":"Add docs","detail":"Fill descriptions","category":"documentation"}]}\n\`\`\``;
    const p = parseAiSchemaImprovementSuggestionsResponse(md);
    expect(p).not.toBeNull();
    expect(p!.suggestions).toHaveLength(1);
    expect(p!.suggestions[0].title).toBe('Add docs');
    expect(p!.suggestions[0].category).toBe('documentation');
  });

  it('uses last json fence when multiple exist', () => {
    const md =
      '```json\n{"thinking":"","summary":"","suggestions":[{"title":"a","detail":"d","category":"other"}]}\n```\n\n```json\n{"thinking":"","summary":"","suggestions":[{"title":"b","detail":"d2","category":"naming"}]}\n```';
    const p = parseAiSchemaImprovementSuggestionsResponse(md);
    expect(p?.suggestions[0].title).toBe('b');
  });

  it('returns null when suggestions empty', () => {
    const md = "```json\n{\"thinking\":\"x\",\"summary\":\"y\",\"suggestions\":[]}\n```";
    expect(parseAiSchemaImprovementSuggestionsResponse(md)).toBeNull();
  });

  it('skips rows missing title or detail', () => {
    const md =
      "```json\n{\"thinking\":\"\",\"summary\":\"\",\"suggestions\":[{\"title\":\"\",\"detail\":\"x\",\"category\":\"other\"},{\"title\":\"ok\",\"detail\":\"\",\"category\":\"other\"},{\"title\":\"good\",\"detail\":\"body\",\"category\":\"api\"}]}\n```";
    const r = parseAiSchemaImprovementSuggestionsResponse(md);
    expect(r?.suggestions).toEqual([{ title: 'good', detail: 'body', category: 'api' }]);
  });

  it('normalizes unknown category to other', () => {
    const md =
      '```json\n{"thinking":"","summary":"","suggestions":[{"title":"x","detail":"y","category":"not-a-real-category"}]}\n```';
    const r = parseAiSchemaImprovementSuggestionsResponse(md);
    expect(r?.suggestions[0].category).toBe('other');
  });

  it('returns null when no json fence', () => {
    expect(parseAiSchemaImprovementSuggestionsResponse('no fence')).toBeNull();
  });
});
