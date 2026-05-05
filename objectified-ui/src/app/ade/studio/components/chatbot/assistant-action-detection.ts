/**
 * Quick-action phrase detection for Studio AI chat (#518).
 *
 * When an assistant message contains specific CTAs (plain or wrapped in
 * markdown bold), the chat shell surfaces matching buttons. Copy uses the
 * first non-empty ```json```/```jsonc``` fence anywhere in the message (even if a
 * ```yaml```/```yml``` fence appears earlier), falling back to the first non-empty
 * ```yaml```/```yml``` fence when no JSON/JSONC fence exists.
 */

export type StudioChatWorkspaceActionKind = 'create_class' | 'batch_add_properties' | 'apply_current_class';

export interface StudioChatWorkspaceAction {
  kind: StudioChatWorkspaceActionKind;
  /**
   * Raw assistant markdown from chat after the user confirms **Create this class**
   * in the preview dialog (#528). The layout opens Add Class in AI mode with this
   * message seeded so the user can review and create.
   */
  assistantMarkdown?: string;
}

/** Parsed `{ name, description, schema }` from a ```json``` block in assistant output. */
export interface ParsedAiClassDefinition {
  name: string;
  description: string | null;
  schema: unknown;
}

export type DetectedChatQuickAction =
  | { kind: 'create_class' }
  | { kind: 'batch_add_properties' }
  | { kind: 'apply_current_class' }
  | { kind: 'copy_generated_payload'; payload: string };

const FENCE_RE = /```([a-zA-Z0-9_-]+)\s*\n([\s\S]*?)```/g;

function phrasePresent(markdown: string, phrase: string): boolean {
  return markdown.toLowerCase().includes(phrase.toLowerCase());
}

/**
 * First non-empty ```json``` / ```jsonc``` body, else first ```yaml``` / ```yml```.
 */
export function extractFirstJsonOrYamlFenceBody(markdown: string): string | null {
  if (!markdown) return null;
  FENCE_RE.lastIndex = 0;
  let firstJson: string | null = null;
  let firstYaml: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = FENCE_RE.exec(markdown)) !== null) {
    const lang = m[1].toLowerCase();
    const body = m[2].trim();
    if (!body) continue;
    if ((lang === 'json' || lang === 'jsonc') && firstJson === null) {
      firstJson = body;
    }
    if ((lang === 'yaml' || lang === 'yml') && firstYaml === null) {
      firstYaml = body;
    }
  }
  return firstJson ?? firstYaml ?? null;
}

/**
 * Extracts the class skeleton JSON from assistant markdown (same shape as the
 * Create Class with AI flow in ClassEditDialog).
 *
 * Uses {@link extractFirstJsonOrYamlFenceBody} so that both ```json and
 * ```jsonc fences are accepted and a trailing newline before the closing
 * fence is not required.
 */
export function parseClassDefinitionFromAssistantMarkdown(content: string): ParsedAiClassDefinition | null {
  if (!content) return null;
  const body = extractFirstJsonOrYamlFenceBody(content);
  if (!body) return null;
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    if (!parsed || typeof parsed.name !== 'string' || !parsed.schema) return null;
    const name = parsed.name.replace(/[^A-Za-z0-9_]/g, '') || '';
    if (!name) return null;
    return {
      name,
      description: typeof parsed.description === 'string' ? parsed.description : null,
      schema: parsed.schema,
    };
  } catch {
    return null;
  }
}

/**
 * Returns quick actions in stable UI order. Kinds are unique; `copy_generated_payload`
 * is only included when the phrase appears and a JSON/YAML fence exists.
 */
export function detectChatQuickActions(markdown: string): DetectedChatQuickAction[] {
  if (!markdown) return [];
  const out: DetectedChatQuickAction[] = [];
  const seen = new Set<DetectedChatQuickAction['kind']>();

  const push = (action: DetectedChatQuickAction) => {
    if (seen.has(action.kind)) return;
    seen.add(action.kind);
    out.push(action);
  };

  if (phrasePresent(markdown, 'create this class')) {
    push({ kind: 'create_class' });
  }
  if (phrasePresent(markdown, 'add these properties')) {
    push({ kind: 'batch_add_properties' });
  }
  if (phrasePresent(markdown, 'apply to current class')) {
    push({ kind: 'apply_current_class' });
  }
  if (phrasePresent(markdown, 'copy to clipboard')) {
    const payload = extractFirstJsonOrYamlFenceBody(markdown);
    if (payload) {
      push({ kind: 'copy_generated_payload', payload });
    }
  }

  return out;
}
