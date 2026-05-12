'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { DeveloperModeServerSnapshot } from '@/lib/developer-mode-server';

export type DeveloperModeContextValue = DeveloperModeServerSnapshot & {
  setDeveloperModeEnabled: (next: boolean) => Promise<{ ok: boolean; error?: string }>;
};

const DeveloperModeContext = createContext<DeveloperModeContextValue | null>(null);

type Props = {
  initial: DeveloperModeServerSnapshot;
  children: React.ReactNode;
};

async function postTelemetry(from: 'off' | 'on', to: 'off' | 'on') {
  try {
    await fetch('/api/v1/telemetry/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'developer_mode.toggled',
        properties: { from, to },
      }),
    });
  } catch {
    /* non-blocking */
  }
}

export function DeveloperModeProvider({ initial, children }: Props) {
  const [entitled] = useState(initial.entitled);
  const [planCode] = useState(initial.planCode);
  const [signedIn] = useState(initial.signedIn);
  const [developerModeEnabled, setLocal] = useState(initial.developerModeEnabled);

  const setDeveloperModeEnabled = useCallback(
    async (next: boolean) => {
      const prev = developerModeEnabled;
      if (next && !entitled) {
        return { ok: false as const, error: 'not_entitled' };
      }
      if (next === prev) {
        return { ok: true as const };
      }
      try {
        const res = await fetch('/api/v1/users/me/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ developerModeEnabled: next }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const msg =
            typeof err?.detail === 'string'
              ? err.detail
              : typeof err?.error === 'string'
              ? err.error
              : 'Failed to save preference';
          return { ok: false as const, error: msg };
        }
        setLocal(next);
        const from: 'off' | 'on' = prev ? 'on' : 'off';
        const to: 'off' | 'on' = next ? 'on' : 'off';
        void postTelemetry(from, to);
        return { ok: true as const };
      } catch (e) {
        return { ok: false as const, error: e instanceof Error ? e.message : 'Network error' };
      }
    },
    [developerModeEnabled, entitled]
  );

  const value = useMemo<DeveloperModeContextValue>(
    () => ({
      signedIn,
      entitled,
      planCode,
      developerModeEnabled,
      setDeveloperModeEnabled,
    }),
    [signedIn, entitled, planCode, developerModeEnabled, setDeveloperModeEnabled]
  );

  return <DeveloperModeContext.Provider value={value}>{children}</DeveloperModeContext.Provider>;
}

export function useDeveloperMode(): DeveloperModeContextValue | null {
  return useContext(DeveloperModeContext);
}
