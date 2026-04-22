/**
 * Default offline responder used by the Studio AI chatbot until the Ollama
 * adapter lands (#265).
 *
 * The replies are deterministic and intentionally cover every UI affordance
 * the interface guidelines call for so designers and reviewers can see the
 * chrome end-to-end without running a model:
 *   - Markdown rendering (headings, lists, inline code)
 *   - A fenced code block with copy + syntax highlighting
 *   - A ```json``` block holding a small but valid OpenAPI 3.1 spec so the
 *     "Import OpenAPI spec" affordance lights up
 *
 * As of #259 the responder is also context-aware: when the chat shell hands
 * us a `studioContext` snapshot we mention the user's project / version,
 * acknowledge canvas selection, and reuse existing class / property names
 * inside the demo OpenAPI spec. The intent is to give reviewers a faithful
 * preview of how a real backend will ground its replies in the workspace.
 */

import type { ChatStudioContext, ChatStudioProperty } from './chat-context';
import { getSelectedClasses, isChatStudioContextEmpty } from './chat-context';
import type { ChatSendFn } from './types';

const SPEC_DEMO_PROMPTS = ['openapi', 'spec', 'schema', 'api'];

export const createDemoChatResponder = (): ChatSendFn => async ({
  prompt,
  isRegenerate,
  studioContext,
}) => {
  const lower = prompt.toLowerCase();
  const wantsSpec = SPEC_DEMO_PROMPTS.some((needle) => lower.includes(needle));
  const variation = isRegenerate ? '\n\n_Regenerated with a slightly different angle._' : '';
  const groundingLine = describeGrounding(studioContext);

  if (wantsSpec) {
    const spec = buildSampleSpec(studioContext);
    const suggestions = buildContextAwareSuggestions(studioContext);
    return [
      `Here's a small OpenAPI 3.1 sketch for what you described${groundingLine ? ` ${groundingLine}` : ''} — review the JSON below and click **Import OpenAPI spec** to load it into Studio.`,
      '',
      '```json',
      JSON.stringify(spec, null, 2),
      '```',
      '',
      'A few things to consider next:',
      ...suggestions,
    ].join('\n') + variation;
  }

  return [
    `I'm the offline preview of the Studio AI assistant${groundingLine ? ` ${groundingLine}` : ''} — the live model lands in a follow-up ticket. Until then, here's what the chat surface supports today:`,
    '',
    '- **Markdown** rendering with headings, lists, and inline `code`',
    '- Code blocks with copy + syntax highlighting:',
    '',
    '```ts',
    "function greet(name: string): string {",
    "  return `Hello, ${name}!`;",
    "}",
    '```',
    '',
    'Try asking for an "OpenAPI spec" to see the import affordance.',
  ].join('\n') + variation;
};

function describeGrounding(ctx: ChatStudioContext | undefined): string | null {
  if (!ctx || isChatStudioContextEmpty(ctx)) return null;
  const parts: string[] = [];
  const projectName = ctx.project?.name;
  const versionLabel = ctx.version?.label;
  if (projectName && versionLabel) {
    parts.push(`for **${projectName}** ${versionLabel}`);
  } else if (projectName) {
    parts.push(`for **${projectName}**`);
  } else if (versionLabel) {
    parts.push(`on version ${versionLabel}`);
  }
  const selected = getSelectedClasses(ctx).map((cls) => cls.name);
  if (selected.length === 1) {
    parts.push(`while looking at \`${selected[0]}\``);
  } else if (selected.length > 1) {
    const visible = selected.slice(0, 3).map((name) => `\`${name}\``).join(', ');
    const overflow = selected.length - Math.min(selected.length, 3);
    parts.push(`while looking at ${visible}${overflow > 0 ? ` (+${overflow} more)` : ''}`);
  }
  return parts.length > 0 ? `(${parts.join(' ')})` : null;
}

function buildContextAwareSuggestions(ctx: ChatStudioContext | undefined): string[] {
  const suggestions = [
    '- Tighten property descriptions for documentation scoring',
    '- Add `examples` arrays where missing',
    '- Decide whether to expose this through a path operation in a follow-up',
  ];
  if (!ctx || isChatStudioContextEmpty(ctx)) return suggestions;
  const selected = getSelectedClasses(ctx);
  if (selected.length > 0) {
    const names = selected.slice(0, 3).map((cls) => `\`${cls.name}\``).join(', ');
    suggestions.unshift(`- Cross-check the new schema against your selected ${selected.length === 1 ? 'class' : 'classes'} (${names})`);
  } else if (ctx.classes.length > 0) {
    const sample = ctx.classes.slice(0, 3).map((cls) => `\`${cls.name}\``).join(', ');
    suggestions.unshift(`- Reuse the names already in this version when possible (e.g. ${sample})`);
  }
  return suggestions;
}

interface SampleSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  components: {
    schemas: Record<string, {
      type: string;
      description: string;
      properties: Record<string, { type: string; format?: string; description: string; minimum?: number }>;
      required: string[];
    }>;
  };
}

function buildSampleSpec(ctx: ChatStudioContext | undefined): SampleSpec {
  const title = ctx?.project?.name ? `${ctx.project.name} (Studio AI sketch)` : 'Sample Catalog API';
  const version = ctx?.version?.label ?? '0.1.0';
  const className = pickReferenceClassName(ctx) ?? 'Product';
  const properties = buildSpecProperties(ctx);

  return {
    openapi: '3.1.0',
    info: {
      title,
      version,
      description: ctx?.project?.name
        ? `Sketch generated by the Studio AI demo responder, grounded in ${ctx.project.name}.`
        : 'Tiny catalog API generated by the Studio AI demo responder.',
    },
    components: {
      schemas: {
        [className]: {
          type: 'object',
          description: ctx?.project?.name
            ? `A representative ${className} for ${ctx.project.name}.`
            : 'A purchasable item in the catalog.',
          properties,
          required: deriveRequired(properties),
        },
      },
    },
  };
}

function pickReferenceClassName(ctx: ChatStudioContext | undefined): string | null {
  if (!ctx) return null;
  const selected = getSelectedClasses(ctx);
  if (selected.length > 0) return selected[0].name;
  if (ctx.classes.length > 0) return ctx.classes[0].name;
  return null;
}

function buildSpecProperties(
  ctx: ChatStudioContext | undefined
): Record<string, { type: string; format?: string; description: string; minimum?: number }> {
  const fallback: Record<string, { type: string; format?: string; description: string; minimum?: number }> = {
    id: { type: 'string', format: 'uuid', description: 'Catalog identifier' },
    name: { type: 'string', description: 'Display name shown to shoppers' },
    priceCents: { type: 'integer', minimum: 0, description: 'Price in cents' },
  };

  if (!ctx || ctx.properties.length === 0) return fallback;

  const properties: Record<string, { type: string; format?: string; description: string; minimum?: number }> = {};
  for (const prop of ctx.properties.slice(0, 4)) {
    properties[prop.name] = describeReusableProperty(prop);
  }
  if (Object.keys(properties).length === 0) return fallback;
  // Always make sure there's an id-shaped field so the spec is useful as a starting point.
  if (!properties.id) {
    properties.id = { type: 'string', format: 'uuid', description: 'Identifier reused from Studio properties.' };
  }
  return properties;
}

function describeReusableProperty(prop: ChatStudioProperty): {
  type: string;
  format?: string;
  description: string;
  minimum?: number;
} {
  const type = prop.type ?? 'string';
  const description = prop.description?.trim().length
    ? prop.description.trim()
    : `Reused Studio property "${prop.name}".`;
  const entry: { type: string; format?: string; description: string; minimum?: number } = {
    type,
    description,
  };
  if (prop.format) entry.format = prop.format;
  if (type === 'integer' || type === 'number') entry.minimum = 0;
  return entry;
}

function deriveRequired(
  properties: Record<string, { type: string }>
): string[] {
  const required = Object.keys(properties).filter((name) => name === 'id' || name === 'name');
  return required.length > 0 ? required : Object.keys(properties).slice(0, 1);
}
