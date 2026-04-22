'use client';

import * as React from 'react';
import { Loader2, Send } from 'lucide-react';

/**
 * Chat composer (#258).
 *
 * Auto-grows the textarea up to a soft cap, submits on Enter, inserts a
 * newline on Shift+Enter, and exposes a Send button that disables itself
 * while the assistant is responding or when the field is empty.
 */
export interface ChatComposerProps {
  /** Submit the trimmed text. The composer clears itself on success. */
  onSend: (text: string) => void;
  /** Disables the textarea & button (e.g. while waiting for a response). */
  isBusy?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

const MAX_HEIGHT_PX = 160;

export function ChatComposer({
  onSend,
  isBusy = false,
  placeholder = 'Ask the Studio AI…',
  autoFocus,
}: ChatComposerProps) {
  const [value, setValue] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const resize = React.useCallback(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, []);

  React.useEffect(() => {
    resize();
  }, [value, resize]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || isBusy) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const canSend = value.trim().length > 0 && !isBusy;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex items-end gap-2 border-t border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        autoFocus={autoFocus}
        disabled={isBusy}
        aria-label="Chat message"
        data-testid="studio-ai-chat-input"
        className="min-h-[2.25rem] w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-inner placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
      />
      <button
        type="submit"
        disabled={!canSend}
        aria-label={isBusy ? 'Waiting for response' : 'Send message'}
        data-testid="studio-ai-chat-send"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </button>
    </form>
  );
}
