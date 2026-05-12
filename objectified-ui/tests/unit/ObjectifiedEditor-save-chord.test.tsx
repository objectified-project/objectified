/**
 * @jest-environment jsdom
 *
 * Verifies that the Ctrl/Cmd+S save chord in ObjectifiedEditor calls `onSave`
 * with the documented { vfsUri, value, languageId } payload.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// jsdom doesn't implement window.matchMedia — stub it so useEffect in the
// component that observes `prefers-color-scheme` doesn't throw.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// ── Fake Monaco editor objects ──────────────────────────────────────────────

type CommandCallback = () => void;
const capturedCommands: Array<{ keybinding: number; handler: CommandCallback }> = [];

const mockModel = {
  getValue: jest.fn(() => 'hello world'),
  getLanguageId: jest.fn(() => 'yaml'),
};

const mockEditor = {
  addCommand: jest.fn((keybinding: number, handler: CommandCallback) => {
    capturedCommands.push({ keybinding, handler });
  }),
  getModel: jest.fn(() => mockModel),
};

const mockMonaco = {
  KeyMod: { CtrlCmd: 2048 },
  KeyCode: { KeyS: 31 },
  editor: {
    setModelMarkers: jest.fn(),
    defineTheme: jest.fn(),
    setTheme: jest.fn(),
  },
};

// ── Module mocks ─────────────────────────────────────────────────────────────

// Make next/dynamic pass the factory result through synchronously in tests.
jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (_factory: unknown, _opts?: unknown) => {
    // Return the already-mocked Monaco Editor component directly.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@monaco-editor/react').default;
  },
}));

// Lightweight Monaco Editor stub that immediately calls beforeMount / onMount.
jest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: function MockMonacoEditor(props: {
    beforeMount?: (m: unknown) => void;
    onMount?: (e: unknown, m: unknown) => void;
  }) {
    const called = React.useRef(false);
    React.useEffect(() => {
      if (called.current) return;
      called.current = true;
      props.beforeMount?.(mockMonaco);
      props.onMount?.(mockEditor, mockMonaco);
    });
    return <div data-testid="mock-monaco-editor" />;
  },
}));

jest.mock('@/lib/objectified-editor/monaco-theme-from-dom', () => ({
  OBJECTIFIED_MONACO_THEME_DARK: 'objectified-dark',
  OBJECTIFIED_MONACO_THEME_LIGHT: 'objectified-light',
  registerObjectifiedMonacoThemesFromDom: jest.fn(),
}));

jest.mock('@/lib/objectified-editor/use-persisted-editor-keymap', () => ({
  usePersistedEditorKeymap: () => ({
    keymap: 'vscode' as const,
    setKeymap: jest.fn(),
    hydrated: true,
  }),
}));

// ── Import component after mocks ─────────────────────────────────────────────

import { ObjectifiedEditor } from '@/components/objectified-editor/ObjectifiedEditor';

// ── Tests ────────────────────────────────────────────────────────────────────

const VFS_URI = 'obj://project/schema.yaml';

describe('ObjectifiedEditor — Ctrl/Cmd+S save chord', () => {
  beforeEach(() => {
    capturedCommands.length = 0;
    mockEditor.addCommand.mockClear();
    mockEditor.getModel.mockClear();
    mockModel.getValue.mockClear();
    mockModel.getLanguageId.mockClear();
  });

  it('registers a CtrlCmd+S command on mount', async () => {
    const onSave = jest.fn();
    render(
      <ObjectifiedEditor
        vfsUri={VFS_URI}
        language="yaml"
        value="hello world"
        onSave={onSave}
      />,
    );

    await waitFor(() => expect(mockEditor.addCommand).toHaveBeenCalled());
    // The expected keybinding is CtrlCmd (2048) | KeyS (31) = 2079
    const expectedKeybinding = mockMonaco.KeyMod.CtrlCmd | mockMonaco.KeyCode.KeyS;
    const found = capturedCommands.find((c) => c.keybinding === expectedKeybinding);
    expect(found).toBeDefined();
  });

  it('calls onSave with { vfsUri, value, languageId } when the chord fires', async () => {
    const onSave = jest.fn();
    render(
      <ObjectifiedEditor
        vfsUri={VFS_URI}
        language="yaml"
        value="hello world"
        onSave={onSave}
      />,
    );

    await waitFor(() => expect(capturedCommands.length).toBeGreaterThan(0));

    const expectedKeybinding = mockMonaco.KeyMod.CtrlCmd | mockMonaco.KeyCode.KeyS;
    const saveCommand = capturedCommands.find((c) => c.keybinding === expectedKeybinding);
    expect(saveCommand).toBeDefined();

    // Invoke the save chord handler synchronously.
    saveCommand!.handler();

    // Allow microtasks / Promise.resolve to settle.
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith({
      vfsUri: VFS_URI,
      value: 'hello world',
      languageId: 'yaml',
    });
  });

  it('does not throw when onSave is not provided', async () => {
    render(
      <ObjectifiedEditor
        vfsUri={VFS_URI}
        language="yaml"
        value="hello world"
      />,
    );

    await waitFor(() => expect(capturedCommands.length).toBeGreaterThan(0));

    const expectedKeybinding = mockMonaco.KeyMod.CtrlCmd | mockMonaco.KeyCode.KeyS;
    const saveCommand = capturedCommands.find((c) => c.keybinding === expectedKeybinding);
    expect(saveCommand).toBeDefined();

    // Should not throw even with no onSave handler.
    expect(() => saveCommand!.handler()).not.toThrow();
  });

  it('uses the latest vfsUri ref when onSave fires', async () => {
    const onSave = jest.fn();
    const { rerender } = render(
      <ObjectifiedEditor
        vfsUri={VFS_URI}
        language="yaml"
        value="v1"
        onSave={onSave}
      />,
    );

    await waitFor(() => expect(capturedCommands.length).toBeGreaterThan(0));

    // Update vfsUri via rerender.
    const NEW_URI = 'obj://project/updated.yaml';
    rerender(
      <ObjectifiedEditor
        vfsUri={NEW_URI}
        language="yaml"
        value="v1"
        onSave={onSave}
      />,
    );

    const expectedKeybinding = mockMonaco.KeyMod.CtrlCmd | mockMonaco.KeyCode.KeyS;
    const saveCommand = capturedCommands.find((c) => c.keybinding === expectedKeybinding);
    saveCommand!.handler();

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ vfsUri: NEW_URI }));
  });
});
