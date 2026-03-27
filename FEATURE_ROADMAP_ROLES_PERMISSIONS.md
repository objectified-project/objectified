# Objectified-Commercial Roles & Permissions Ticket Pack

## Source issue set from `NobuData/objectified`

The following issues were used as source material for roles and permissions work. This set includes items that are open and items that are closed with completed work.

### Open issues (roles/permissions related)

- `#177` Add push conflict policy, permissions, and optional branch protection
- `#260` Add settings persistence, sync to account, and settings search/categories (includes tenant-level admin defaults)
- `#311` Add session management and token refresh with configurable timeout and revoke
- `#312` Add optional MFA/2FA for login or sensitive actions with TOTP and recovery codes
- `#313` Add optional IP allowlist or network restrictions for admin and API access
- `#314` Add auth and access audit log for compliance

### Closed issues (roles/permissions related, completed)

- `#3` Create tenant to account relationship
- `#18` Create REST services for tenant administrators
- `#19` Create authentication REST service
- `#53` Create Tenant Administrators page in Dashboard
- `#54` Handle Permissions to show/hide sections by role
- `#128` Implement RBAC with configurable roles and permissions
- `#129` Add API key scopes
- `#185` Add role-based nav visibility and tenant switcher in header with persisted selection
- `#194` Add tenant-admin audit and optional transfer-of-ownership flow
- `#195` Add permission-denied messaging, tenant/role in shell, and optional session timeout warning
- `#211` Add toolbar keyboard shortcuts, disabled states by permission, and progress indicators
- `#228` Add read-only banner, request edit/branch CTA, and locked/permission-aware mode

## Design alignment for objectified-commercial

These ticket drafts are structured for the current `objectified-commercial` architecture and standards:

- UI implementation uses `Next.js + TypeScript + Tailwind + Radix UI`.
- Backend services and authorization checks are implemented in `objectified-rest` and documented in OpenAPI.
- Data persistence and permission models are implemented in PostgreSQL tables and migration scripts in `objectified-db`.
- Feature rollout is multi-tenant first, with clear RBAC enforcement and auditable state changes.
- Tickets are intentionally small subsets of a larger RBAC capability so work can be delivered in strict dependency order.

## Ordered ticket sequence for implementation

Each ticket below is intentionally written with only a title and a thorough description. The list is ordered by logical creation and implementation dependency.

---

## RP-01: Establish Core Tenant Membership Role Model

### Description
Create the baseline tenant membership model that all permission decisions depend on. Add or validate PostgreSQL tables for tenant membership links between account and tenant, role assignment at membership level, and audit timestamps for creation and updates. Ensure role values are constrained through enums or controlled lookup tables so role names remain consistent across UI and API. Add indexes for high-frequency lookups by tenant, account, and role. This ticket provides the foundation used by all following role and permission checks in REST and UI.

---

## RP-02: Add Auth Context Hydration for Tenant and Role

### Description
Extend authentication middleware so each authenticated request carries trusted context for `account_id`, `tenant_id`, and effective role(s). Support JWT and API key authentication flows so authorization checks can be evaluated consistently regardless of client type. Add clear error responses for missing tenant context, invalid tenant membership, or disabled memberships. This ticket establishes the shared request context required by endpoint-level permission enforcement and role-aware UI rendering.

---

## RP-03: Build Tenant Administrator Management APIs

### Description
Implement role management APIs for tenant administrators, including list, add, and remove actions, with explicit authorization boundaries so only users with required admin privilege can mutate role assignments. Enforce prevention rules to avoid orphaning a tenant without administrative coverage. Return normalized response payloads for use by dashboard tables and dialogs. Add OpenAPI documentation and API tests covering happy paths, forbidden access, and invalid role mutation attempts. This ticket enables controlled role assignment through backend services.

---

## RP-04: Add RBAC Policy Matrix and Permission Resolver

### Description
Implement a centralized RBAC policy matrix that maps roles to permissions and, where applicable, resource scope (tenant, project, version). Include initial roles aligned to source issue intent, such as administrator, tenant-admin, member, schema-editor, viewer, publisher, and auditor. Add a reusable permission resolver used by REST handlers and other services so permission logic does not fragment across files. Include unit tests for policy evaluation, deny-by-default behavior, and scoped permission edge cases. This ticket creates the core authorization engine for the commercial product.

---

## RP-05: Enforce RBAC on Protected REST Endpoints

### Description
Apply the RBAC resolver to all protected tenant, user, project, version, and workflow endpoints. Add explicit checks per action (`read`, `create`, `update`, `delete`, `publish`, `push`, `merge`, `admin`) and return consistent `403` responses with machine-readable error codes. Ensure endpoints that were previously role-implicit become role-explicit with deterministic enforcement. Update OpenAPI security and authorization notes for each protected route. This ticket operationalizes permission enforcement at the API boundary.

---

## RP-06: Implement Role-Aware Navigation and Page Gating

### Description
Update dashboard navigation and route guards so users only see and access sections permitted by their effective role. Use Radix UI primitives for menus, dropdowns, and role-display controls while maintaining the existing product design language and dark/light theme behavior. Add tenant switcher support for multi-tenant users and persist selected tenant safely in client state. Handle unauthorized deep links gracefully by routing to a permission-denied screen instead of failing silently. This ticket aligns UX visibility with backend authorization.

---

## RP-07: Create Tenant Administrators UI with Radix Table/Dialog Workflows

### Description
Implement the tenant administrator management page using application-standard table, dialog, and confirmation interactions built with Radix UI components. Support list, add, and remove operations through the APIs introduced earlier, with form validation and optimistic UI feedback patterns that match existing dashboard behavior. Ensure role mutations are reflected immediately in page state and protected with confirmation prompts for destructive actions. This ticket provides the first end-to-end role management interface for administrators.

---

## RP-08: Add Permission-Conditioned Component States Across Studio

### Description
Introduce permission-aware rendering for action controls in editor and dashboard surfaces, including hidden, disabled, and read-only states based on resolved permissions. Include explicit support for locked/published read-only behavior with clear visual affordances and context messaging. Disable mutation actions when a user lacks permission while preserving allowed read/search/export functionality. Add shared UI permission utilities so behavior remains consistent across components. This ticket standardizes permission-aware interaction patterns in the product experience.

---

## RP-09: Add Permission-Denied UX and Role Context Indicators

### Description
Add a consistent permission-denied experience that explains why access is blocked and what next action is available (for example, contact tenant admin). Surface current tenant and effective role in shell/header context so users understand active authorization scope. Ensure API `403` and `401` states map to predictable UI messaging and recovery behavior. Add copy and visual treatment that follows current design standards, avoiding browser-native alerts and using product-standard feedback components. This ticket improves clarity and reduces confusion around access restrictions.

---

## RP-10: Add API Key Scopes Aligned to RBAC

### Description
Implement scoped API keys that bind capability to tenant, optional project, and allowed permission set (for example read-only versus full automation scope). Add create, rotate, revoke, and list support with secure storage and masked display behavior. Enforce scoped permissions in middleware so API keys cannot exceed granted role capabilities. Document scope behavior in OpenAPI with examples for CI/CD integrations. This ticket extends RBAC to machine-to-machine access.

---

## RP-11: Add Session Governance, Timeout Policy, and Re-Auth UX

### Description
Implement configurable session timeout policy with refresh token support and per-tenant revocation controls. Add optional session warning UI before expiry and re-auth flows for sensitive operations. Ensure session invalidation reacts correctly to role changes and membership removal so stale privileges are not retained. Include tests for timeout boundaries, revocation behavior, and multi-tab/session consistency. This ticket hardens role and permission lifecycle correctness over time.

---

## RP-12: Add Optional MFA Policy by Role and Action

### Description
Implement optional MFA policy controls where enforcement can be configured by tenant, role, or sensitive action type (such as publish, delete, admin mutation). Support TOTP setup and recovery codes, including enrollment and recovery UX using Radix dialog/form patterns consistent with the application. Enforce MFA requirements in backend authorization checks, not only client-side routes, to prevent bypass. This ticket upgrades assurance for high-risk permission paths.

---

## RP-13: Add Optional Admin/API Network Access Restrictions

### Description
Add optional IP/network restriction controls for administrative and API access paths, including CIDR range support and environment or tenant scoping. Integrate restriction checks into request middleware before permission evaluation to reduce attack surface early in request handling. Provide configuration and exception handling suitable for enterprise deployments using fixed egress networks. Add operational logging for denied requests due to network policy mismatch. This ticket introduces network-boundary controls layered with RBAC.

---

## RP-14: Add Role and Access Audit Ledger

### Description
Create a dedicated audit ledger for authentication and authorization events, including login attempts, session revocation, role grants/removals, permission-sensitive action attempts, API key lifecycle events, and admin ownership transfer operations. Persist actor, tenant, target resource, action, outcome, and timestamp with query-friendly indexes. Provide paginated REST endpoints for filtered retrieval and export-ready payloads for compliance reviews. This ticket delivers core auditability and compliance traceability for the full role and permission model.

---

## RP-15: Add Ownership Transfer and Safety Controls for Tenant Admin

### Description
Implement primary-admin or ownership transfer workflows with explicit confirmation and safety checks. Prevent accidental lockout scenarios by requiring valid successor assignment before demoting/removing final administrative authority. Record transfer intent and completion in the audit ledger. Add clear UI prompts and server-side invariants so ownership transitions remain controlled and recoverable. This ticket closes governance gaps around long-term tenant administration.

---

## RP-16: Add Permission-Aware Workflow Controls for Version Operations

### Description
Apply RBAC permission checks and UI states to version workflow operations such as push, merge, branch, and publish-related actions. Enforce role restrictions for protected branches/versions and ensure controls are disabled or hidden based on effective permission context. Add policy-driven behavior where high-risk operations can require elevated role or additional controls introduced in earlier tickets. This ticket unifies role and permission enforcement across advanced editor workflows.

---

## Suggested labels for issue creation

- `authentication`
- `authorization`
- `rbac`
- `ui`
- `rest`
- `database`
- `typescript`
- `python`
- `postgresql`

