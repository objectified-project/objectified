/**
 * Parse structured AI responses for schema_improvement_suggestions (#253).
 * Expects a single ```json ... ``` markdown block from that Ollama task.
 */

/** Maximum number of class names included in an improvement-suggestions request. */
export const CLASS_NAMES_CAP = 150;

export type AiSchemaImprovementCategory =
  | 'documentation'
  | 'naming'
  | 'structure'
  | 'api'
  | 'performance'
  | 'other';

/** Relative implementation cost; quick wins are surfaced first (#254). */
export type AiSchemaImprovementEffort = 'quick_win' | 'moderate' | 'substantial';

export type AiSchemaImprovementSuggestion = {
  title: string;
  detail: string;
  category: AiSchemaImprovementCategory;
  effort: AiSchemaImprovementEffort;
};

export type AiSchemaImprovementSuggestionsPayload = {
  thinking: string;
  summary: string;
  suggestions: AiSchemaImprovementSuggestion[];
};

function extractLastJsonCodeBlock(text: string): string | null {
  const re = /```(?:json)?\s*([\s\S]*?)```/gi;
  let last: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    last = m[1].trim();
  }
  return last;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

const CATEGORIES: ReadonlySet<string> = new Set([
  'documentation',
  'naming',
  'structure',
  'api',
  'performance',
  'other',
]);

function normalizeCategory(raw: unknown): AiSchemaImprovementCategory {
  if (typeof raw === 'string' && CATEGORIES.has(raw.trim())) {
    return raw.trim() as AiSchemaImprovementCategory;
  }
  return 'other';
}

function normalizeEffort(raw: unknown): AiSchemaImprovementEffort {
  if (typeof raw !== 'string') return 'moderate';
  const key = raw.trim().toLowerCase().replace(/-/g, '_');
  if (key === 'quick_win' || key === 'quickwin') return 'quick_win';
  if (key === 'substantial' || key === 'large' || key === 'major') return 'substantial';
  if (key === 'moderate' || key === 'medium') return 'moderate';
  return 'moderate';
}

/** Sort key for display: lower comes first (quick wins at the top). */
export function effortSortRank(effort: AiSchemaImprovementEffort): number {
  switch (effort) {
    case 'quick_win':
      return 0;
    case 'moderate':
      return 1;
    case 'substantial':
      return 2;
  }
}

/**
 * Returns null if the response does not contain valid structured suggestions.
 */
export function parseAiSchemaImprovementSuggestionsResponse(markdown: string): AiSchemaImprovementSuggestionsPayload | null {
  const raw = extractLastJsonCodeBlock(markdown.trim());
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isPlainObject(parsed)) return null;

  const thinking = isNonEmptyString(parsed.thinking) ? parsed.thinking.trim() : '';
  const summary = isNonEmptyString(parsed.summary) ? parsed.summary.trim() : '';
  const suggestionsRaw = parsed.suggestions;

  if (!Array.isArray(suggestionsRaw) || suggestionsRaw.length === 0) return null;

  const suggestions: AiSchemaImprovementSuggestion[] = [];

  for (const item of suggestionsRaw) {
    if (!isPlainObject(item)) continue;
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const detail = typeof item.detail === 'string' ? item.detail.trim() : '';
    if (!title || !detail) continue;
    suggestions.push({
      title,
      detail,
      category: normalizeCategory(item.category),
      effort: normalizeEffort(item.effort),
    });
  }

  if (suggestions.length === 0) return null;

  const ordered = suggestions
    .map((s, originalIndex) => ({ s, originalIndex }))
    .sort((a, b) => {
      const dr = effortSortRank(a.s.effort) - effortSortRank(b.s.effort);
      if (dr !== 0) return dr;
      return a.originalIndex - b.originalIndex;
    })
    .map(({ s }) => s);

  return { thinking, summary, suggestions: ordered };
}
