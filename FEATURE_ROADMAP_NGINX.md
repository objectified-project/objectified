# NGINX settings roadmap for Objectified

These are the tasks remaining for Nginx to button down the support and security.

## AI Suggested fixes

- Look into rate limiting
- Block at the nginx level for rate limiting
- Implement fail2ban rules for repeat offenders

## Additional Security Hardening Recommendations

### Quick Wins
- Install torblock to block Tor exit nodes

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|
| #427   | Install torblock to block Tor exit nodes         |

### SSL/TLS Hardening
- Configure strong cipher suites (prefer ECDHE and CHACHA20-POLY1305)
- Enable TLS 1.2 and 1.3 only (disable TLS 1.0, 1.1)
- Enable HSTS (HTTP Strict Transport Security) with long max-age
- Implement OCSP stapling for faster certificate validation
- Configure SSL session caching for performance
- ✅ Set up automatic certificate renewal with Let's Encrypt/Certbot

| Ticket | Feature Description              |
|--------|----------------------------------|
| #428   | Harden SSL/TLS settings in NGINX |
| #429   | Implement TLS 1.2/1.3            |
| #430   | Enable HSTS with long max-age    |
| #431   | Implement OCSP stapling          |
| #432   | Set up SSL session caching       |

### Security Headers
- Add `X-Frame-Options: SAMEORIGIN` to prevent clickjacking
- Add `X-Content-Type-Options: nosniff` to prevent MIME sniffing
- Add `X-XSS-Protection: 1; mode=block` for legacy browser XSS protection
- Implement Content-Security-Policy (CSP) headers
- Add `Referrer-Policy: strict-origin-when-cross-origin`
- Add `Permissions-Policy` to control browser features
- Remove `Server` header or set to generic value to hide NGINX version

| Ticket | Feature Description                             |
|--------|-------------------------------------------------|
| #433   | Add X-Frame-Options to prevent clickjacking     |
| #434   | Add X-Content-Type-Options nosniff              |
| #435   | Add X-XSS-Protection headers                    |
| #436   | Implement Content-Security-Policy (CSP) headers |
| #437   | Add Referrer-Policy header                      |
| #438   | Add Permissions-Policy header                   |
| #439   | Remove or modify Server header                  |

### Request Filtering & Limits
- Limit request body size (`client_max_body_size`)
- Set connection timeouts (`client_body_timeout`, `client_header_timeout`)
- Limit concurrent connections per IP (`limit_conn_zone`, `limit_conn`)
- Configure request rate limiting (`limit_req_zone`, `limit_req`)
- Block requests with suspicious user agents
- Block requests to sensitive file extensions (.git, .env, .sql, etc.)
- Limit HTTP methods (allow only GET, POST, PUT, DELETE, PATCH, OPTIONS)

| Ticket | Feature Description                         |
|--------|---------------------------------------------|
| #440   | Limit request body size                     |
| #441   | Set connection timeouts                     |
| #442   | Limit concurrent connections per IP         |
| #443   | Configure request rate limiting             |
| #444   | Block suspicious user agents                |
| #445   | Block requests to sensitive file extensions |
| #446   | Limit allowed HTTP methods                  |

### DDoS Protection
- Enable `proxy_buffering` for upstream protection
- Configure `keepalive_timeout` to release idle connections

| Ticket | Feature Description                                     |
|--------|---------------------------------------------------------|
| #447   | Enable proxy_buffering for upstream protection          |
| #448   | Configure keepalive_timeout to release idle connections |

### Access Control
- Restrict access to admin endpoints by IP whitelist
- Block access to hidden files and directories (dotfiles)
- Disable directory listing (`autoindex off`)
- Block access from known malicious IP ranges (use GeoIP module)

| Ticket | Feature Description                                |
|--------|----------------------------------------------------|
| #449   | Restrict access to admin endpoints by IP whitelist |
| #450   | Block access to hidden files and directories       |
| #451   | Disable directory listing                          |
| #452   | Block access from known malicious IP ranges        |

### Logging & Monitoring
- Enable detailed access logging with custom log format
- Set up log rotation to prevent disk exhaustion
- Log rate-limited and blocked requests separately

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|
| #453   | Enable detailed access logging                   |
| #454   | Set up log rotation to prevent disk exhaustion   |
| #455   | Log rate-limited and blocked requests separately |

### Performance & Reliability
- Enable gzip compression for text-based responses
- Configure browser caching headers for static assets
- Configure connection pooling for proxy_pass backends
- Enable HTTP/2 for improved performance
- Consider enabling HTTP/3 (QUIC) support

| Ticket | Feature Description                                        |
|--------|------------------------------------------------------------|
| #456   | Enable gzip and other compression for text-based responses |
| #457   | Configure browser caching headers for static assets        |
| #458   | Configure connection pooling for proxy_pass backends       |
| #459   | Enable HTTP/2 for improved performance                     |
| #460   | Consider enabling HTTP/3 (QUIC) support                    |

### Infrastructure Security
- Run NGINX as non-root user
- Use separate user for worker processes
- Restrict file permissions on NGINX config files
- Disable unnecessary NGINX modules
- Keep NGINX updated to latest stable version

| Ticket | Feature Description                             |
|--------|-------------------------------------------------|
| #461   | Run NGINX as non-root user                      |
| #462   | Use separate user for worker processes          |
| #463   | Restrict file permissions on NGINX config files |
| #464   | Disable unnecessary NGINX modules               |
| #465   | Keep NGINX updated to latest stable version     |

### fail2ban Integration
- Create custom jail for repeated 401/403 responses
- Create jail for excessive 404 requests (scanner detection)
- Create jail for rate-limited requests
- Configure ban duration escalation for repeat offenders
- Whitelist trusted IPs (monitoring, CI/CD, etc.)

| Ticket | Feature Description                                    |
|--------|--------------------------------------------------------|
| #466   | Create custom jail for repeated 401/403 responses      |
| #467   | Create jail for excessive 404 requests                 |
| #468   | Create jail for rate-limited requests                  |
| #469   | Configure ban duration escalation for repeat offenders |
| #470   | Whitelist trusted IPs                                  |

---

# Completed

## Security harden NGINX

- Implement https://github.com/mitchellkrogza/nginx-ultimate-bad-bot-blocker
