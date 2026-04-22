/** Barrel exports for the Studio AI chatbot building blocks (#258). */

export { ChatBubble } from './ChatBubble';
export type { ChatBubbleProps } from './ChatBubble';
export { ChatCodeBlock, renderHighlighted } from './ChatCodeBlock';
export type { ChatCodeBlockProps } from './ChatCodeBlock';
export { ChatComposer } from './ChatComposer';
export type { ChatComposerProps } from './ChatComposer';
export { ChatConversation } from './ChatConversation';
export type { ChatConversationProps } from './ChatConversation';
export { ChatTypingIndicator } from './ChatTypingIndicator';
export { createDemoChatResponder } from './demo-responder';
export {
  detectOpenApiSpecs,
  hasOpenApiSpec,
} from './openapi-detection';
export type { DetectedOpenApiSpec } from './openapi-detection';
export type { ChatFeedback, ChatMessage, ChatRole, ChatSendContext, ChatSendFn } from './types';
