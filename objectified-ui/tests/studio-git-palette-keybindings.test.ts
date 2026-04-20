import {
  matchesStudioGitPaletteShortcut,
  STUDIO_GIT_PALETTE_KEY,
} from '../src/app/utils/studio-keybindings';

function makeKey(init: Partial<KeyboardEvent> & Pick<KeyboardEvent, 'key'>): KeyboardEvent {
  return init as KeyboardEvent;
}

describe('studio-keybindings (git palette)', () => {
  it('matches ⌘/Ctrl+G without shift/alt', () => {
    expect(
      matchesStudioGitPaletteShortcut(
        makeKey({ key: STUDIO_GIT_PALETTE_KEY, metaKey: true, ctrlKey: false, altKey: false, shiftKey: false })
      )
    ).toBe(true);
    expect(
      matchesStudioGitPaletteShortcut(
        makeKey({ key: STUDIO_GIT_PALETTE_KEY, metaKey: false, ctrlKey: true, altKey: false, shiftKey: false })
      )
    ).toBe(true);
  });

  it('is case-insensitive on key', () => {
    expect(
      matchesStudioGitPaletteShortcut(
        makeKey({ key: 'G', metaKey: true, ctrlKey: false, altKey: false, shiftKey: false })
      )
    ).toBe(true);
  });

  it('does not match plain G or shift+G', () => {
    expect(matchesStudioGitPaletteShortcut(makeKey({ key: 'g', metaKey: false, ctrlKey: false }))).toBe(false);
    expect(
      matchesStudioGitPaletteShortcut(
        makeKey({ key: 'g', metaKey: true, ctrlKey: false, altKey: false, shiftKey: true })
      )
    ).toBe(false);
  });

  it('respects defaultPrevented', () => {
    const ev = makeKey({
      key: 'g',
      metaKey: true,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      defaultPrevented: true,
    });
    expect(matchesStudioGitPaletteShortcut(ev)).toBe(false);
  });
});
