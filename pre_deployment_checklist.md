# 🚀 ReplyFlow SaaS — Production Deployment Checklist

This document tracks all developer setup steps, API credentials, approval requirements, and rate limit rules before launching ReplyFlow to production for thousands of users.

---

## 1. 🎵 TikTok Integration Checklist

### 🔑 Developer Portal Setup (Aapko 1-Time Karna Hai):
1. **TikTok Developer Portal:** Go to [developers.tiktok.com](https://developers.tiktok.com) and create an App.
2. **App Type:** Select **Web Application / Commercial Content & Messaging**.
3. **Set Redirect URI:**
   `https://yourdomain.com/api/tiktok/callback`
4. **Copy Credentials to `.env`:**
   ```env
   TIKTOK_CLIENT_KEY=your_tiktok_client_key
   TIKTOK_CLIENT_SECRET=your_tiktok_client_secret
   ```

### 👤 User Account Requirements (Users Ke Liye Rule):
- **Business Account Required:** User's TikTok account **MUST** be switched to a **TikTok Business Account** (Free in TikTok Settings -> Switch to Business).
- **Permissions Approved:** Users click **"+ Add Account"** in ReplyFlow -> approve profile, video, and comment management scopes.

### ⚠️ TikTok Rate Limits & Best Practices:
- **Max Comment Replies:** 100 comment replies per hour per account.
- **Link Delivery:** Direct link in comment reply (or bio link redirect).
- **Spam Avoidance:** Spintax enabled for varied comment replies.

---

## 2. 🎥 YouTube Integration Checklist

### 🔑 Google Cloud Console Setup:
1. Enable **YouTube Data API v3** in GCP Console.
2. Configure **OAuth Consent Screen** (App Name: `ReplyFlow`, Type: `External`).
3. Create **OAuth 2.0 Client ID** (Web application).
4. Set Authorized Redirect URI: `https://yourdomain.com/api/youtube/callback`
5. **Copy Credentials to `.env`:**
   ```env
   YOUTUBE_CLIENT_ID=your_client_id.apps.googleusercontent.com
   YOUTUBE_CLIENT_SECRET=GOCSPX-your_client_secret
   ```
6. **Submit for Verification:** Submit OAuth Consent Screen for Google Verification (takes 2-3 days for un-verified warning removal).

---

## 3. 📷 Instagram & Facebook Pages Checklist

### 🔑 Meta for Developers Setup:
1. Facebook App with **Instagram Graph API** + **Facebook Pages API**.
2. Webhook Callback URL: `https://yourdomain.com/api/webhooks/instagram`
3. Verify Token: `replyflow_secret_123`
4. Subscriptions: `comments`, `messages`.
5. Submit Meta App Review for `instagram_business_manage_comments` and `instagram_business_manage_messages`.

---

## 4. 🌐 Server & Production Setup Checklist

- [ ] **HTTPS / SSL Certificate:** Domain MUST have HTTPS (Let's Encrypt / Cloudflare SSL).
- [ ] **Process Manager:** Run server with PM2 (`pm2 start server.js --name replyflow`).
- [ ] **Environment Variables:** All secrets loaded in production `.env`.
- [ ] **Rate Limiter:** Express Rate Limit enabled (100 req/min per IP) to prevent DDoS.
- [ ] **Database Backup:** Periodic cron job backing up `database.json`.

---

*Last Updated: August 2026 | ReplyFlow Development Team*
