import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

/** Monaco `language` id (e.g. `yaml`, `json`, custom grammars). */
export type ObjectifiedEditorLanguage = string;

/** Keybinding preset: native Monaco (VS Code) or Vim via `monaco-vim`. */
export type EditorKeymap = 'vscode' | 'vim';

/**
 * Payload for {@link ObjectifiedEditorProps.onSave}. VFS layers should treat
 * `vfsUri` as the stable document address (e.g. `obj://…`), `value` as the full
 * buffer to persist, and `languageId` as the Monaco model language at save time.
 */
export type ObjectifiedEditorSavePayload = {
  vfsUri: string;
  value: string;
  languageId: string;
};

export type ObjectifiedEditorProps = {
  /** Stable URI for the document (Monaco model path; consumed by VFS / `onSave`). */
  vfsUri: string;
  language: ObjectifiedEditorLanguage;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  className?: string;
  /** Optional class for the inner editor wrapper (height, min-height). */
  editorClassName?: string;
  /**
   * Diagnostic markers for the active model. Applied with `markerOwner` as the
   * Monaco marker owner string (e.g. LSP vs local parse).
   */
  markers?: editor.IMarkerData[];
  markerOwner?: string;
  /**
   * Called when the user invokes the editor save chord (⌘/Ctrl+S). Implementations
   * should persist `value` to the virtual file at `vfsUri` and surface conflicts
   * via their VFS / toast layer.
   */
  onSave?: (payload: ObjectifiedEditorSavePayload) => void | Promise<void>;
  /**
   * When set, keybindings follow this value (controlled). When omitted, the editor
   * loads the persisted user preference (server + local fallback).
   */
  keymap?: EditorKeymap;
  /** Surface a VS Code / Vim toggle that updates persisted preference. */
  showKeymapToggle?: boolean;
  onEditorMount?: (ed: editor.IStandaloneCodeEditor, monaco: Monaco) => void;
};
