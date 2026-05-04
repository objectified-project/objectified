/**
 * Shared abort-error detection for the Studio chatbot stack.
 *
 * Both the UI shell (ChatConversation) and the Ollama responder need to
 * distinguish AbortError from genuine failures so they can suppress noise
 * and surface partial streamed text instead of an error message.
 */

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { name?: string }).name === 'AbortError')
  );
}
