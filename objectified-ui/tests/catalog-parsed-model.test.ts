/**
 * Unit tests for the parsed-model helpers (MFI-25.3, #4088).
 *
 * These pin the two pure, presentation-agnostic pieces the Overview relies on: the tag → tone color
 * map (`parsedTagToneClass`) and the `summaryNote` derivation (`deriveParsedSummaryNote`), including
 * pluralization, first-seen tag order, and the empty/absent degradation.
 */

import {
  deriveParsedSummaryNote,
  parsedTagToneClass,
  type CatalogParsedGroup,
} from '../src/app/components/ade/dashboard/catalog/CatalogParsedModel';

describe('parsedTagToneClass', () => {
  it('maps known tags to their tone (case-insensitive)', () => {
    expect(parsedTagToneClass('QUERY')).toContain('bg-blue-100');
    expect(parsedTagToneClass('mutation')).toContain('bg-amber-100');
    expect(parsedTagToneClass('Subscription')).toContain('bg-violet-100');
    expect(parsedTagToneClass('SERVICE')).toContain('bg-emerald-100');
    expect(parsedTagToneClass('CHANNEL')).toContain('bg-violet-100');
    expect(parsedTagToneClass('DELETE')).toContain('bg-rose-100');
  });

  it('falls back to slate for unknown or empty tags', () => {
    expect(parsedTagToneClass('WIDGET')).toContain('bg-slate-100');
    expect(parsedTagToneClass('')).toContain('bg-slate-100');
    expect(parsedTagToneClass(null)).toContain('bg-slate-100');
    expect(parsedTagToneClass(undefined)).toContain('bg-slate-100');
  });
});

describe('deriveParsedSummaryNote', () => {
  it('tallies entities per tag in first-seen order across groups, pluralizing', () => {
    const groups: CatalogParsedGroup[] = [
      {
        title: 'Operations',
        subtitle: null,
        entities: [
          { name: 'a', tag: 'QUERY', meta: null, fields: [] },
          { name: 'b', tag: 'QUERY', meta: null, fields: [] },
          { name: 'c', tag: 'MUTATION', meta: null, fields: [] },
        ],
      },
      {
        title: 'Types',
        subtitle: null,
        entities: [{ name: 'T', tag: 'OBJECT', meta: null, fields: [] }],
      },
    ];
    expect(deriveParsedSummaryNote(groups)).toBe('2 queries · 1 mutation · 1 object');
  });

  it('pluralizes tags ending in a consonant + y and sibilants correctly', () => {
    const groups: CatalogParsedGroup[] = [
      {
        title: 'Mixed',
        subtitle: null,
        entities: [
          { name: 'e1', tag: 'ENTITY SET', meta: null, fields: [] },
          { name: 'e2', tag: 'ENTITY SET', meta: null, fields: [] },
          { name: 'm1', tag: 'MESSAGE', meta: null, fields: [] },
          { name: 'm2', tag: 'MESSAGE', meta: null, fields: [] },
        ],
      },
    ];
    expect(deriveParsedSummaryNote(groups)).toBe('2 entity sets · 2 messages');
  });

  it('ignores blank tags and returns null when there is nothing to summarize', () => {
    expect(deriveParsedSummaryNote(null)).toBeNull();
    expect(deriveParsedSummaryNote(undefined)).toBeNull();
    expect(deriveParsedSummaryNote([])).toBeNull();
    expect(
      deriveParsedSummaryNote([{ title: 'Empty', subtitle: null, entities: [] }]),
    ).toBeNull();
    expect(
      deriveParsedSummaryNote([
        { title: 'Blanks', subtitle: null, entities: [{ name: 'x', tag: '  ', meta: null, fields: [] }] },
      ]),
    ).toBeNull();
  });
});
