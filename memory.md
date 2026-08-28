# ReplyFlow Project Memory

This file serves as a centralized project memory to preserve tokens, context, and credentials across model iterations.

## ── Project Identity & Access ──
- **Application**: ReplyFlow Social Media Auto-Responder
- **Environment**: Node.js Express Backend + Vanilla JS/CSS SPA Frontend
- **Working Address**: `http://localhost:3000/`
- **Figma Design Integration**:
  - File Key: `EbGFRrpKLIMdXXV0bNsELF`
  - Personal Access Token (PAT): REDACTED_FIGMA_PAT
  - URL: `https://www.figma.com/design/EbGFRrpKLIMdXXV0bNsELF/Untitled?node-id=0-1&p=f&t=3sXwOIawwtD97bo2-0`

## ── File Directory Map ──
- **[package.json](file:///c:/xampp/htdocs/Automation/replyflow-mobile/package.json)**: Express dependency definitions and execution scripts.
- **[server.js](file:///c:/xampp/htdocs/Automation/replyflow-mobile/server.js)**: REST API backend handlers and in-memory mock datasets.
- **[index.html](file:///c:/xampp/htdocs/Automation/replyflow-mobile/index.html)**: Main single-page application markup container and modals overlays.
- **[styles.css](file:///c:/xampp/htdocs/Automation/replyflow-mobile/styles.css)**: Tokens design system definitions and responsive desktop/mobile view styles.
- **[app.js](file:///c:/xampp/htdocs/Automation/replyflow-mobile/app.js)**: Interactive routing triggers, event listeners, and API calls.

## ── Dynamic Architecture Design ──
- **SPA Routing (Hash Routing)**:
  - Synchronizes active screen states with URL Hash changes (e.g. `/#dashboard`, `/#accounts`, `/#triggers`, `/#analytics`, `/#settings`).
  - Reloads and preserves the active screen on page refresh, and binds standard history state navigation through a centralized hashchange listener.
- **Platform-Specific Themes**:
  - Active themes adapt styling based on selected platform tabs:
    - **Instagram / Facebook**: Pink theme accent (`#EC4899`) applied to active tabs, trigger keyword titles, and toggle switches.
    - **YouTube**: Red theme accent (`#ED332E`) applied to active tabs, trigger keyword titles, and toggle switches.
    - **TikTok**: Grayed out (Disabled/Coming Soon).
- **Accounts Screen Segmented Tabs**:
  - Filters accounts details, switcher handles, and synced post rows by selected platform (Instagram vs YouTube vs TikTok).
  - Each post/video row displays an **AI Reply Toggle Button** (POST `/api/accounts/post/toggle-ai`) which allows enabling or disabling AI-generated responses for that specific media item.
  - Clicking **"Set Trigger"** next to a post opens the modal configured to link that trigger specifically to the post's scope. Users can assign **multiple triggers** to a single post/video, incrementing its `triggersCount` metric dynamically.
- **Multi-Account Linking**:
  - Dashed tab `+ Add Account` triggers popup modal, adding a new profile handles mapping dynamically via `POST /api/accounts` with generated mock posts.
- **Profile Edit Form**:
  - Full Name, Email, and Avatar picture change uploads (`POST /api/profile/avatar` with base64 Data URLs) update all matching nodes instantly in the application shell.
  - Interactive **Crop & Rotate Modal** allows scaling (zoom slider), rotation (↺ Left / ↻ Right by 90°), and custom drag translation positioning inside a circular mask container using HTML5 `<canvas>` rendering export.
- **Billing Details Modal**:
  - Manage billing details modal contains usage stats, pricing plan metrics, and chronological invoice list tables, supporting dynamic plan switching.
- **Auto-Reply Simulator Card**:
  - Dashboard playground card allowing users to simulate comment input on any synced account media. Verifies system routing: (1) Matches active fixed keyword triggers first (skips AI Reply), (2) If no keyword matches, checks if the media item's AI Reply toggle is active to generate responses.

## ── Instagram OAuth Connect Flow ──
- **Connect button**: `#btn-connect-instagram` (Accounts screen) and `#btn-connect-instagram-ig` (IG Automation screen) open a centered popup to `/api/instagram/authorize`.
- **Popup OAuth**: demo mode serves a simulated IG login/consent page (since no live Meta App credentials). Production mode redirects to the real Instagram OAuth URL.
- **State token**: cryptographically random, server-side stored, 10-min TTL, single-use — CSRF protection.
- **Callback**: `/api/instagram/callback` validates state → exchanges code → encrypts token → upserts account → serves minimal HTML that `window.opener.postMessage()` back with explicit target origin, then `window.close()`.
- **Frontend listener**: `connectInstagram()` in `app.js` listens for `message` events from the popup, filters by `event.origin === window.location.origin`, and on `INSTAGRAM_CONNECTED` re-fetches accounts and shows a success toast. On `INSTAGRAM_CONNECT_FAILED`, shows an error toast.
- **Popup close detection**: `setInterval` checks `popup.closed` every 1s to reset UI if user closes the window manually.
- **Account rejection**: Personal (non-Business/Creator) Instagram accounts are rejected with a clear error message.
- **Token at rest**: AES-256-GCM encrypted, never returned in API responses.
- **Re-connect**: upsert — updates existing record, does not create duplicates.
- **New APIs**: `GET /api/instagram/authorize`, `GET /api/instagram/callback`, `GET /api/instagram/accounts`, `POST /api/instagram/accounts/disconnect`, `PUT /api/follow-gate/config/:id`, `GET /api/follow-gate/config`, `POST /api/follow-gate/confirm`, `POST /api/follow-gate/confirmations`.

## ── Server Execution Rules ──
- **Server Startup Command**: When requested to turn on servers ("server on karo", "start server", etc.), launch both the Node.js Express server (`node server.js`) on port 3000 and the `ngrok` tunnel (`ngrok http 3000`).

