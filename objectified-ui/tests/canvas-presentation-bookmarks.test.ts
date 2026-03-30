import {
  loadPresentationBookmarks,
  savePresentationBookmarks,
  isPresentationBookmark,
  presentationBookmarksStorageKey,
} from '@/app/ade/studio/editor/lib/canvas-presentation-bookmarks';

describe('canvas-presentation-bookmarks', () => {
  const versionId = 'version-test-517';

  beforeEach(() => {
    localStorage.clear();
  });

  it('uses a stable storage key per version', () => {
    expect(presentationBookmarksStorageKey(versionId)).toContain(versionId);
  });

  it('round-trips bookmarks through localStorage', () => {
    const slides = [
      {
        id: 'a',
        title: 'One',
        viewport: { x: 0, y: 1, zoom: 0.5 },
        speakerNote: 'hello',
      },
    ];
    savePresentationBookmarks(versionId, slides);
    expect(loadPresentationBookmarks(versionId)).toEqual(slides);
  });

  it('rejects invalid stored JSON', () => {
    localStorage.setItem(presentationBookmarksStorageKey(versionId), 'not-json');
    expect(loadPresentationBookmarks(versionId)).toEqual([]);
  });

  it('filters out invalid items in array', () => {
    localStorage.setItem(
      presentationBookmarksStorageKey(versionId),
      JSON.stringify([
        { id: 'ok', title: 'x', viewport: { x: 0, y: 0, zoom: 1 }, speakerNote: '' },
        { bad: true },
      ])
    );
    expect(loadPresentationBookmarks(versionId)).toHaveLength(1);
    expect(loadPresentationBookmarks(versionId)[0].id).toBe('ok');
  });

  it('isPresentationBookmark validates shape', () => {
    expect(
      isPresentationBookmark({
        id: '1',
        title: 't',
        speakerNote: '',
        viewport: { x: 0, y: 0, zoom: 1 },
      })
    ).toBe(true);
    expect(isPresentationBookmark({ id: '' })).toBe(false);
    expect(isPresentationBookmark(null)).toBe(false);
  });
});
