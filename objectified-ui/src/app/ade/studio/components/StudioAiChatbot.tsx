'use client';

/**
 * Studio AI Chatbot — placement chrome (#257).
 *
 * Provides the launcher and panel surfaces for the studio chatbot:
 *   - Floating launcher bubble in the bottom right corner of the canvas
 *   - Slide-out panel anchored to the right edge of the studio
 *   - Full-screen chat mode for complex conversations
 *   - Keyboard shortcut to toggle (⌘+Shift+A on macOS, Ctrl+Shift+A elsewhere)
 *
 * The actual chat content (model selection, prompts, streaming, context awareness)
 * lands in subsequent tickets (#258, #259, ...). For now the panel renders a
 * focused placeholder so the placement, controls, and shortcuts can be exercised
 * end-to-end.
 */

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Bot, Maximize2, Minimize2, Sparkles, X } from 'lucide-react';
import { matchesStudioAiChatbotShortcut } from '@/app/utils/studio-keybindings';

/**
 * Open/closed state for the chatbot panel. `slide` is the default expanded mode
 * (right-anchored drawer); `fullscreen` covers the canvas area for longer
 * conversations.
 */
export type StudioAiChatbotMode = 'closed' | 'slide' | 'fullscreen';

/**
 * Pathname prefixes where the chatbot launcher is allowed to appear. Restricted
 * to canvas-style surfaces so the bubble does not float above the dashboard,
 * admin, or auth pages.
 */
const CHATBOT_CANVAS_PATH_PREFIXES: readonly string[] = [
  '/ade/studio/editor',
  '/ade/studio/paths',
];

const SLIDE_PANEL_WIDTH_CLASSES = 'w-full max-w-md sm:w-[26rem]';

export function isStudioAiChatbotPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return CHATBOT_CANVAS_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export interface StudioAiChatbotProps {
  /**
   * Override the path-based gating used in production. Useful for tests and
   * for previewing the placement on other surfaces.
   */
  forceVisible?: boolean;
  /** Optional initial mode (defaults to `closed`). */
  initialMode?: StudioAiChatbotMode;
}

/**
 * Mounts the chatbot launcher and panel. Safe to render once at the studio
 * layout level; it gates itself based on the current pathname.
 */
export function StudioAiChatbot({ forceVisible, initialMode = 'closed' }: StudioAiChatbotProps = {}) {
  const pathname = usePathname();
  const [mode, setMode] = React.useState<StudioAiChatbotMode>(initialMode);

  const visible = forceVisible || isStudioAiChatbotPath(pathname);

  const open = mode !== 'closed';
  const close = React.useCallback(() => setMode('closed'), []);
  const toggle = React.useCallback(() => {
    setMode((prev) => (prev === 'closed' ? 'slide' : 'closed'));
  }, []);

  React.useEffect(() => {
    if (!visible) return;
    const handler = (ev: KeyboardEvent) => {
      if (!matchesStudioAiChatbotShortcut(ev)) return;
      ev.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [visible, toggle]);

  React.useEffect(() => {
    if (!open) return;
    const handler = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape' || ev.defaultPrevented) return;
      ev.preventDefault();
      close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, close]);

  if (!visible) return null;

  return (
    <>
      {!open && <ChatbotLauncher onOpen={() => setMode('slide')} />}
      {open && (
        <ChatbotPanel
          mode={mode}
          onModeChange={setMode}
          onClose={close}
        />
      )}
    </>
  );
}

interface ChatbotLauncherProps {
  onOpen: () => void;
}

function ChatbotLauncher({ onOpen }: ChatbotLauncherProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open AI chatbot"
      data-testid="studio-ai-chatbot-launcher"
      className="fixed bottom-8 right-6 z-[1300] inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-xl ring-1 ring-black/10 transition-transform hover:scale-105 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 dark:ring-white/10"
    >
      <Sparkles className="h-6 w-6" />
    </button>
  );
}

interface ChatbotPanelProps {
  mode: Exclude<StudioAiChatbotMode, 'closed'>;
  onModeChange: (mode: StudioAiChatbotMode) => void;
  onClose: () => void;
}

function ChatbotPanel({ mode, onModeChange, onClose }: ChatbotPanelProps) {
  const isFullscreen = mode === 'fullscreen';

  const containerClasses = isFullscreen
    ? 'fixed inset-4 sm:inset-8'
    : `fixed bottom-8 right-6 top-32 ${SLIDE_PANEL_WIDTH_CLASSES}`;

  const toggleFullscreen = () =>
    onModeChange(isFullscreen ? 'slide' : 'fullscreen');

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="AI chatbot"
      data-testid="studio-ai-chatbot-panel"
      data-mode={mode}
      className={`${containerClasses} z-[1301] flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50 px-4 py-3 dark:border-gray-700 dark:from-purple-950/40 dark:to-indigo-950/40">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
            <Bot className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              AI Chatbot
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isFullscreen ? 'Full-screen chat' : 'Studio side panel'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit full-screen chat' : 'Expand chat to full screen'}
            data-testid="studio-ai-chatbot-toggle-fullscreen"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI chatbot"
            data-testid="studio-ai-chatbot-close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <ChatbotComingSoon />
      </div>

      <footer className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-[11px] text-gray-500 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-400">
        Toggle this panel any time with{' '}
        <kbd className="rounded border border-gray-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
          ⌘⇧A
        </kbd>
        {' / '}
        <kbd className="rounded border border-gray-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
          Ctrl+Shift+A
        </kbd>
        .
      </footer>
    </div>
  );
}

const COMING_SOON_FEATURES: readonly string[] = [
  'Natural-language schema design and refinement',
  'Context-aware responses about your current project and version',
  'One-click "create class" and "add properties" actions',
  'Conversation history per project, with export and search',
];

function ChatbotComingSoon() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <span className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 text-purple-600 dark:from-purple-900/40 dark:to-indigo-900/40 dark:text-purple-300">
        <Sparkles className="h-8 w-8" />
      </span>
      <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
        Studio AI is on the way
      </h2>
      <p className="mb-6 max-w-sm text-sm text-gray-600 dark:text-gray-400">
        This panel is the new home for the Studio chatbot. The conversation surface
        ships in the next release; for now it gives you a stable place to expect it.
      </p>
      <ul className="w-full max-w-sm space-y-2 text-left text-sm text-gray-600 dark:text-gray-400">
        {COMING_SOON_FEATURES.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500 dark:bg-indigo-400"
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default StudioAiChatbot;
