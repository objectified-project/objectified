# Profile Features

This outlines the features related to user profiles in the Objectified project.

## Current feature set

Current features for the profile include:

- Full name
- Email Address
- User ID
- Tenant ID
- Session Expiration

---

### Profile Information 📋 PLANNED
- Profile avatar/photo upload
- ✅ Display name (separate from full name)
- ✅ E-Mail Address
- 📋 Job title / Role description
- 📋 Department / Team
- 📋 Phone number (with country code) for SMS 2FA
- 📋 Timezone preference
- 📋 Language / Locale preference
- 📋 Bio / About me section
- 📋 Social links (LinkedIn, GitHub, etc.)

| Ticket | Feature Description           |
|--------|-------------------------------|
| #533   | Additional fields for profile |

### Account Settings 📋 PLANNED
- ✅ Change password
- Email change with verification
- ✅ Connected accounts (OAuth providers)
- Session management (view/revoke active sessions)
- 📋 Login history (date, IP, device, location)
- 📋 Account deletion request
- 📋 Data export (GDPR compliance)

| Ticket | Feature Description                |
|--------|------------------------------------|
| #534   | Login success/failure history      |
| #535   | Account deletion request           |
| #536   | Data export functionality for GDPR |

### Notification Preferences 📋 PLANNED
- Email notification toggles (per event type)
- In-app notification preferences
- Digest frequency (instant, daily, weekly)
- Quiet hours / Do not disturb schedule
- Mobile push notification settings
- Slack/Teams integration preferences
- Webhook notifications for account events

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Security Settings 📋 PLANNED
- Two-factor authentication (TOTP, SMS, Email)
- Backup/recovery codes
- Security keys (WebAuthn/FIDO2)
- Trusted devices management
- 📋 Password strength indicator
- Password expiration policy display
- 📋 Security activity log
- 📋 Suspicious activity alerts

| Ticket | Feature Description         |
|--------|-----------------------------|
| #537   | Password strength indicator |
| #538   | Security activity log       |
| #539   | Suspicious activity alerts  |

### Personalization 📋 PLANNED
- 📋 Theme preference (light/dark/system)
- 📋 Default landing page after login
- Keyboard shortcuts customization
- Dashboard widget arrangement
- 📋 Favorite projects / Quick access list

| Ticket | Feature Description                      |
|--------|------------------------------------------|
| #540   | Theme preference setting                 |
| #541   | Default landing page configuration       |
| #542   | Add favorite projects/quick access list  |

### API & Developer Settings 📋 PLANNED
- Personal API keys (user-scoped, not tenant)
- ✅ Personal access tokens
- SSH keys for Git operations
- Webhook endpoints (personal)
- CLI/SDK authentication tokens
- API usage statistics (personal)

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

## Enterprise Features 🏢

### Enterprise Identity & Access 📋 PLANNED
- SAML 2.0 SSO integration
- OIDC (OpenID Connect) support
- LDAP/Active Directory sync
- SCIM provisioning (automatic user sync)
- Just-in-time (JIT) user provisioning
- Custom identity provider mapping
- Federated identity across tenants
- Group-based role assignment from IdP

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Enterprise Security 📋 PLANNED
- Mandatory MFA enforcement (tenant-wide policy)
- Hardware security key requirement
- Session timeout policies (configurable per role)
- IP-based access restrictions per user
- Device trust / MDM integration
- Certificate-based authentication
- Conditional access policies (location, device, time)
- Zero-trust network access (ZTNA) integration

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Compliance & Governance 📋 PLANNED
- User access reviews / Recertification workflows
- Segregation of duties (SoD) controls
- Privileged access management (PAM)
- Consent management and tracking
- Data residency preferences
- Privacy dashboard (what data we store)
- Right to be forgotten workflow
- Audit trail for profile changes
- eSignature for policy acceptance

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Enterprise Profile Management 📋 PLANNED
- Centralized profile administration
- Bulk user import/export (CSV, SCIM)
- Profile templates for onboarding
- Mandatory profile fields enforcement
- Profile completeness scoring
- Custom profile fields (admin-defined)
- Profile field visibility controls (public/private/team)
- Organizational hierarchy / Reporting structure

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Delegation & Proxy Access 📋 PLANNED
- Delegate access to another user (vacation mode)
- Impersonation for support (with audit trail)
- Shared mailbox / Team account support
- Role switching (for users with multiple roles)
- Acting on behalf of (with approval workflow)
- Time-limited elevated privileges

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Enterprise Directory 📋 PLANNED
- Organization-wide people directory
- Search users by name, role, department, skills
- Org chart visualization
- Team/group membership display
- Contact card with quick actions (email, chat)
- Skills and expertise tagging
- User availability / Status indicators
- Manager/direct reports relationships

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

# Completed
