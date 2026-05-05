/**
 * Detect Studio chat prompts that ask for schema output from a plain-language
 * description (#267), without requiring words like "OpenAPI" or "spec".
 */

const SPEC_HINT_NEEDLES = ['openapi', 'spec', 'schema', 'api'] as const;

const DESCRIPTION_INTENT_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(create|build|design|sketch|model|define|map out)\s+(a|an|the|my|our)\b/i,
  /\b(i|we)\s+(need|want)\s+(a|an|the|my|our|to\s+model|to\s+design|to\s+build)\b/i,
  /\b(class|classes|entity|entities)\s+(with|for|named|called|that|having)\b/i,
  /\b(data|domain|object)\s+model\b/i,
  /\b(user\s+stor(y|ies)|requirements(\s+document)?|requirements?\s+for)\b/i,
  /\bpaste(d)?\s+(the\s+)?requirements\b/i,
];

const SMALL_TALK_PREFIX =
  /^(hi|hello|hey|thanks|thank you|ok|okay|bye|good morning|good afternoon)\b/i;

const MODELING_VOCAB =
  /\b(class|classes|entity|entities|schema|schemas|model|models|field|fields|property|properties|type|types|object|objects|record|records|table|tables|attribute|attributes)\b/i;

const MIN_CHARS = 16;
const MIN_CHARS_WITHOUT_MODELING_TERMS = 28;

/**
 * True when the user is likely asking for generated OpenAPI components/schemas
 * from a written description (possibly multi-sentence or pasted).
 */
export function userPromptRequestsSchemaFromDescription(prompt: string): boolean {
  const trimmed = prompt.trim();
  if (trimmed.length < MIN_CHARS) return false;

  const lower = trimmed.toLowerCase();
  if (SPEC_HINT_NEEDLES.some((n) => lower.includes(n))) return true;

  if (SMALL_TALK_PREFIX.test(trimmed) && trimmed.length < 100) return false;

  if (!DESCRIPTION_INTENT_PATTERNS.some((re) => re.test(trimmed))) return false;

  if (trimmed.length < MIN_CHARS_WITHOUT_MODELING_TERMS && !MODELING_VOCAB.test(trimmed)) {
    return false;
  }

  return true;
}
