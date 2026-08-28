# Discord Automation Cloud (SaaS) - Enterprise Master Operations Guide

This master operations manual covers enterprise infrastructure management, Cloudflare CDN integration, Enterprise SSO SAML/OIDC setup, Slash Command deployment automation, and Chaos Engineering disaster recovery.

---

## ☁️ 1. Infrastructure & Cloudflare CDN Edge Setup

### Cloudflare Edge Rules
1. **SSL / TLS Mode**: Set to `Full (strict)` with Origin RSA certificates.
2. **Page Rules / Caching**:
   - `http://your-saas.com/api/v1/*` → Bypass Cache (Always Dynamic)
   - `http://your-saas.com/_next/static/*` → Cache Everything (Edge TTL 1 Month)
3. **Web Application Firewall (WAF)**:
   - Enable OWASP Core Ruleset against SQLi, XSS, and RCE.
   - Configure Zone Rate Limiting: 100 requests per minute for `/api/v1/auth/*`.

---

## 🔑 2. Enterprise SSO (Okta, Microsoft Entra ID, Google Workspace)

Configure SAML 2.0 / OIDC identity providers via the `EnterpriseSsoProvider` model:

- **Entity ID**: `https://your-saas.com/api/v1/sso/saml/metadata`
- **ACS URL**: `https://your-saas.com/api/v1/sso/saml/acs`
- **User Role Mapping**: Map IdP groups (`DiscordAdmins`, `DiscordModerators`) to SaaS Workspace permissions (`OWNER`, `ADMIN`, `MEMBER`).

---

## 🤖 3. Slash Command Deployment Automation

Deploy global application commands across all shards:

```bash
cd backend
npx ts-node src/bot/deploy-commands.ts
```

Commands registered:
- `/rank` — Interactive Canvas rank card
- `/ticket` — Open ticket panel
- `/suggest` — Community proposal engine
- `/automod` — Threat policy configuration
- `/ai` — Multi-model AI assistant query

---

## 📈 4. OpenTelemetry Tracing & Loki Centralized Logging

1. **Grafana Dashboards**: Open `http://localhost:3001` (Default login: `admin` / `adminpassword`).
2. **Loki Logs**: Query application logs using LogQL: `{job="discord-saas-api"}` or `{job="discord-bot-cluster"}`.
3. **OpenTelemetry Spans**: Inspect distributed trace IDs across API endpoints and Redis BullMQ queues.

---

## 💥 5. Chaos Engineering & Resilience Tests

Run self-healing chaos experiments:

```bash
cd backend
npx ts-node src/tests/chaos_test.ts
```
