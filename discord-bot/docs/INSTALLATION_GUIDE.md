# Discord Automation Cloud (SaaS) - Installation Guide

This guide covers local environment setup, dependency resolution, environment configuration, database migration, and initial bot token provisioning.

---

## 📋 System Requirements

- **Node.js**: `v18.x` or `v20.x` LTS
- **Python**: `v3.12+` (for standalone single-file launcher)
- **PostgreSQL**: `v16.x`
- **Redis**: `v7.x`
- **Docker**: `v24.x+` & Docker Compose `v2.x+`

---

## 🛠️ Step 1: Clone & Environment Variables

Copy `.env.example` to `.env` in both `/backend` and root directories:

```env
# Database & Cache
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/discord_saas?schema=public"
REDIS_URL="redis://localhost:6379"

# Discord Bot OAuth Credentials
DISCORD_CLIENT_ID="123456789012345678"
DISCORD_CLIENT_SECRET="your_discord_client_secret"
DISCORD_BOT_TOKEN="your_discord_bot_token"
DISCORD_REDIRECT_URI="http://localhost:3000/api/auth/callback"

# Security & Encryption
ENCRYPTION_KEY="32_character_ultra_secret_key_!"
JWT_SECRET="super_jwt_secret_key"

# Payment Webhook Keys
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
PAYPAL_CLIENT_ID="paypal_client_id"
PAYPAL_SECRET="paypal_secret"
```

---

## ⚡ Step 2: Local Database Migration & Seeding

```bash
cd backend
npm install
npx prisma db push
npx prisma generate
```

---

## 🚀 Step 3: Run Development Servers

### Option A: Standalone Launcher (Zero Dependencies)
```bash
python server.py
```
Access dashboard on `http://localhost:3000`.

### Option B: Full Next.js & Express Stack
```bash
# Terminal 1: Express API & Bot Cluster
cd backend
npm run dev

# Terminal 2: Next.js Frontend Dashboard
cd frontend
npm run dev
```
