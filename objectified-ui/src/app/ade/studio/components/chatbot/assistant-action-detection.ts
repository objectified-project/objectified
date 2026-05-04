/**
 * Quick-action phrase detection for Studio AI chat (#518).
 *
 * When an assistant message contains specific CTAs (plain or wrapped in
 * markdown bold), the chat shell surfaces matching buttons. Copy uses the
 * first ```json``` / ```yaml``` / ```yml``` fence in the message as payload.
 */

export type StudioChatWorkspaceActionKind = 'create_class' | 'batch_add_properties' | 'apply_current_class';

export interface StudioChatWorkspaceAction {
  kind: StudioChatWorkspaceActionKind;
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
