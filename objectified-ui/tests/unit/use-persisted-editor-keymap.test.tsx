/**
 * @jest-environment jsdom
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { usePersistedEditorKeymap } from '@/lib/objectified-editor/use-persisted-editor-keymap';

describe('usePersistedEditorKeymap', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
  });

  it('does not fetch when disabled', () => {
    global.fetch = jest.fn();
    const { result } = renderHook(() => usePersistedEditorKeymap(false));
    expect(result.current.hydrated).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('hydrates keymap from preferences API', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ preferences: { editorKeymap: 'vim' } }),
    });
    const { result } = renderHook(() => usePersistedEditorKeymap(true));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.keymap).toBe('vim');
  });

  it('falls back to localStorage when GET is not ok', async () => {
    window.localStorage.setItem('objectified-editor-keymap', 'vim');
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    const { result } = renderHook(() => usePersistedEditorKeymap(true));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.keymap).toBe('vim');
  });

  it('persists keymap via PUT and localStorage', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ preferences: {} }),
    });
    const { result } = renderHook(() => usePersistedEditorKeymap(true));
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    await act(async () => {
      await result.current.setKeymap('vim');
    });

    expect(window.localStorage.getItem('objectified-editor-keymap')).toBe('vim');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/users/me/preferences',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ editorKeymap: 'vim' }),
      }),
    );
  });

  it('sets hydrated to true immediately when enabled transitions to false', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ preferences: { editorKeymap: 'vim' } }),
    });

    let enabled = true;
    const { result, rerender } = renderHook(() => usePersistedEditorKeymap(enabled));

    // Wait until hydrated from the server fetch.
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    // Transition enabled → false; hydrated should remain/become true immediately.
    act(() => {
      enabled = false;
      rerender();
    });

    expect(result.current.hydrated).toBe(true);
  });

  it('re-hydrates when enabled transitions from false to true', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ preferences: { editorKeymap: 'vim' } }),
    });

    let enabled = false;
    const { result, rerender } = renderHook(() => usePersistedEditorKeymap(enabled));

    // Initially disabled → immediately hydrated.
    expect(result.current.hydrated).toBe(true);

    // Transition to enabled → should fetch and re-hydrate.
    act(() => {
      enabled = true;
      rerender();
    });

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.keymap).toBe('vim');
  });
});

