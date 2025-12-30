# Security Roadmap

This covers security features such as login/SSO access security, along with user-level and group-level
permissions.

## 🔒 Security & Authentication

> **Section Status**: ✅ Mostly Implemented (API keys, SSO, audit logging complete)

### Advanced Security ✅ PARTIALLY IMPLEMENTED
- Two-Factor Authentication (2FA)
  - Security via Authy
  - Google Authenticator
  - SMS-based 2FA
- Single Sign-On (SSO) ✅ IMPLEMENTED:
  - ✅ GitHub OAuth
  - ✅ GitLab OAuth
  - 📋 Okta
  - Auth0
  - 📋 Amazon AWS
  - 📋 Azure AD
  - LDAP
  - SAML 2.0
- ✅ Account Linking (link multiple SSO providers to one account)
- ✅ External Authentication Providers management
- API key rotation policies
- IP whitelisting per tenant
- ✅ JWT token expiration and refresh
- Security headers (CSP, HSTS, etc.)
- Secrets management (Vault integration)
- ✅ Encryption at rest and in transit
- SOC 2 compliance
- GDPR compliance tools
- Penetration testing reports

| Ticket | Feature Description |
|--------|---------------------|
| #68    | SSO with AWS        |
| #69    | SSO with Azure AD   |
| #241   | SSO with Okta       |

### User Permissions & Access Control 📋 PLANNED

**Role-Based Access Control (RBAC)** 📋 PLANNED
- **Built-in Roles**:
  - **Super Admin**: Full system access, manage all tenants
  - **Tenant Owner**: Full tenant access, billing, delete tenant
  - **Tenant Admin**: Manage tenant users, projects, settings (no billing/delete)
  - **Project Admin**: Full project access, manage project members
  - **Editor**: Create/edit schemas, paths, versions (no project settings)
  - **Reviewer**: Comment, approve/reject, read-only schema access
  - **Viewer**: Read-only access to schemas and documentation
  - **API Consumer**: API key access only, no UI access
- **Role Hierarchy**:
  - Higher roles inherit permissions from lower roles
  - Clear role comparison matrix
  - Role descriptions in UI

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Custom Roles** 📋 PLANNED
- Create custom roles with granular permissions
- Clone existing role as starting point
- Name, description, and icon for custom roles
- Enable/disable custom roles
- Audit trail for role changes
- Role templates for common use cases

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Permission Categories** 📋 PLANNED
- **Tenant Permissions**:
    - `tenant:read` - View tenant details
    - `tenant:update` - Edit tenant settings
    - `tenant:delete` - Delete tenant
    - `tenant:billing` - Access billing and subscription
    - `tenant:users:read` - View tenant users
    - `tenant:users:manage` - Invite/remove users, assign roles
    - `tenant:api-keys:read` - View API keys
    - `tenant:api-keys:manage` - Create/revoke API keys
- **Project Permissions**:
    - `project:create` - Create new projects
    - `project:read` - View project details
    - `project:update` - Edit project settings
    - `project:delete` - Delete project
    - `project:members:read` - View project members
    - `project:members:manage` - Add/remove project members
- **Version Permissions**:
    - `version:create` - Create new versions
    - `version:read` - View versions
    - `version:update` - Edit version settings
    - `version:delete` - Delete versions
    - `version:publish` - Publish versions
    - `version:copy` - Copy versions
- **Schema Permissions**:
    - `class:create` - Create classes
    - `class:read` - View classes
    - `class:update` - Edit classes
    - `class:delete` - Delete classes
    - `property:create` - Create properties
    - `property:update` - Edit properties
    - `property:delete` - Delete properties
- **Path Permissions**:
    - `path:create` - Create paths/operations
    - `path:read` - View paths
    - `path:update` - Edit paths/operations
    - `path:delete` - Delete paths
    - `path:publish` - Publish paths to gateway
- **Export Permissions**:
    - `export:openapi` - Export OpenAPI specs
    - `export:code` - Generate code
    - `export:documentation` - Export documentation
    - `export:diagram` - Export diagrams
- **AI Permissions**:
    - `ai:chat` - Use AI chatbot
    - `ai:generate` - Generate schemas via AI
    - `ai:review` - Request AI reviews
    - `ai:configure` - Configure AI settings

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Resource-Level Permissions** 📋 PLANNED
- Permissions at project level (all versions inherit)
- Permissions at version level (override project)
- Permissions at class level (sensitive schemas)
- Permissions at path level (restricted endpoints)
- Permission inheritance with override capability

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**User Management** 📋 PLANNED
- **User Invitation**:
    - Invite by email with role assignment
    - Bulk invite via CSV upload
    - Invitation expiration (configurable)
    - Resend invitation option
    - Invitation link sharing
- **User Profile**:
    - Display name and avatar
    - Email and contact info
    - Linked accounts (SSO providers)
    - Activity history
    - Permission summary
- **User Status**:
    - Active / Inactive / Pending
    - Suspend user (temporary disable)
    - Deactivate user (permanent)
    - Last login timestamp
    - Session management

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Team Management** 📋 PLANNED
- Create teams within tenants
- Assign roles to teams (not just users)
- Add/remove users from teams
- Team leads with elevated permissions
- Team-based project access
- Cross-team collaboration
- Team activity dashboard

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Permission UI** 📋 PLANNED
- **Role Assignment**:
    - User profile → Roles tab
    - Dropdown or multi-select for roles
    - Role effective date (future scheduling)
    - Role expiration date (temporary access)
- **Permission Matrix View**:
    - Grid showing roles vs permissions
    - Visual checkmarks for granted permissions
    - Compare multiple roles side-by-side
    - Export permission matrix as CSV
- **Access Request Workflow**:
    - Users can request access to projects
    - Approval workflow for access requests
    - Notification to approvers
    - Request history and audit trail

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Permission Checks** 📋 PLANNED
- Real-time permission validation
- Graceful degradation (hide unauthorized features)
- Clear error messages for denied actions
- "Request Access" button for denied resources
- Permission caching for performance

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Audit & Compliance** 📋 PLANNED
- Log all permission changes
- Who granted/revoked what permission, when
- Permission change notifications
- Periodic access reviews
- Compliance reports (who has access to what)
- Detect over-privileged users
- Recommend permission cleanup

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

# Completed
