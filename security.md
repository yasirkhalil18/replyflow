# ReplyFlow Security Framework

This document outlines the security checks, safeguards, and recommendations to protect tokens, credentials, and data integrity within the ReplyFlow application.

## ── 1. Token & Credential Protection ──
- **Figma API Credentials**:
  - The Figma Personal Access Token (PAT) and File Keys must be kept private.
  - **Do NOT** embed these keys in client-side javascript (`app.js`) or version control repository commits.
  - Recommended setup: Move them to environment variables (e.g., in a `.env` file) and load them inside `server.js` using `process.env.FIGMA_PAT`.

## ── 2. Input Sanitization & XSS Prevention ──
- To block Cross-Site Scripting (XSS) when rendering user replies or keyword triggers, inputs must be sanitized.
- **Express Backend Check (Sanitization)**:
  - Prior to pushing new triggers, strip HTML tags from input fields:
    ```javascript
    const sanitizeHTML = (str) => str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    ```
- **Max length constraints**:
  - `keyword`: Max 50 characters.
  - `reply`: Max 500 characters.

## ── 3. Profile Avatar Upload Security ──
- Profile picture uploads accept base64 Data URLs via `POST /api/profile/avatar`.
- To prevent Denial of Service (DoS) or file exploitation:
  - **Payload Size Limits**: Restrict the incoming JSON parser size to avoid memory exhaustion from massive images:
    ```javascript
    app.use(express.json({ limit: '5mb' }));
    ```
  - **MIME Type Validation**: Verify that the incoming Data URL starts with valid image indicators:
    ```javascript
    if (!avatarData.startsWith("data:image/")) {
      return res.status(400).json({ error: "Invalid file type. Only images are allowed." });
    }
    ```

## ── 4. API Rate Limiting ──
- To block brute-force automation triggers:
  - Integrate a standard rate limiter on state modifiers:
    ```javascript
    const rateLimit = require("express-rate-limit");
    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    });
    app.use("/api/", apiLimiter);
    ```

## ── 5. Instagram OAuth — Secret & Token Protection ──
- **App Secret**: loaded exclusively from `process.env.INSTAGRAM_APP_SECRET` (via `.env` file). NEVER embedded in `app.js`, `index.html`, or any client-side bundle.
- **Access Tokens**: encrypted at rest using AES-256-GCM (`encryptToken()` in `server.js`). The `GET /api/instagram/accounts` endpoint deliberately omits `accessTokenEncrypted` from the response — tokens are never sent to the frontend.
- **State Parameter (CSRF Protection)**: each OAuth flow generates a cryptographically random 32-byte state token (`crypto.randomBytes`). The token is stored server-side in `instagramOAuthStates` with a 10-minute TTL, is single-use, and is validated on callback. Any missing, expired, or reused state is rejected.
- **postMessage Security**: the callback HTML page calls `window.opener.postMessage()` with an explicit target origin (`REPLYFLOW_ORIGIN` from config) — never `"*"`.
- **Redirect URI**: configured via `INSTAGRAM_REDIRECT_URI` env variable, matching the Meta App Dashboard registration exactly. Supports dev/staging/production differences.
- **Account Type Validation**: after token exchange, the Instagram account type is checked. Personal accounts are rejected — the connection is NOT saved — with a clear error message.
- **Never scrape Instagram**: follow-gate confirmation is trust-based (explicit button click only). No undocumented/private Meta endpoints are called to verify follow status.

## ── 6. Environment Variables Required ──
All loaded from `.env` (excluded from git via `.gitignore`):

| Variable | Purpose |
|---|---|
| `INSTAGRAM_APP_ID` | Instagram App ID (public) |
| `INSTAGRAM_APP_SECRET` | Instagram App Secret (private, server-side only) |
| `INSTAGRAM_REDIRECT_URI` | Must match Meta App Dashboard exactly |
| `INSTAGRAM_OAUTH_SCOPES` | Comma-separated scopes |
| `TOKEN_ENCRYPTION_KEY` | 32-byte key for AES-256-GCM token encryption |
