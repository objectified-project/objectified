/**
 * CatalogParsedModel (MFI-25.3, #4088).
 *
 * Presentational rendering of the catalog detail's normalized `parsed` model (MFI-25.2, #4087) — a
 * paradigm-tagged entity list projected from the item's canonical model. The Overview pane renders
 * these blocks under the aggregate count boxes so a catalog item shows its *actual* parsed entities
 * (operations / types / services / messages / channels with their fields), not just the counts.
 *
 * The `parsed` shape is intentionally presentation-agnostic (no colors, ordering hints, or markup);
 * all styling lives here: `parsedTagToneClass` maps each entity tag to a Tailwind tone, and
 * `deriveParsedSummaryNote` folds the groups into the mockup's `summaryNote` sub-line
 * (e.g. "8 queries · 4 mutations · 2 subscriptions"). Source: mockup `entHTML`/`openDetail`
 * (`docs/planning/mockups/multi-format-import/index.html:1415-1453`).
 */

import { Box } from 'lucide-react';
import { cn } from '@lib/utils';
import { dashboardPanelClass } from '@/app/components/ade/dashboard/dashboardScreenClasses';
import { catalogEntityAnchorId } from '@/app/utils/catalog-lint-panel';

/** One field row on a parsed entity (mockup `.frow`): name / rendered type / description. */
export interface CatalogParsedField {
  name: string;
  /** Compact, presentation-agnostic `TypeRef` rendering (nullability lives on `required`). */
  type: string;
  description?: string | null;
  /** Outer non-nullability — the renderer decides how to mark it (here: a rose `*`). */
  required?: boolean | null;
}

/** A parsed entity (operation / type / service / message / channel …) with a paradigm tag. */
export interface CatalogParsedEntity {
  name: string;
  /** Paradigm-specific kind used for the colored tag (e.g. QUERY, OBJECT, SERVICE, CHANNEL). */
  tag: string;
  /** Short human hint shown after the name (e.g. `→ [Order]`, `6 fields`). */
  meta?: string | null;
  fields: CatalogParsedField[];
}

/** A group of parsed entities (mockup `entHTML` card): a titled, optionally-subtitled block. */
export interface CatalogParsedGroup {
  title: string;
  subtitle?: string | null;
  entities: CatalogParsedEntity[];
}

/**
 * Tailwind tone classes per entity tag, mirroring the mockup's `tone-*` palette. Every string is a
 * full literal (never concatenated) so Tailwind keeps them; unknown tags fall back to slate.
 */
const PARSED_TAG_TONE: Record<string, string> = {
  // GraphQL operations / gRPC + AsyncAPI verbs
  QUERY: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  MUTATION: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  SUBSCRIPTION: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  SEND: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  RECEIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  // HTTP verbs (REST / data-schema fallback)
  GET: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  POST: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  PUT: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  PATCH: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  DELETE: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  OPERATION: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  // GraphQL / gRPC / generic type kinds
  OBJECT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  INPUT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  INTERFACE: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  UNION: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  ENUM: 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300',
  SCALAR: 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300',
  ALIAS: 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300',
  MAP: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  // gRPC / AsyncAPI structural kinds
  SERVICE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  MESSAGE: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  CHANNEL: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
};

const PARSED_TAG_TONE_FALLBACK = 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300';

/** Tailwind tone classes for an entity tag (case-insensitive; slate for anything unmapped). */
export function parsedTagToneClass(tag: string | null | undefined): string {
  if (!tag) return PARSED_TAG_TONE_FALLBACK;
  return PARSED_TAG_TONE[tag.trim().toUpperCase()] ?? PARSED_TAG_TONE_FALLBACK;
}

/** Lowercase + naive English pluralization of a tag for the summary note (n===1 stays singular). */
function pluralizeTag(tag: string, n: number): string {
  const lower = tag.toLowerCase();
  if (n === 1) return lower;
  if (/[^aeiou]y$/.test(lower)) return `${lower.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(lower)) return `${lower}es`;
  return `${lower}s`;
}

/**
 * Fold the parsed groups into the mockup's `summaryNote` sub-line by tallying entities per tag in
 * first-seen order (e.g. "8 queries · 4 mutations · 2 subscriptions"). Returns `null` when there is
 * no parsed model, so the caller renders nothing rather than an empty line.
 */
export function deriveParsedSummaryNote(
  parsed: CatalogParsedGroup[] | null | undefined,
): string | null {
  if (!parsed || parsed.length === 0) return null;
  const segments: string[] = [];
  for (const group of parsed) {
    const order: string[] = [];
    const counts = new Map<string, number>();
    for (const entity of group.entities) {
      const tag = (entity.tag ?? '').trim();
      if (!tag) continue;
      if (!counts.has(tag)) order.push(tag);
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    for (const tag of order) {
      const n = counts.get(tag) ?? 0;
      segments.push(`${n} ${pluralizeTag(tag, n)}`);
    }
  }
  return segments.length > 0 ? segments.join(' · ') : null;
}

/** A single field row (mockup `.frow`): name / type (+ required marker) / description. */
function ParsedFieldRow({ field }: { field: CatalogParsedField }) {
  return (
    <div
      data-testid="catalog-detail-parsed-field"
      className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs sm:flex-nowrap"
    >
      <span className="truncate font-mono text-gray-700 dark:text-gray-300 sm:w-40 sm:shrink-0" title={field.name}>
        {field.name}
      </span>
      <span
        className="truncate font-mono text-indigo-600 dark:text-indigo-400 sm:w-48 sm:shrink-0"
        title={field.type}
      >
        {field.type}
        {field.required ? (
          <span className="text-rose-500" title="required">
            {' *'}
          </span>
        ) : null}
      </span>
      <span
        className="min-w-0 flex-1 truncate text-gray-500 dark:text-gray-400"
        title={field.description ?? undefined}
      >
        {field.description ?? ''}
      </span>
    </div>
  );
}

/** A single parsed entity: a colored tag + name + meta header, then its field rows. */
function ParsedEntityBlock({
  entity,
  anchorId,
  highlighted,
}: {
  entity: CatalogParsedEntity;
  /** Stable DOM id so a lint finding can deep-link to this entity (MFI-28.2). */
  anchorId: string;
  /** True while this entity is the target of a just-followed lint deep-link (transient ring). */
  highlighted: boolean;
}) {
  return (
    <div
      id={anchorId}
      data-testid="catalog-detail-parsed-entity"
      className={cn(
        // `scroll-mt-24` keeps the entity clear of the sticky header when scrolled into view.
        'scroll-mt-24 rounded-lg border p-3 transition-colors',
        highlighted
          ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-400 dark:border-indigo-500 dark:bg-indigo-900/20 dark:ring-indigo-500'
          : 'border-gray-200 bg-white hover:border-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-800',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          data-testid="catalog-detail-parsed-tag"
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
            parsedTagToneClass(entity.tag),
          )}
        >
          {entity.tag}
        </span>
        <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">{entity.name}</span>
        {entity.meta ? (
          <span className="text-xs text-gray-400 dark:text-gray-500">{entity.meta}</span>
        ) : null}
      </div>
      {entity.fields.length > 0 ? (
        <div className="mt-2 space-y-1">
          {entity.fields.map((field, i) => (
            <ParsedFieldRow key={`${field.name}-${i}`} field={field} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Render the parsed entity groups as a stack of cards (one per group). When there is no parsed model
 * (URL-only source, unknown format, or nothing captured) a graceful "no parsed model" note stands in
 * — a read never errors on a missing model (MFI-25.2), so the Overview degrades rather than breaking.
 */
export function CatalogParsedGroups({
  parsed,
  highlightedAnchor = null,
}: {
  parsed: CatalogParsedGroup[] | null | undefined;
  /** Anchor id of the entity a just-followed lint deep-link is highlighting, if any (MFI-28.2). */
  highlightedAnchor?: string | null;
}) {
  if (!parsed || parsed.length === 0) {
    return (
      <section
        data-testid="catalog-detail-parsed-empty"
        className={`${dashboardPanelClass} p-6`}
      >
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No parsed model is available for this item — the normalized entities could not be
          reconstructed from the captured source.
        </p>
      </section>
    );
  }

  return (
    <>
      {parsed.map((group, gi) => (
        <section
          key={`${group.title}-${gi}`}
          data-testid="catalog-detail-parsed-group"
          className={`${dashboardPanelClass} p-6`}
        >
          <div className="flex items-center gap-2">
            <Box className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {group.title}
            </h2>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-gray-500 dark:bg-gray-700/60 dark:text-gray-300">
              {group.entities.length}
            </span>
            {group.subtitle ? (
              <span className="ml-auto min-w-0 truncate text-xs text-gray-400 dark:text-gray-500">
                {group.subtitle}
              </span>
            ) : null}
          </div>
          <div className="mt-3 space-y-3">
            {group.entities.map((entity, ei) => {
              const anchorId = catalogEntityAnchorId(entity.name);
              return (
                <ParsedEntityBlock
                  key={`${entity.name}-${ei}`}
                  entity={entity}
                  anchorId={anchorId}
                  highlighted={highlightedAnchor === anchorId}
                />
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
