'use client';

import { useCallback, useEffect, useState } from 'react';
import type { EditorKeymap } from './types';

const STORAGE_KEY = 'objectified-editor-keymap';

function normalizeKeymap(raw: unknown): EditorKeymap | null {
  return raw === 'vim' || raw === 'vscode' ? raw : null;
}

async function readServerKeymap(): Promise<EditorKeymap | null> {
  try {
    const res = await fetch('/api/v1/users/me/preferences', { cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as { preferences?: Record<string, unknown> };
    const prefs = body?.preferences;
    if (!prefs || typeof prefs !== 'object') return null;
    return normalizeKeymap(prefs.editorKeymap);
  } catch {
    return null;
  }
}

function readLocalKeymap(): EditorKeymap | null {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeKeymap(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeLocalKeymap(k: EditorKeymap) {
  try {
    window.localStorage.setItem(STORAGE_KEY, k);
  } catch {
    /* ignore */
  }
}

/**
 * Loads `editorKeymap` from `GET /api/v1/users/me/preferences` when signed in,
 * otherwise falls back to {@link STORAGE_KEY} in `localStorage`. Updates persist
 * via `PUT` with the same key; failed writes still update local storage.
 */
export function usePersistedEditorKeymap(enabled: boolean): {
  keymap: EditorKeymap;
  setKeymap: (next: EditorKeymap) => Promise<void>;
  hydrated: boolean;
} {
  const [keymap, setKeymapState] = useState<EditorKeymap>('vscode');
  const [hydrated, setHydrated] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setHydrated(true);
      return;
    }
    let cancelled = false;
    (async () => {
      if (!cancelled) {
        setHydrated(false);
      }
      const fromServer = await readServerKeymap();
      const fromLocal = readLocalKeymap();
      const next = fromServer ?? fromLocal ?? 'vscode';
      if (!cancelled) {
        setKeymapState(next);
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const setKeymap = useCallback(async (next: EditorKeymap) => {
    setKeymapState(next);
    writeLocalKeymap(next);
    if (!enabled) return;
    try {
      const res = await fetch('/api/v1/users/me/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editorKeymap: next }),
      });
      if (!res.ok) {
        /* preference API may 401 when logged out — localStorage already updated */
      }
    } catch {
      /* network — localStorage already updated */
    }
  }, [enabled]);

  return { keymap, setKeymap, hydrated };
}
