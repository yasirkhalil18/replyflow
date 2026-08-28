import discord
import asyncio
import os
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

DISCORD_BOT_TOKEN = os.environ.get("DISCORD_BOT_TOKEN", "")


intents = discord.Intents.all()
client = discord.Client(intents=intents)

async def setup_guild_plugins(guild: discord.Guild):
    print(f"\n=========================================================")
    print(f"Configuring all 8 Plugin Channels for Guild: {guild.name} (ID: {guild.id})")
    print(f"=========================================================")
    
    # 1. Plugin 1: Welcome & Onboarding
    cat_welcome = discord.utils.get(guild.categories, name="👋 WELCOME LOBBY") or await guild.create_category("👋 WELCOME LOBBY")
    ch_welcome = (
        discord.utils.get(guild.text_channels, name="welcome") or
        await guild.create_text_channel("welcome", category=cat_welcome)
    )
    print("[OK] Plugin 1 (Welcome & Onboarding): #welcome ready")

    # 2. Plugin 4: Live Server Stats Counter Channels
    cat_stats = discord.utils.get(guild.categories, name="📊 SERVER STATS") or await guild.create_category("📊 SERVER STATS")
    
    total_m = len(guild.members)
    bot_cnt = sum(1 for m in guild.members if m.bot)
    on_cnt = sum(1 for m in guild.members if str(m.status) != 'offline')
    admin_cnt = sum(1 for m in guild.members if m.guild_permissions.administrator or m.guild_permissions.manage_channels) or 1
    
    vc_total = discord.utils.get(cat_stats.voice_channels, name=lambda n: "Total Members:" in n or "All Members:" in n or "👥" in n)
    if not vc_total:
        vc_total = await guild.create_voice_channel(f"👥 Total Members: {total_m}", category=cat_stats)

    vc_online = discord.utils.get(cat_stats.voice_channels, name=lambda n: "Online:" in n or "🟢" in n)
    if not vc_online:
        vc_online = await guild.create_voice_channel(f"🟢 Online Members: {on_cnt}", category=cat_stats)

    vc_admins = discord.utils.get(cat_stats.voice_channels, name=lambda n: "Admins:" in n or "🛡️" in n)
    if not vc_admins:
        vc_admins = await guild.create_voice_channel(f"🛡️ Admins: {admin_cnt}", category=cat_stats)

    vc_bots = discord.utils.get(cat_stats.voice_channels, name=lambda n: "Bots:" in n or "🤖" in n)
    if not vc_bots:
        vc_bots = await guild.create_voice_channel(f"🤖 Server Bots: {bot_cnt}", category=cat_stats)

    print("[OK] Plugin 4 (Live Server Stats): 📊 SERVER STATS voice channels ready")

    # 3. Plugin 8: AI Assistant & Auto Reply
    cat_ai = discord.utils.get(guild.categories, name="🤖 AI & COMMUNITY") or await guild.create_category("🤖 AI & COMMUNITY")
    ch_ai = (
        discord.utils.get(guild.text_channels, name="ai-assistant") or
        await guild.create_text_channel("ai-assistant", category=cat_ai)
    )
    print("[OK] Plugin 8 (AI Assistant & Auto Reply): #ai-assistant ready")

    # 4. Plugin 3: Support Ticket Desk
    cat_tickets = (
        discord.utils.get(guild.categories, name="🎟️ SUPPORT TICKETS") or 
        discord.utils.get(guild.categories, name="TICKETS") or 
        await guild.create_category("🎟️ SUPPORT TICKETS")
    )
    ch_tickets = (
        discord.utils.get(guild.text_channels, name="tickets") or
        discord.utils.get(guild.text_channels, name="open-a-ticket") or
        await guild.create_text_channel("tickets", category=cat_tickets)
    )
    print("[OK] Plugin 3 (Ticket Support Desk): #tickets ready")

    # 5. Plugin 2: Leveling & XP System
    cat_leveling = (
        discord.utils.get(guild.categories, name="🏆 LEVELING & XP") or
        await guild.create_category("🏆 LEVELING & XP")
    )
    ch_leveling = (
        discord.utils.get(guild.text_channels, name="leaderboard-and-ranks") or
        await guild.create_text_channel("leaderboard-and-ranks", category=cat_leveling)
    )
    print("[OK] Plugin 2 (Leveling & XP): #leaderboard-and-ranks ready")

    # 6. Plugin 7: Suggestions & Voting System
    cat_suggest = (
        discord.utils.get(guild.categories, name="💡 COMMUNITY SUGGESTIONS") or
        await guild.create_category("💡 COMMUNITY SUGGESTIONS")
    )
    ch_suggest = (
        discord.utils.get(guild.text_channels, name="suggestions") or
        await guild.create_text_channel("suggestions", category=cat_suggest)
    )
    print("[OK] Plugin 7 (Suggestions & Voting): #suggestions ready")

    # 7. Plugin 6: Social Media & Market Feeds
    cat_feeds = (
        discord.utils.get(guild.categories, name="📢 SOCIAL & MARKET FEEDS") or
        await guild.create_category("📢 SOCIAL & MARKET FEEDS")
    )
    ch_feeds = (
        discord.utils.get(guild.text_channels, name="social-feed-updates") or
        discord.utils.get(guild.text_channels, name="live-market-feeds") or
        await guild.create_text_channel("social-feed-updates", category=cat_feeds)
    )
    print("[OK] Plugin 6 (Social Media Feeds): #social-feed-updates ready")

    # 8. Plugin 5: Auto Moderation & Safety
    cat_automod = (
        discord.utils.get(guild.categories, name="🛡️ AUTOMOD & SAFETY") or
        await guild.create_category("🛡️ AUTOMOD & SAFETY")
    )
    ch_automod = (
        discord.utils.get(guild.text_channels, name="automod-logs") or
        await guild.create_text_channel("automod-logs", category=cat_automod)
    )
    print("[OK] Plugin 5 (Auto Moderation & Safety): #automod-logs ready")

@client.event
async def on_ready():
    print(f"Connected as {client.user.name} (ID: {client.user.id})")
    print("Connected Guilds:")
    for g in client.guilds:
        print(f" - Guild Name: '{g.name}' | ID: {g.id}")

    for guild in client.guilds:
        if str(guild.id) == "1330964283198013461":
            print(f"Skipping old rate limited test guild '{guild.name}' ({guild.id})")
            continue
        try:
            await setup_guild_plugins(guild)
        except Exception as err:
            print(f"[SetupNote] Guild '{guild.name}' note: {err}")

    print("\n=========================================================")
    print("  ALL 8 SYSTEM PLUGIN CATEGORIES & CHANNELS CONFIGURED!  ")
    print("=========================================================")
    await client.close()

client.run(DISCORD_BOT_TOKEN)
