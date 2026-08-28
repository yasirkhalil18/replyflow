# Step-by-Step Guide: Connecting Your Discord Server & Bot

Follow these steps to connect your actual Discord server and bot token with the **Discord Automation Cloud (SaaS)** platform.

---

## 🛠️ Step 1: Create Discord Application & Bot Token

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click the **"New Application"** button in the top right.
3. Enter your Bot Name (e.g. `Discord Automation Bot`) and click **Create**.
4. Go to the **Bot** tab on the left menu:
   - Click **"Reset Token"** (or Copy Token) and copy your **Bot Token** (`DISCORD_BOT_TOKEN`).
   - Scroll down to **Privileged Gateway Intents** and enable ALL THREE:
     - ✅ **PRESENCE INTENT**
     - ✅ **SERVER MEMBERS INTENT**
     - ✅ **MESSAGE CONTENT INTENT**
   - Click **Save Changes**.

---

## 🔑 Step 2: Get OAuth2 Credentials & Add Redirect URI

1. Go to the **OAuth2** tab on the left menu:
   - Copy your **Client ID** (`DISCORD_CLIENT_ID`).
   - Click **"Reset Secret"** and copy your **Client Secret** (`DISCORD_CLIENT_SECRET`).
2. Under **Redirects**, click **"Add Redirect"**:
   - Enter `http://localhost:3000/api/auth/callback` (or your production URL).
   - Click **Save Changes**.

---

## 📩 Step 3: Invite Bot to Your Discord Server

1. Under the **OAuth2** tab, click **URL Generator**:
   - In **Scopes**, check:
     - ✅ `bot`
     - ✅ `applications.commands`
   - In **Bot Permissions**, check:
     - ✅ `Administrator` (or `Manage Roles`, `Manage Channels`, `Kick Members`, `Ban Members`, `Send Messages`, `Embed Links`, `Read Message History`, `Manage Webhooks`).
2. Copy the **Generated URL** at the bottom of the page.
3. Open the URL in a new browser tab, select your Discord server, and click **Authorize**.

---

## ⚙️ Step 4: Add Credentials to `.env` File

Create or update the `.env` file in `d:\discord\backend\.env`:

```env
DISCORD_CLIENT_ID="YOUR_COPIED_CLIENT_ID"
DISCORD_CLIENT_SECRET="YOUR_COPIED_CLIENT_SECRET"
DISCORD_BOT_TOKEN="YOUR_COPIED_BOT_TOKEN"
DISCORD_REDIRECT_URI="http://localhost:3000/api/auth/callback"

DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/discord_saas?schema=public"
REDIS_URL="redis://localhost:6379"
```

---

## 🚀 Step 5: Deploy Slash Commands & Start Bot Listener

Run the automated command deployment script to register global Slash Commands (`/rank`, `/ticket`, `/suggest`, `/automod`, `/ai`) with Discord:

```bash
cd backend
npx ts-node src/bot/deploy-commands.ts
```

Start the bot event listener & sharding manager:

```bash
cd backend
npx ts-node src/bot/index.ts
```

Your Discord bot will now come online in your Discord server, respond to slash commands, process welcome cards, level up users, manage tickets, and sync settings live with your dashboard!
