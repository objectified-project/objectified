'use client';

import * as React from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  X,
  Bot,
  User as UserIcon,
  ChevronDown,
  Square,
  RotateCcw,
  Wand2,
  Plus,
  CircleX,
  CheckCircle2,
} from 'lucide-react';
import * as SelectRadix from '@radix-ui/react-select';
import { Button } from '../../ui/Button';
import { Alert } from '../../ui/Alert';
import { Markdown } from '../../ui/Markdown';
import { cn } from '../../../../../lib/utils';

/**
 * Persistent AI sidekick panel. Slides in from the right edge of the
 * dialog and lives alongside the form so the user can edit and chat at
 * the same time. Replaces the legacy full-modal AI mode.
 *
 * State (messages, model, etc.) is owned by ClassEditDialog because it
 * needs to survive sidekick toggles and is shared with form-mutating
 * handlers. This component is presentational.
 */

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiClassDefinition {
  name: string;
  description: string | null;
  schema: Record<string, unknown>;
}

export interface AiModel {
  name: string;
}

export type PatchState = 'pending' | 'applied' | 'created' | 'rejected';

export interface ClassEditAiSidekickProps {
  open: boolean;
  onClose: () => void;

  messages: AiChatMessage[];
  streamingContent: string;
  loading: boolean;
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onAbort?: () => void;
  onReset: () => void;

  models: AiModel[];
  loadingModels: boolean;
  selectedModel: string;
  onSelectModel: (name: string) => void;

  error?: string;

  /** Parses an assistant message and returns a class definition if found. */
  extractClassDefinition: (content: string) => AiClassDefinition | null;
  /** Per-message patch state map. Keyed by message index. */
  patchStates: Record<number, PatchState>;
  onApplyToForm: (def: AiClassDefinition, messageIndex: number) => void;
  onCreateClass: (content: string, messageIndex: number) => void;
  onRejectPatch: (messageIndex: number) => void;
  /** True if create-class action should be offered (versionId present + new class flow). */
  canCreateClass: boolean;
  /** Read-only forms can still chat but not apply patches. */
  isReadOnly?: boolean;

  isDark?: boolean;
}

const SUGGESTIONS = [
  { emoji: '👤', prompt: 'Create a User class with email, displayName, and createdAt' },
  { emoji: '🛒', prompt: 'Create an Order class with orderId, items array, totalAmount, and status' },
  { emoji: '📦', prompt: 'Create a Product class with name, sku, price, and optional description' },
  { emoji: '📍', prompt: 'Create an Address class with street, city, postalCode, and country' },
];

const MessageBubble: React.FC<{
  message: AiChatMessage;
  index: number;
  patchState: PatchState | undefined;
  classDef: AiClassDefinition | null;
  canApply: boolean;
  canCreateClass: boolean;
  onApplyToForm: (def: AiClassDefinition, idx: number) => void;
  onCreateClass: (content: string, idx: number) => void;
  onRejectPatch: (idx: number) => void;
}> = ({
  message,
  index,
  patchState,
  classDef,
  canApply,
  canCreateClass,
  onApplyToForm,
  onCreateClass,
  onRejectPatch,
}) => {
  const isUser = message.role === 'user';
  const hasPatch = !isUser && classDef !== null;
  const showPatchActions = hasPatch && patchState !== 'rejected';

  return (
    <div className={cn('flex gap-2.5', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mt-0.5">
          <Bot className="h-4 w-4 text-white" />
        </div>
      )}
      <div className={cn('flex flex-col max-w-[88%] min-w-0', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'px-3 py-2 rounded-lg text-sm leading-relaxed',
            isUser
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100',
            hasPatch && 'p-0 overflow-hidden border border-slate-300 dark:border-slate-700 bg-transparent dark:bg-transparent',
          )}
        >
          {hasPatch && classDef ? (
            <div className="flex flex-col">
              <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/40 border-b border-slate-300 dark:border-slate-700">
                <Wand2 className="h-3.5 w-3.5 text-purple-500" />
                <span className="text-[12px] font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {classDef.name}
                </span>
                {patchState === 'applied' && (
                  <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> Applied
                  </span>
                )}
                {patchState === 'created' && (
                  <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> Created
                  </span>
                )}
                {patchState === 'rejected' && (
                  <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-500">
                    <CircleX className="h-3 w-3" /> Rejected
                  </span>
                )}
              </div>
              {classDef.description && (
                <p className="px-3 pt-2 pb-1 m-0 text-[12px] text-slate-600 dark:text-slate-300">
                  {classDef.description}
                </p>
              )}
              <pre className="bg-slate-900 dark:bg-black px-3 py-2 m-0 max-h-56 overflow-auto text-left">
                <code className="text-[11px] font-mono text-emerald-300 whitespace-pre">
                  {JSON.stringify(classDef.schema, null, 2)}
                </code>
              </pre>
            </div>
          ) : (
            <Markdown variant="default" fallback={null}>
              {message.content}
            </Markdown>
          )}
        </div>
        {showPatchActions && classDef && (
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {canApply && patchState !== 'applied' && patchState !== 'created' && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 h-7 text-[12px] border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700/60 dark:text-purple-300 dark:hover:bg-purple-900/20"
                onClick={() => onApplyToForm(classDef, index)}
              >
                <Wand2 className="h-3 w-3" />
                Apply to form
              </Button>
            )}
            {canCreateClass && patchState !== 'created' && (
              <Button
                type="button"
                size="sm"
                className="gap-1.5 h-7 text-[12px] bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                onClick={() => onCreateClass(message.content, index)}
              >
                <Plus className="h-3 w-3" />
                Create class
              </Button>
            )}
            {patchState !== 'applied' && patchState !== 'created' && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="gap-1.5 h-7 text-[12px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                onClick={() => onRejectPatch(index)}
              >
                <CircleX className="h-3 w-3" />
                Reject
              </Button>
            )}
          </div>
        )}
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center mt-0.5">
          <UserIcon className="h-4 w-4 text-white" />
        </div>
      )}
    </div>
  );
};

export const ClassEditAiSidekick: React.FC<ClassEditAiSidekickProps> = ({
  open,
  onClose,
  messages,
  streamingContent,
  loading,
  input,
  onInputChange,
  onSend,
  onAbort,
  onReset,
  models,
  loadingModels,
  selectedModel,
  onSelectModel,
  error,
  extractClassDefinition,
  patchStates,
  onApplyToForm,
  onCreateClass,
  onRejectPatch,
  canCreateClass,
  isReadOnly,
}) => {
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [open, messages, streamingContent]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <aside
      role="complementary"
      aria-label="AI sidekick"
      aria-hidden={!open}
      className={cn(
        'shrink-0 flex flex-col border-l border-slate-200 dark:border-slate-700 bg-gradient-to-b from-purple-50/40 via-white to-indigo-50/30 dark:from-purple-950/20 dark:via-slate-900 dark:to-indigo-950/20',
        'transition-[width,opacity] duration-200 ease-out overflow-hidden',
        open ? 'w-[400px] opacity-100' : 'w-0 opacity-0',
      )}
    >
      {/* Header */}
      <header className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">AI sidekick</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate m-0">
            Suggests classes & schema patches
          </p>
        </div>
        {messages.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-8 w-8 p-0"
            title="Reset conversation"
            aria-label="Reset conversation"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0"
          aria-label="Close sidekick"
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      {/* Model selector */}
      <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 shrink-0">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Model
        </span>
        <SelectRadix.Root
          value={selectedModel}
          onValueChange={onSelectModel}
          disabled={loadingModels || loading}
        >
          <SelectRadix.Trigger className="flex-1 flex items-center gap-1.5 px-2.5 py-1 text-[12px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
            <SelectRadix.Value
              placeholder={loadingModels ? 'Loading…' : 'Select model'}
            />
            <SelectRadix.Icon asChild>
              <ChevronDown className="h-3.5 w-3.5 ml-auto" />
            </SelectRadix.Icon>
          </SelectRadix.Trigger>
          <SelectRadix.Portal>
            <SelectRadix.Content className="bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-1 z-[10000]">
              <SelectRadix.Viewport>
                {models.map((m) => (
                  <SelectRadix.Item
                    key={m.name}
                    value={m.name}
                    className="px-3 py-1.5 text-[12px] text-slate-700 dark:text-slate-300 rounded-md outline-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 data-[state=checked]:bg-indigo-50 data-[state=checked]:text-indigo-700 dark:data-[state=checked]:bg-indigo-900/30 dark:data-[state=checked]:text-indigo-200"
                  >
                    <SelectRadix.ItemText>{m.name}</SelectRadix.ItemText>
                  </SelectRadix.Item>
                ))}
              </SelectRadix.Viewport>
            </SelectRadix.Content>
          </SelectRadix.Portal>
        </SelectRadix.Root>
      </div>

      {error && <Alert variant="error" className="m-3 mb-0 text-xs">{error}</Alert>}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.length === 0 && !streamingContent && (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-12 h-12 mb-3 bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-xl flex items-center justify-center">
              <Bot className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Ask the sidekick
            </h3>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-4 max-w-xs">
              Describe a class to scaffold or ask for changes. Replies with a
              JSON definition can be applied to the form or created in one
              click.
            </p>
            <div className="flex flex-col gap-1.5 w-full">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.prompt}
                  type="button"
                  onClick={() => onInputChange(s.prompt)}
                  className="px-3 py-2 text-[12px] text-left text-slate-700 dark:text-slate-300 bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 rounded-md transition-colors border border-slate-200 dark:border-slate-700"
                >
                  <span className="mr-1.5">{s.emoji}</span>
                  {s.prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => {
          const classDef =
            message.role === 'assistant' ? extractClassDefinition(message.content) : null;
          return (
            <MessageBubble
              key={index}
              message={message}
              index={index}
              patchState={patchStates[index]}
              classDef={classDef}
              canApply={!isReadOnly}
              canCreateClass={canCreateClass && !isReadOnly}
              onApplyToForm={onApplyToForm}
              onCreateClass={onCreateClass}
              onRejectPatch={onRejectPatch}
            />
          );
        })}

        {loading && !streamingContent && (
          <div className="flex gap-2.5 justify-start">
            <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-slate-500 dark:bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-500 dark:bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-500 dark:bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-[12px] text-slate-600 dark:text-slate-400">Thinking…</span>
            </div>
          </div>
        )}

        {streamingContent && (
          <div className="flex gap-2.5 justify-start">
            <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 max-w-[88%]">
              <Markdown variant="default" fallback={null}>
                {streamingContent}
              </Markdown>
              <span className="inline-block w-1.5 h-3.5 ml-1 bg-slate-700 dark:bg-slate-200 animate-pulse align-middle" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-slate-200 dark:border-slate-700 p-3 bg-white/60 dark:bg-slate-900/60 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={loading ? 'Generating…' : 'Describe a class or ask for changes…'}
            rows={2}
            disabled={loading || !selectedModel}
            className="flex-1 px-3 py-2 text-[13px] border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 resize-none"
          />
          {loading && onAbort ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onAbort}
              className="gap-1.5 h-9"
              title="Stop generating"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              Stop
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={onSend}
              disabled={loading || !input.trim() || !selectedModel}
              className="gap-1.5 h-9 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Send
            </Button>
          )}
        </div>
        <p className="mt-1.5 mb-0 text-[10.5px] text-slate-500 dark:text-slate-400 text-center">
          AI suggestions are advisory — review patches before applying.
        </p>
      </div>
    </aside>
  );
};
