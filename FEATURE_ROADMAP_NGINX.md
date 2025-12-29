# NGINX settings roadmap for Objectified

These are the tasks remaining for Nginx to button down the support and security.

## Security harden NGINX

- Implement https://github.com/mitchellkrogza/nginx-ultimate-bad-bot-blocker

## AI Suggested fixes

- Look into rate limiting
- Block at the nginx level for rate limiting
- Implement fail2ban rules for repeat offenders

## Additional Security Hardening Recommendations

### SSL/TLS Hardening
- [ ] Enable TLS 1.2 and 1.3 only (disable TLS 1.0, 1.1)
- [ ] Configure strong cipher suites (prefer ECDHE and CHACHA20-POLY1305)
- [ ] Enable HSTS (HTTP Strict Transport Security) with long max-age
- [ ] Implement OCSP stapling for faster certificate validation
- [ ] Configure SSL session caching for performance
- [ ] Set up automatic certificate renewal with Let's Encrypt/Certbot

### Security Headers
- [ ] Add `X-Frame-Options: SAMEORIGIN` to prevent clickjacking
- [ ] Add `X-Content-Type-Options: nosniff` to prevent MIME sniffing
- [ ] Add `X-XSS-Protection: 1; mode=block` for legacy browser XSS protection
- [ ] Implement Content-Security-Policy (CSP) headers
- [ ] Add `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] Add `Permissions-Policy` to control browser features
- [ ] Remove `Server` header or set to generic value to hide NGINX version

### Request Filtering & Limits
- [ ] Limit request body size (`client_max_body_size`)
- [ ] Set connection timeouts (`client_body_timeout`, `client_header_timeout`)
- [ ] Limit concurrent connections per IP (`limit_conn_zone`, `limit_conn`)
- [ ] Configure request rate limiting (`limit_req_zone`, `limit_req`)
- [ ] Block requests with suspicious user agents
- [ ] Block requests to sensitive file extensions (.git, .env, .sql, etc.)
- [ ] Limit HTTP methods (allow only GET, POST, PUT, DELETE, PATCH, OPTIONS)

### DDoS Protection
- [ ] Configure `limit_conn` to prevent connection flooding
- [ ] Set up `limit_req` with burst handling for request flooding
- [ ] Enable `proxy_buffering` for upstream protection
- [ ] Configure `keepalive_timeout` to release idle connections
- [ ] Consider integrating with Cloudflare or AWS WAF for edge protection

### Access Control
- [ ] Restrict access to admin endpoints by IP whitelist
- [ ] Block access to hidden files and directories (dotfiles)
- [ ] Disable directory listing (`autoindex off`)
- [ ] Implement HTTP Basic Auth for sensitive admin areas
- [ ] Block access from known malicious IP ranges (use GeoIP module)

### Logging & Monitoring
- [ ] Enable detailed access logging with custom log format
- [ ] Configure error logging with appropriate log levels
- [ ] Set up log rotation to prevent disk exhaustion
- [ ] Integrate with centralized logging (ELK, Grafana Loki, etc.)
- [ ] Configure real-time monitoring alerts for suspicious patterns
- [ ] Log rate-limited and blocked requests separately

### Performance & Reliability
- [ ] Enable gzip compression for text-based responses
- [ ] Configure browser caching headers for static assets
- [ ] Set up upstream health checks for backend services
- [ ] Configure connection pooling for proxy_pass backends
- [ ] Enable HTTP/2 for improved performance
- [ ] Consider enabling HTTP/3 (QUIC) support

### Infrastructure Security
- [ ] Run NGINX as non-root user
- [ ] Use separate user for worker processes
- [ ] Restrict file permissions on NGINX config files
- [ ] Disable unnecessary NGINX modules
- [ ] Keep NGINX updated to latest stable version
- [ ] Consider running NGINX in a container with minimal privileges

### fail2ban Integration
- [ ] Create custom jail for repeated 401/403 responses
- [ ] Create jail for excessive 404 requests (scanner detection)
- [ ] Create jail for rate-limited requests
- [ ] Configure ban duration escalation for repeat offenders
- [ ] Set up email notifications for bans
- [ ] Whitelist trusted IPs (monitoring, CI/CD, etc.)

### API-Specific Hardening
- [ ] Validate `Content-Type` headers on POST/PUT requests
- [ ] Implement request size limits per endpoint
- [ ] Add API versioning at the NGINX level
- [ ] Configure CORS headers appropriately
- [ ] Rate limit authentication endpoints more aggressively
- [ ] Block requests without valid API keys at NGINX level (if applicable)
