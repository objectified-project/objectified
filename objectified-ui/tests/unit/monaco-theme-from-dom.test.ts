/**
 * @jest-environment jsdom
 */

import { objectifiedMonacoThemeColors } from '@/lib/objectified-editor/monaco-theme-from-dom';

describe('objectifiedMonacoThemeColors', () => {
  beforeEach(() => {
    document.documentElement.style.setProperty('--background', '#0a0a0a');
    document.documentElement.style.setProperty('--foreground', '#ededed');
    document.documentElement.style.setProperty('--surface-muted', '#0f172a');
  });

  it('maps CSS variables into Monaco theme color keys', () => {
    const colors = objectifiedMonacoThemeColors(true);
    expect(colors['editorGutter.background']).toBe('#0a0a0a');
    expect(colors['editor.foreground']).toBe('#ededed');
    expect(colors['editor.background']).toBe('#0f172a');
  });
});
