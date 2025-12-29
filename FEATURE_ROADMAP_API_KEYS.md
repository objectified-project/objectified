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

### Audit Logging
- Comprehensive audit trail:
    - User login/logout
    - Schema changes
    - Permission changes
    - API key usage
    - Export/download events
    - Settings changes
- Audit log viewer with filters
- Audit log search
- Audit log export (for compliance)
- Immutable audit logs
- Audit log retention policies
- Real-time audit alerts

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
