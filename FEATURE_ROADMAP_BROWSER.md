# Objectified Browse — Comprehensive Feature Roadmap

This document outlines **additional** features and enhancements for the **Objectified Browse** application (public-facing viewer for published OpenAPI, Arazzo, and JSON Schema specifications). It extends the in-app roadmap at `objectified-browse/FEATURE_ROADMAP.md`.

**Scope:** objectified-browse only (tenant → project → version browsing, spec viewing, comparison, search).  
**Related:** objectified-ui (Canvas), objectified-rest (API), objectified-db (migrations).

---

## Current State & Existing Roadmap

- **Implemented:** Browse hierarchy, search, OpenAPI/Arazzo/JSON Schema viewer, Monaco Editor, version diff (side-by-side + unified), themes, data tables, breadcrumbs, Docker. See `objectified-browse/README.md` and `objectified-browse/docs/FEATURES.md`.
- **Planned (in-app):** API URL config, spec validation, enhanced search, keyboard shortcuts, interactive API docs, schema visualization, improved diff, code folding/minimap, export (YAML/HTML/PDF/MD), favorites, recent history, dashboard, mobile, accessibility, analytics, change history, embed widget, mocking, CI/CD, plugins, auth, multi-tenancy, audit. See `objectified-browse/FEATURE_ROADMAP.md`.

The sections below list **additional** features for a comprehensive browser roadmap.

---

## 1. Discovery & Navigation

### Deep linking & shareability
- [ ] **Fragment deep links** — Support `#/paths/~1users`-style hashes to scroll/jump to a specific path, schema, or operation in the spec viewer.
- [ ] **Stable canonical URLs** — Redirect old or alternate slugs to canonical tenant/project/version URLs for bookmarks and docs.
- [ ] **Open Graph / meta tags** — Rich previews (title, description, image) when sharing version or compare links on social or Slack.
- [ ] **QR code for current spec** — Generate QR code for the current version URL (e.g. in share menu).

### Discovery
- [ ] **Related specs** — Show “Referenced by” or “Depends on” when a spec uses `$ref` to another known (published) spec in the same tenant.
- [ ] **Browse by tag/category** — If projects or versions gain tags/categories, filter or group by them on tenant/project pages.
- [ ] **Sitemap / index** — Machine-readable sitemap or index of all public tenants/projects/versions for SEO and tooling.
- [ ] **RSS/Atom feeds** — Per-tenant or per-project feeds for new published versions (with optional filters).

---

## 2. Specification Viewing & Editor UX

### Structure & navigation
- [ ] **Outline / tree panel** — Collapsible tree of paths, schemas, or top-level keys; click to scroll editor to that section.
- [ ] **Split view** — Outline on the left, raw spec (Monaco) on the right for large specs.
- [ ] **“Go to path/schema”** — Quick jump by path (e.g. `GET /users`) or schema name.
- [ ] **Bookmarks** — Save named bookmarks (e.g. “Auth endpoints”) and jump between them.
- [ ] **Breadcrumb in spec** — Show current location in the JSON (e.g. `paths → /users → get → responses`).

### Read-only playground
- [ ] **Paste-and-view** — Paste raw JSON/YAML in a modal and view it as formatted spec (no save; client-side only).
- [ ] **URL-to-spec** — Load and display a spec from a user-provided URL (with safety checks and CORS handling).

### Spec health & validation
- [ ] **Inline validation** — Show validation errors/warnings in the gutter or under the editor (OpenAPI 3.x + custom rules).
- [ ] **Lint panel** — Dedicated “Lint” tab with list of issues and “Jump to” for each.
- [ ] **Deprecated surface** — Clearly mark deprecated operations/schemas (badge or strikethrough) in viewer and outline.
- [ ] **Required vs optional** — In schema view, visually distinguish required and optional properties.

### Examples & snippets
- [ ] **Examples tab** — List examples from the spec (request/response) with one-click copy.
- [ ] **“Copy as”** — Copy operation as cURL, `fetch`, axios, or other snippet templates.

---

## 3. Version Comparison & Diff

### Compare experience
- [ ] **Compare with previous** — One-click “Compare with previous version” from version details.
- [ ] **Three-way (or N-way) compare** — Compare three (or more) versions in a single view.
- [ ] **Section-scoped diff** — Filter diff to “Paths only”, “Schemas only”, or “Security”.
- [ ] **Semantic diff** — Understand OpenAPI structure (e.g. “path added” vs “line added”) and group changes.
- [ ] **Breaking-change highlight** — Flag and highlight breaking changes (removed path, removed required field, etc.) in diff and summary.
- [ ] **Diff report export** — Export comparison as PDF or Markdown (summary + key changes).
- [ ] **Next/previous change** — Buttons or shortcuts to jump to next/previous change in unified diff.

### Changelog
- [ ] **Changelog view** — Human-readable changelog generated from version diffs (added/removed/changed endpoints and schemas).
- [ ] **Timeline** — Visual timeline of versions with optional “preview diff” on hover.

---

## 4. Export, Share & Embed

### Export (beyond current JSON/YAML)
- [ ] **Single operation/schema export** — Export one path or component as a small JSON/YAML snippet.
- [ ] **HTML doc export** — Download a static HTML doc (e.g. Redoc/Swagger-style) for the current spec.
- [ ] **PDF export** — Generate PDF of the spec or of the diff report.
- [ ] **Markdown export** — Export spec summary or changelog as Markdown.

### Share & embed
- [ ] **Shareable view link** — Optional short-lived or revocable “view only” link (if backend supports tokens).
- [ ] **Embed widget** — Lightweight embed script for external sites; whitelist domains and customizable theme.
- [ ] **“Copy link” with format** — Copy URL that includes format (OpenAPI/Arazzo/JSON Schema) so link opens with correct tab.

### Developer workflow
- [ ] **“Generate client” link** — Link to OpenAPI Generator (or similar) with pre-filled spec URL.
- [ ] **Link to source repo** — If version metadata includes repo URL, show “View source” link.

---

## 5. Search & Filters

### Search enhancements
- [ ] **Search within spec content** — Full-text search inside the current specification (paths, descriptions, schema names).
- [ ] **Search suggestions / autocomplete** — Suggest tenant/project names and recent queries.
- [ ] **Search history** — Recent searches in dropdown or dedicated panel; clear history option.
- [ ] **Highlight in results** — Highlight matched terms in tenant/project/version result cards.
- [ ] **Filters** — Filter by date range (e.g. “Published after”), tenant, or project.

### Performance
- [ ] **Debounced search** — Reduce request volume while typing.
- [ ] **Search result caching** — Cache recent search results (e.g. in memory or sessionStorage) with short TTL.

---

## 6. Performance & Reliability

### Loading & caching
- [ ] **Prefetch on hover** — Preload adjacent version or project on link hover.
- [ ] **Skeleton loaders** — Skeleton UIs for tables and spec viewer while data loads.
- [ ] **Request deduplication** — If same spec is opened in multiple tabs, avoid duplicate fetches (e.g. shared cache or service worker).
- [ ] **Retry with backoff** — Retry failed REST API calls with exponential backoff and user-visible “Retry” button.

### Offline & PWA
- [ ] **Service worker** — Cache tenant/project list and recently viewed specs for offline or flaky network.
- [ ] **Offline indicator** — Show banner when offline and which actions are unavailable.
- [ ] **Virtual scrolling** — For very large spec JSON, virtualize Monaco or list view to keep UI responsive.

### Bundle & runtime
- [ ] **Code splitting** — Lazy-load compare view, embed widget, or heavy viewers to keep initial bundle small.
- [ ] **Monaco lazy load** — Load Monaco only when spec viewer is opened.

---

## 7. Accessibility & Localization

### Accessibility (WCAG 2.1 AA)
- [ ] **Screen reader announcements** — Announce diff changes, table sort, and major view switches.
- [ ] **Keyboard-only navigation** — Full navigation and spec viewer control via keyboard (tab, arrows, shortcuts).
- [ ] **Focus management** — Visible focus indicators; trap focus in modals; return focus on close.
- [ ] **ARIA labels** — Labels for icons, buttons, and dynamic regions (e.g. diff, table).
- [ ] **High contrast mode** — Optional high-contrast theme.
- [ ] **Reduced motion** — Respect `prefers-reduced-motion` for animations and transitions.

### Localization
- [ ] **i18n for UI** — Translate UI strings (not spec content); language selector and persisted preference.
- [ ] **RTL support** — Optional RTL layout for right-to-left languages.

---

## 8. Security & Compliance

### Optional auth (private specs)
- [ ] **Read-only auth** — Optional login (OAuth2/OIDC or API key) to view private specs in browse.
- [ ] **Session timeout** — Configurable session lifetime and “Stay signed in” option.
- [ ] **Secure storage** — No tokens in localStorage if risk is high; consider httpOnly cookies or short-lived tokens.

### Hardening
- [ ] **CSP and security headers** — Content-Security-Policy, X-Frame-Options, etc., for embed and main app.
- [ ] **Rate limiting** — Throttle search and spec fetch per IP or per user to prevent abuse.
- [ ] **Safe error messages** — Avoid leaking stack traces or internal URLs to client; generic messages with optional error IDs for support.

### Compliance
- [ ] **Audit events** — If auth is added, log view/download events for private specs (backend integration).
- [ ] **Data retention** — If storing history or favorites server-side, document retention and purge options.

---

## 9. Analytics & Observability

### Usage (opt-in / privacy-safe)
- [ ] **Anonymous usage metrics** — Page views, format preference, compare usage (no PII); opt-in or tenant-configurable.
- [ ] **Popular specs** — “Most viewed” or “Recently viewed” on tenant or home (from analytics or backend).
- [ ] **Admin/tenant dashboard** — For tenant admins: view counts per project/version, top referrers (if backend supports).

### Operations
- [ ] **Health check page** — `/health` or `/status` for load balancers and monitoring (DB + REST API reachability).
- [ ] **Feature flags** — Toggle new features (e.g. new viewer, embed) per tenant or globally for gradual rollout.
- [ ] **Client error reporting** — Optional integration to report JS errors (e.g. Sentry) with tenant/version context (no PII).

---

## 10. Enterprise & White-Label

### Branding
- [ ] **Custom logo** — Tenant or deployment logo in navbar and footer.
- [ ] **Custom colors / theme** — Tenant-specific accent or full theme (CSS variables or config).
- [ ] **Custom domain** — Support tenant-specific domains (e.g. `api-docs.acme.com`) with same codebase.
- [ ] **Footer/legal links** — Configurable footer links (Terms, Privacy, Support).

### Tenant controls
- [ ] **Feature toggles per tenant** — Enable/disable compare, export, embed, or deep links per tenant.
- [ ] **Usage quotas** — If backend supports, surface “near limit” or “quota exceeded” in UI for heavy tenants.
- [ ] **SLA / status link** — Link to status page or SLA document from footer or help menu.

---

## 11. Keyboard Shortcuts & Power Users

- [ ] **Shortcut help modal** — `?` or `⌘/Ctrl + /` to show all shortcuts.
- [ ] **Global shortcuts** — `⌘/Ctrl + K` quick search; `⌘/Ctrl + F` search in spec; `Esc` close modals.
- [ ] **Navigation** — `←` / `→` previous/next version when on version page; `G` then `L` for “Go to line” in editor.
- [ ] **Copy / download** — `⌘/Ctrl + C` copy spec, `⌘/Ctrl + D` download.
- [ ] **Configurable shortcuts** — Allow power users to remap shortcuts (stored in localStorage or profile).

---

## 12. Testing & Quality

### Automated testing
- [ ] **E2E tests** — Playwright (or Cypress) for critical flows: browse, search, open spec, compare, export.
- [ ] **Visual regression** — Snapshot or Percy-style checks for main pages and themes.
- [ ] **Accessibility tests** — axe-core in CI for key routes.
- [ ] **API contract tests** — Assert expected REST API responses used by browse (e.g. schema shape).

### Developer experience
- [ ] **Storybook** — Component stories for Navbar, SpecViewer, DataTable, CompareViewer, themes.
- [ ] **Contributing guide** — How to run, test, and submit PRs for objectified-browse.
- [ ] **API docs** — Document internal helpers and data shapes (e.g. TypeDoc or inline docs).

---

## 13. Infrastructure & Deployment

- [ ] **Kubernetes manifests** — Sample Deployment, Service, Ingress for objectified-browse.
- [ ] **Helm chart** — Parameterized chart for DB URL, REST API URL, base path, replicas.
- [ ] **Health endpoints** — `/api/health` returning DB and REST API status.
- [ ] **Metrics** — Optional Prometheus metrics (request duration, error rate, cache hits).
- [ ] **Structured logging** — JSON logs with request ID, tenant/project/version when applicable (no PII).
- [ ] **Docker multi-stage** — Optimized production image (already present; keep aligned with other Objectified apps).

---

## Priority & Timeline (Suggested)

| Area                         | Priority   | Suggested horizon |
|------------------------------|------------|-------------------|
| Deep links, OG meta, share   | High       | Phase 1–2         |
| Spec validation, lint panel  | High       | Phase 1           |
| Outline, go-to, bookmarks    | High       | Phase 2           |
| Breaking-change diff         | High       | Phase 2           |
| Keyboard shortcuts + help    | High       | Phase 1           |
| Search within spec, filters  | Medium     | Phase 2           |
| Changelog, timeline          | Medium     | Phase 2–3         |
| Export (HTML/PDF/MD)         | Medium     | Phase 2           |
| Embed widget                 | Medium     | Phase 3           |
| Offline / PWA                | Medium     | Phase 3           |
| i18n, a11y hardening         | Medium     | Phase 2–3         |
| Optional auth (private)      | Lower      | Phase 4+          |
| White-label, tenant toggles  | Lower      | Phase 4+          |
| Analytics, health, K8s       | Ongoing    | As needed         |

---

## Reference

- **In-app roadmap:** `objectified-browse/FEATURE_ROADMAP.md`
- **Feature docs:** `objectified-browse/docs/FEATURES.md`
- **Getting started:** `objectified-browse/docs/GETTING_STARTED.md`
- **Canvas roadmap (different app):** `PLANNED_FEATURE_ROADMAP_CANVAS.md` (objectified-ui)

---

*Last updated: February 2026*
