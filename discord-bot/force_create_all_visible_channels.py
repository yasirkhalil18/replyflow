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

async def setup_visible_channels(guild: discord.Guild):
    print(f"\n=========================================================")
    print(f"FORCING ALL 8 VISIBLE PLUGIN CHANNELS FOR GUILD: {guild.name} (ID: {guild.id})")
    print(f"=========================================================")

    everyone_overwrite = {
        guild.default_role: discord.PermissionOverwrite(read_messages=True, send_messages=True, view_channel=True)
    }
    read_only_overwrite = {
        guild.default_role: discord.PermissionOverwrite(read_messages=True, send_messages=False, view_channel=True)
    }

    # 1. WELCOME LOBBY
    cat_welcome = discord.utils.get(guild.categories, name="👋 WELCOME LOBBY") or await guild.create_category("👋 WELCOME LOBBY")
    ch_welcome = discord.utils.get(guild.text_channels, name="welcome")
    if not ch_welcome:
        ch_welcome = await guild.create_text_channel("welcome", category=cat_welcome, overwrites=read_only_overwrite)
    else:
        await ch_welcome.edit(category=cat_welcome, overwrites=read_only_overwrite)
    print(" [1/8] 👋 WELCOME LOBBY -> #welcome READY")

    # 2. SERVER STATS (Category + Voice Counters + Text Channel)
    cat_stats = discord.utils.get(guild.categories, name="📊 SERVER STATS") or await guild.create_category("📊 SERVER STATS")
    ch_stats_text = discord.utils.get(guild.text_channels, name="server-stats-info")
    if not ch_stats_text:
        ch_stats_text = await guild.create_text_channel("server-stats-info", category=cat_stats, overwrites=read_only_overwrite)
    
    total_m = len(guild.members)
    bot_cnt = sum(1 for m in guild.members if m.bot)
    on_cnt = sum(1 for m in guild.members if str(m.status) != 'offline')
    admin_cnt = sum(1 for m in guild.members if m.guild_permissions.administrator or m.guild_permissions.manage_channels) or 1

    voice_overwrites = {
        guild.default_role: discord.PermissionOverwrite(connect=False, view_channel=True)
    }

    vc_total = discord.utils.get(cat_stats.voice_channels, name=lambda n: "Total Members:" in n or "All Members:" in n or "👥" in n)
    if not vc_total:
        await guild.create_voice_channel(f"👥 Total Members: {total_m}", category=cat_stats, overwrites=voice_overwrites)

    vc_online = discord.utils.get(cat_stats.voice_channels, name=lambda n: "Online:" in n or "🟢" in n)
    if not vc_online:
        await guild.create_voice_channel(f"🟢 Online Members: {on_cnt}", category=cat_stats, overwrites=voice_overwrites)

    vc_admins = discord.utils.get(cat_stats.voice_channels, name=lambda n: "Admins:" in n or "🛡️" in n)
    if not vc_admins:
        await guild.create_voice_channel(f"🛡️ Admins: {admin_cnt}", category=cat_stats, overwrites=voice_overwrites)

    vc_bots = discord.utils.get(cat_stats.voice_channels, name=lambda n: "Bots:" in n or "🤖" in n)
    if not vc_bots:
        await guild.create_voice_channel(f"🤖 Server Bots: {bot_cnt}", category=cat_stats, overwrites=voice_overwrites)

    print(" [2/8] 📊 SERVER STATS -> #server-stats-info & Voice Counters READY")

    # 3. AI & COMMUNITY
    cat_ai = discord.utils.get(guild.categories, name="🤖 AI & COMMUNITY") or await guild.create_category("🤖 AI & COMMUNITY")
    ch_ai = discord.utils.get(guild.text_channels, name="ai-assistant")
    if not ch_ai:
        ch_ai = await guild.create_text_channel("ai-assistant", category=cat_ai, overwrites=everyone_overwrite)
    else:
        await ch_ai.edit(category=cat_ai, overwrites=everyone_overwrite)
    print(" [3/8] 🤖 AI & COMMUNITY -> #ai-assistant READY")

    # 4. SUPPORT TICKETS
    cat_tickets = (
        discord.utils.get(guild.categories, name="🎟️ SUPPORT TICKETS") or 
        discord.utils.get(guild.categories, name="TICKETS") or 
        await guild.create_category("🎟️ SUPPORT TICKETS")
    )
    ch_tickets = discord.utils.get(guild.text_channels, name="tickets") or discord.utils.get(guild.text_channels, name="open-a-ticket")
    if not ch_tickets:
        ch_tickets = await guild.create_text_channel("tickets", category=cat_tickets, overwrites=read_only_overwrite)
    else:
        await ch_tickets.edit(category=cat_tickets, overwrites=read_only_overwrite)
    print(" [4/8] 🎟️ SUPPORT TICKETS -> #tickets READY")

    # 5. LEVELING & XP
    cat_leveling = discord.utils.get(guild.categories, name="🏆 LEVELING & XP") or await guild.create_category("🏆 LEVELING & XP")
    ch_leveling = discord.utils.get(guild.text_channels, name="leaderboard-and-ranks")
    if not ch_leveling:
        ch_leveling = await guild.create_text_channel("leaderboard-and-ranks", category=cat_leveling, overwrites=everyone_overwrite)
    else:
        await ch_leveling.edit(category=cat_leveling, overwrites=everyone_overwrite)
    print(" [5/8] 🏆 LEVELING & XP -> #leaderboard-and-ranks READY")

    # 6. COMMUNITY SUGGESTIONS
    cat_suggest = discord.utils.get(guild.categories, name="💡 COMMUNITY SUGGESTIONS") or await guild.create_category("💡 COMMUNITY SUGGESTIONS")
    ch_suggest = discord.utils.get(guild.text_channels, name="suggestions")
    if not ch_suggest:
        ch_suggest = await guild.create_text_channel("suggestions", category=cat_suggest, overwrites=everyone_overwrite)
    else:
        await ch_suggest.edit(category=cat_suggest, overwrites=everyone_overwrite)
    print(" [6/8] 💡 COMMUNITY SUGGESTIONS -> #suggestions READY")

    # 7. SOCIAL & MARKET FEEDS
    cat_feeds = discord.utils.get(guild.categories, name="📢 SOCIAL & MARKET FEEDS") or await guild.create_category("📢 SOCIAL & MARKET FEEDS")
    ch_feeds = discord.utils.get(guild.text_channels, name="social-feed-updates") or discord.utils.get(guild.text_channels, name="live-market-feeds")
    if not ch_feeds:
        ch_feeds = await guild.create_text_channel("social-feed-updates", category=cat_feeds, overwrites=read_only_overwrite)
    else:
        await ch_feeds.edit(category=cat_feeds, overwrites=read_only_overwrite)
    print(" [7/8] 📢 SOCIAL & MARKET FEEDS -> #social-feed-updates READY")

    # 8. AUTOMOD & SAFETY
    cat_automod = discord.utils.get(guild.categories, name="🛡️ AUTOMOD & SAFETY") or await guild.create_category("🛡️ AUTOMOD & SAFETY")
    ch_automod = discord.utils.get(guild.text_channels, name="automod-logs")
    if not ch_automod:
        ch_automod = await guild.create_text_channel("automod-logs", category=cat_automod, overwrites=read_only_overwrite)
    else:
        await ch_automod.edit(category=cat_automod, overwrites=read_only_overwrite)
    print(" [8/8] 🛡️ AUTOMOD & SAFETY -> #automod-logs READY")

@client.event
async def on_ready():
    print(f"Connected as {client.user.name} (ID: {client.user.id})")
    for g in client.guilds:
        print(f" - Connected Server: '{g.name}' | ID: {g.id}")

    target_guild = discord.utils.get(client.guilds, id=1537457454370128024) or client.guilds[0]
    await setup_visible_channels(target_guild)

    print("\n=========================================================")
    print("  ALL 8 SYSTEM PLUGIN CATEGORIES & CHANNELS CREATED & VISIBLE!  ")
    print("=========================================================")
    await client.close()

client.run(DISCORD_BOT_TOKEN)
