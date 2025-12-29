# API Keys Roadmap

This covers API Keys that are used to access Objectified external services.

### Rate Limiting 📋 PLANNED
- Per API key rate limits
- Per tenant rate limits
- Per endpoint rate limits
- Configurable limits (requests/minute, requests/hour)
- Rate limit headers in response
- Rate limit dashboard
- Auto-throttling on spike detection
- DDoS protection

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### API Key Scopes & Permissions 📋 PLANNED
- Fine-grained permission scopes (read, write, delete, admin)
- Per-resource access control (projects, classes, properties, etc.)
- Scope templates for common use cases (read-only, full-access, etc.)
- Scope validation on every API request
- UI for managing key scopes with checkboxes
- Scope inheritance from tenant-level defaults

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### API Key Security Enhancements 📋 PLANNED
- IP address whitelisting per API key
- Allowed origins/domains restriction (CORS-like)
- Key rotation with grace period (old key valid for N hours)
- Automatic key rotation reminders/notifications
- Maximum key age policies (force rotation after X days)
- Detect and alert on key exposure (GitHub secret scanning integration)
- Key usage anomaly detection (unusual patterns, geolocations)
- Emergency key revocation (revoke all keys for tenant)

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### API Key Lifecycle Management 📋 PLANNED
- Key versioning (v1, v2, etc.)
- Deprecation workflow with sunset dates
- Scheduled key activation (future start date)
- Key cloning (duplicate with new secret)
- Bulk key management (enable/disable/delete multiple)
- Key templates for quick creation
- Key ownership transfer between users

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Developer Experience 📋 PLANNED
- API key quick-copy button with confirmation
- Show key only once on creation (security)
- Key description/notes field for documentation
- Environment labels (production, staging, development)
- Test mode keys with limited functionality
- SDK generation with embedded key configuration
- API key usage examples in multiple languages
- Webhook notifications for key events (created, used, expired, revoked)

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Multi-Factor Authentication for Keys 📋 PLANNED
- Optional MFA requirement for key creation
- Signed requests with additional secret (HMAC)
- Short-lived tokens generated from long-lived keys (JWT exchange)
- OAuth 2.0 client credentials flow support

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

# Implemented features summary

### API Key Management ✅ IMPLEMENTED
- ✅ Create and manage API keys per tenant
- ✅ API key hashing with bcrypt
- ✅ Optional expiration dates
- ✅ Enable/disable functionality
- ✅ Track last usage timestamp
- ✅ Soft delete capability
- ✅ Full UI for key management

---

# Completed
