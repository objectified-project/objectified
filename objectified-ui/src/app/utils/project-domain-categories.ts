/**
 * Optional domain labels for projects (#243). Stored in project metadata as `domainCategory` (id string).
 */

export const PROJECT_DOMAIN_CATEGORY_NONE = 'none';

export interface ProjectDomainCategory {
  id: string;
  label: string;
  /** Short hint for pickers */
  hint: string;
}

export const PROJECT_DOMAIN_CATEGORIES: readonly ProjectDomainCategory[] = [
  {
    id: 'iot',
    label: 'IoT device schemas',
    hint: 'Sensors, devices, telemetry, and connected hardware models.',
  },
  {
    id: 'social',
    label: 'Social media entities',
    hint: 'Users, posts, feeds, reactions, and social graphs.',
  },
  {
    id: 'gaming',
    label: 'Gaming (Player, Match, Leaderboard)',
    hint: 'Players, sessions, matches, rankings, and live ops data.',
  },
  {
    id: 'travel',
    label: 'Travel & hospitality',
    hint: 'Bookings, guests, itineraries, properties, and reservations.',
  },
  {
    id: 'media',
    label: 'Media & entertainment',
    hint: 'Content catalogs, rights, playback, and editorial metadata.',
  },
];

const byId = new Map(PROJECT_DOMAIN_CATEGORIES.map((c) => [c.id, c]));

export function getProjectDomainCategory(id: string | undefined | null): ProjectDomainCategory | undefined {
  if (!id || id === PROJECT_DOMAIN_CATEGORY_NONE) return undefined;
  return byId.get(id);
}

export function getProjectDomainCategoryLabel(id: string | undefined | null): string | undefined {
  return getProjectDomainCategory(id)?.label;
}
