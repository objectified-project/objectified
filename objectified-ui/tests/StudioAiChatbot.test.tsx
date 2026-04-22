/**
 * Unit tests for the Studio AI chatbot placement chrome (#257).
 *
 * Covers:
 *   - Visibility gating against the current pathname (canvas surfaces only).
 *   - Launcher → slide-out panel transition on click.
 *   - Slide-out → fullscreen toggle and back.
 *   - Closing via the close button and via the Escape key.
 *   - ⌘+Shift+A / Ctrl+Shift+A keyboard toggle.
 */

import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
  StudioAiChatbot,
  isStudioAiChatbotPath,
} from '../src/app/ade/studio/components/StudioAiChatbot';

const mockUsePathname = jest.fn<string | null, []>();
jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

beforeEach(() => {
  mockUsePathname.mockReset();
});

describe('isStudioAiChatbotPath', () => {
  it('matches studio canvas surfaces', () => {
    expect(isStudioAiChatbotPath('/ade/studio/editor')).toBe(true);
    expect(isStudioAiChatbotPath('/ade/studio/editor?foo=bar')).toBe(true);
    expect(isStudioAiChatbotPath('/ade/studio/paths')).toBe(true);
    expect(isStudioAiChatbotPath('/ade/studio/paths/123')).toBe(true);
  });

  it('does not match unrelated surfaces', () => {
    expect(isStudioAiChatbotPath('/ade/studio')).toBe(false);
    expect(isStudioAiChatbotPath('/ade/studio/code')).toBe(false);
    expect(isStudioAiChatbotPath('/ade/dashboard')).toBe(false);
    expect(isStudioAiChatbotPath('/admin/users')).toBe(false);
    expect(isStudioAiChatbotPath(null)).toBe(false);
    expect(isStudioAiChatbotPath(undefined)).toBe(false);
  });
});

describe('StudioAiChatbot', () => {
  it('renders nothing on non-canvas pathnames', () => {
    mockUsePathname.mockReturnValue('/ade/dashboard');
    const { container } = render(<StudioAiChatbot />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders only the launcher when closed on a canvas page', () => {
    mockUsePathname.mockReturnValue('/ade/studio/editor');
    render(<StudioAiChatbot />);

    expect(screen.getByTestId('studio-ai-chatbot-launcher')).toBeInTheDocument();
    expect(screen.queryByTestId('studio-ai-chatbot-panel')).not.toBeInTheDocument();
  });

  it('opens the slide-out panel when the launcher is clicked', () => {
    mockUsePathname.mockReturnValue('/ade/studio/editor');
    render(<StudioAiChatbot />);

    fireEvent.click(screen.getByTestId('studio-ai-chatbot-launcher'));

    const panel = screen.getByTestId('studio-ai-chatbot-panel');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute('data-mode', 'slide');
    expect(screen.queryByTestId('studio-ai-chatbot-launcher')).not.toBeInTheDocument();
  });

  it('toggles between slide-out and fullscreen', () => {
    mockUsePathname.mockReturnValue('/ade/studio/editor');
    render(<StudioAiChatbot initialMode="slide" />);

    const toggle = screen.getByTestId('studio-ai-chatbot-toggle-fullscreen');
    fireEvent.click(toggle);
    expect(screen.getByTestId('studio-ai-chatbot-panel')).toHaveAttribute('data-mode', 'fullscreen');

    fireEvent.click(screen.getByTestId('studio-ai-chatbot-toggle-fullscreen'));
    expect(screen.getByTestId('studio-ai-chatbot-panel')).toHaveAttribute('data-mode', 'slide');
  });

  it('closes via the close button', () => {
    mockUsePathname.mockReturnValue('/ade/studio/paths');
    render(<StudioAiChatbot initialMode="slide" />);

    fireEvent.click(screen.getByTestId('studio-ai-chatbot-close'));

    expect(screen.queryByTestId('studio-ai-chatbot-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('studio-ai-chatbot-launcher')).toBeInTheDocument();
  });

  it('closes when Escape is pressed', () => {
    mockUsePathname.mockReturnValue('/ade/studio/editor');
    render(<StudioAiChatbot initialMode="slide" />);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(screen.queryByTestId('studio-ai-chatbot-panel')).not.toBeInTheDocument();
  });

  it('toggles open/closed with Ctrl+Shift+A', () => {
    mockUsePathname.mockReturnValue('/ade/studio/editor');
    render(<StudioAiChatbot />);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, shiftKey: true })
      );
    });
    expect(screen.getByTestId('studio-ai-chatbot-panel')).toHaveAttribute('data-mode', 'slide');

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, shiftKey: true })
      );
    });
    expect(screen.queryByTestId('studio-ai-chatbot-panel')).not.toBeInTheDocument();
  });

  it('also responds to the ⌘+Shift+A combination', () => {
    mockUsePathname.mockReturnValue('/ade/studio/editor');
    render(<StudioAiChatbot />);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'a', metaKey: true, shiftKey: true })
      );
    });
    expect(screen.getByTestId('studio-ai-chatbot-panel')).toHaveAttribute('data-mode', 'slide');
  });

  it('ignores the keyboard shortcut on non-canvas pages', () => {
    mockUsePathname.mockReturnValue('/ade/dashboard');
    render(<StudioAiChatbot />);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, shiftKey: true })
      );
    });
    expect(screen.queryByTestId('studio-ai-chatbot-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('studio-ai-chatbot-launcher')).not.toBeInTheDocument();
  });

  it('respects forceVisible when the pathname would otherwise hide the chatbot', () => {
    mockUsePathname.mockReturnValue('/ade/dashboard');
    render(<StudioAiChatbot forceVisible />);
    expect(screen.getByTestId('studio-ai-chatbot-launcher')).toBeInTheDocument();
  });
});
