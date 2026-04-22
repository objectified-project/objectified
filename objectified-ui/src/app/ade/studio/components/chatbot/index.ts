/** Barrel exports for the Studio AI chatbot building blocks (#258, #259). */

export { ChatBubble } from './ChatBubble';
export type { ChatBubbleProps } from './ChatBubble';
export { ChatCodeBlock, renderHighlighted } from './ChatCodeBlock';
export type { ChatCodeBlockProps } from './ChatCodeBlock';
export { ChatComposer } from './ChatComposer';
export type { ChatComposerProps } from './ChatComposer';
export { ChatContextChip } from './ChatContextChip';
export type { ChatContextChipProps } from './ChatContextChip';
export { ChatConversation } from './ChatConversation';
export type { ChatConversationProps } from './ChatConversation';
export { ChatTypingIndicator } from './ChatTypingIndicator';
export {
  buildChatContextPreamble,
  CHAT_CONTEXT_CLASS_CAP,
  CHAT_CONTEXT_DESCRIPTION_CHAR_CAP,
  CHAT_CONTEXT_PROPERTY_CAP,
  CHAT_CONTEXT_SCHEMA_CHAR_CAP,
  CHAT_CONTEXT_SELECTION_CAP,
  EMPTY_CHAT_STUDIO_CONTEXT,
  getSelectedClasses,
  injectChatContext,
  isChatStudioContextEmpty,
  summarizeChatStudioContext,
} from './chat-context';
export type {
  ChatStudioClass,
  ChatStudioContext,
  ChatStudioProject,
  ChatStudioProperty,
  ChatStudioVersion,
} from './chat-context';
export { createDemoChatResponder } from './demo-responder';
export {
  detectOpenApiSpecs,
  hasOpenApiSpec,
} from './openapi-detection';
export type { DetectedOpenApiSpec } from './openapi-detection';
export type { ChatFeedback, ChatMessage, ChatRole, ChatSendContext, ChatSendFn } from './types';
