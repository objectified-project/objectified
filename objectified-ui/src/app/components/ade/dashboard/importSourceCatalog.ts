/**
 * Import-source card catalog (MFI-1.3, #3735).
 *
 * The ImportDialog source grid is data-driven: a fixed set of built-in cards (the existing
 * intake methods — file/url/clipboard/git/swaggerhub/postman/mcp) merged with whatever the
 * server-side registry (`GET /api/import/sources`) reports. A newly registered adapter therefore
 * appears as a new card with no UI code change, while the built-in cards stay exactly as they were.
 *
 * The merge is pure (no React, no fetch) so it can be unit-tested directly.
 */

import {
  Upload,
  Link2,
  FileText,
  Github,
  Cloud,
  FileJson,
  Network,
  FileCode,
  type LucideIcon,
} from 'lucide-react';
// Namespace import is intentional: registry adapters name their icon (e.g. "file-json") and we
// resolve it dynamically, so any Lucide icon works without a UI change. Next.js optimizes
// `lucide-react` imports, and the built-in cards above still use tree-shaken named imports.
import * as LucideIcons from 'lucide-react';

/** Generic intake panels the dialog already renders; a card routes to one of these on click. */
export type ImportPanelId =
  | 'file'
  | 'url'
  | 'clipboard'
  | 'git'
  | 'swaggerhub'
  | 'postman'
  | 'mcp';

/** The descriptor shape returned by `GET /api/import/sources` (REST `ImportSourceDescriptor`). */
export interface ImportSourceDescriptor {
  key: string;
  label: string;
  description: string;
  /** Lucide icon name in kebab-case, e.g. `"file-json"`. */
  icon: string;
  paradigm: string;
  /** Subset of `"file" | "url" | "paste" | "discovery"`. */
  input_kinds: string[];
  supports_live_discovery: boolean;
  formats: string[];
}

/** A renderable source card. */
export interface ImportSourceCard {
  /** Stable key; for built-ins this is also the `selectedSource` id the dialog branches on. */
  key: string;
  label: string;
  description: string;
  /** Resolved Lucide icon component. */
  icon: LucideIcon;
  /** Generic intake panel this card opens, or `null` when none is available yet (disabled card). */
  panel: ImportPanelId | null;
  /** `true` for the built-in cards; `false` for cards contributed by the registry. */
  builtin: boolean;
}

/**
 * The built-in source cards — the grid exactly as it shipped before MFI-1.3. Order is preserved so
 * the existing layout is unchanged. Each built-in's `key` doubles as the `selectedSource` id the
 * dialog already branches on, so wiring is unchanged.
 */
const BASE_CARDS: ReadonlyArray<ImportSourceCard> = [
  { key: 'file', label: 'File Upload', description: 'Drop files or click to browse', icon: Upload, panel: 'file', builtin: true },
  { key: 'url', label: 'URL Import', description: 'Fetch from URL or repository', icon: Link2, panel: 'url', builtin: true },
  { key: 'clipboard', label: 'Clipboard Paste', description: 'Paste JSON or YAML content', icon: FileText, panel: 'clipboard', builtin: true },
  { key: 'git', label: 'Git Repository', description: 'Import from GitHub/GitLab', icon: Github, panel: 'git', builtin: true },
  { key: 'swaggerhub', label: 'SwaggerHub', description: 'Import from SwaggerHub', icon: Cloud, panel: 'swaggerhub', builtin: true },
  { key: 'postman', label: 'Postman Collection', description: 'Import from Postman v2.1', icon: FileJson, panel: 'postman', builtin: true },
  { key: 'mcp', label: 'MCP Server', description: 'Discover an MCP endpoint', icon: Network, panel: 'mcp', builtin: true },
];

/**
 * Registry keys whose import is already handled by a built-in card, so they must NOT produce a
 * second (duplicate) card:
 *  - `openapi` is consumed through the generic File / URL / Clipboard intake (auto-detected).
 *  - `sample` is the internal no-op acceptance adapter, never a user-facing source.
 */
export const REGISTRY_KEYS_COVERED_BY_BUILTINS: ReadonlySet<string> = new Set(['openapi', 'sample']);

/**
 * Resolve a Lucide icon name (kebab-case, e.g. `"file-json"`) to its component, falling back to a
 * neutral file icon when the name is unknown — so an unrecognized icon never breaks a card.
 */
export function resolveLucideIcon(name: string | undefined | null): LucideIcon {
  if (!name) return FileCode;
  const pascal = String(name)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  const candidate = (LucideIcons as unknown as Record<string, unknown>)[pascal];
  if (typeof candidate === 'function' || (typeof candidate === 'object' && candidate !== null)) {
    return candidate as LucideIcon;
  }
  return FileCode;
}

/**
 * Pick the generic intake panel for an adapter from its declared `input_kinds`, preferring a
 * file upload, then a URL, then a paste box. A discovery-only adapter has no generic panel yet
 * (MCP's discovery flow is bespoke), so it returns `null` and the card renders disabled.
 */
export function panelForInputKinds(kinds: ReadonlyArray<string> | undefined | null): ImportPanelId | null {
  const set = new Set(kinds ?? []);
  if (set.has('file')) return 'file';
  if (set.has('url')) return 'url';
  if (set.has('paste')) return 'clipboard';
  return null;
}

/**
 * Merge the built-in cards with the registry descriptors.
 *
 * Built-ins always come first and unchanged. A descriptor becomes an appended card unless its key
 * is already a built-in or is covered by a built-in ({@link REGISTRY_KEYS_COVERED_BY_BUILTINS}).
 * Appended cards are de-duplicated and sorted by key for a stable layout.
 *
 * @param descriptors The registry list from `GET /api/import/sources` (may be empty/undefined).
 * @returns The cards to render, built-ins followed by registry-contributed cards.
 */
export function mergeImportSourceCards(
  descriptors: ReadonlyArray<ImportSourceDescriptor> | undefined | null,
): ImportSourceCard[] {
  const baseKeys = new Set(BASE_CARDS.map((card) => card.key));
  const appended: ImportSourceCard[] = [];
  const seen = new Set<string>();

  for (const descriptor of descriptors ?? []) {
    if (!descriptor || typeof descriptor.key !== 'string' || descriptor.key.length === 0) continue;
    if (baseKeys.has(descriptor.key)) continue;
    if (REGISTRY_KEYS_COVERED_BY_BUILTINS.has(descriptor.key)) continue;
    if (seen.has(descriptor.key)) continue;
    seen.add(descriptor.key);
    appended.push({
      key: descriptor.key,
      label: descriptor.label,
      description: descriptor.description,
      icon: resolveLucideIcon(descriptor.icon),
      panel: panelForInputKinds(descriptor.input_kinds),
      builtin: false,
    });
  }

  appended.sort((a, b) => a.key.localeCompare(b.key));
  return [...BASE_CARDS, ...appended];
}

/** The built-in cards on their own — the fallback rendered before/without the registry list. */
export function baseImportSourceCards(): ImportSourceCard[] {
  return BASE_CARDS.map((card) => ({ ...card }));
}
