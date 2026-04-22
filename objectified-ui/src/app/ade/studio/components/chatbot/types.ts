/**
 * Studio AI chatbot — shared types (#258).
 *
 * The chat surface is intentionally backend-agnostic so the same UI can host
 * the offline demo responder today and a streaming Ollama transport later
 * (#259, #265). Anything UI-facing lives here.
 */

export type ChatRole = 'user' | 'assistant';

export type ChatFeedback = 'up' | 'down';

export interface ChatMessage {
  /** Stable id for keys, regenerate, and feedback toggles. */
  id: string;
  role: ChatRole;
  /** Markdown source. Rendered with `react-markdown` + chatbot components. */
  content: string;
  /** True while the assistant turn is still streaming/thinking. */
  pending?: boolean;
  /** Most recent feedback the user gave on an assistant message, if any. */
  feedback?: ChatFeedback;
}

export interface ChatSendContext {
  /** Full transcript including the new user message — useful for backends. */
  messages: ChatMessage[];
  /** Convenience pointer to the just-sent user message. */
  prompt: string;
  /** True when the caller asked the assistant to redo its previous answer. */
  isRegenerate: boolean;
}

/**
 * Adapter the chat shell calls when the user submits or regenerates. Returns
 * the assistant's full markdown reply. Implementations may stream internally;
 * the shell only renders the resolved value.
 */
export type ChatSendFn = (ctx: ChatSendContext) => Promise<string>;
