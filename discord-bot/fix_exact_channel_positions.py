import discord
import asyncio
import os

DISCORD_BOT_TOKEN = os.environ.get("DISCORD_BOT_TOKEN", "")

intents = discord.Intents.all()
client = discord.Client(intents=intents)

@client.event
async def on_ready():
    guild = client.guilds[0]
    print(f"Fixing channel positions for {guild.name}...")

    # 1. WELCOME LOBBY -> #welcome at Pos 0 inside category
    cat_welc = discord.utils.get(guild.categories, name="👋 WELCOME LOBBY") or discord.utils.get(guild.categories, name="WELCOME LOBBY")
    if cat_welc:
        await cat_welc.edit(position=0)
        ch_welc = discord.utils.get(cat_welc.text_channels, name="welcome")
        if ch_welc:
            await ch_welc.edit(position=0)
            print("[OK] Positioned #welcome to position 0 inside WELCOME LOBBY")

    # 2. SERVER STATS -> Voice channels
    cat_stats = discord.utils.get(guild.categories, name="📊 SERVER STATS") or discord.utils.get(guild.categories, name="SERVER STATS")
    if cat_stats:
        await cat_stats.edit(position=1)
        # Delete old duplicate voice channel '# Members: 9'
        old_mem_vc = discord.utils.get(cat_stats.voice_channels, name=lambda n: "Members: 9" in n and "All" not in n)
        if old_mem_vc:
            try:
                await old_mem_vc.delete(reason="Clean up legacy duplicate voice stat channel")
                print("[OK] Deleted legacy duplicate stat channel # Members: 9")
            except Exception as e:
                print("Delete old stat channel error:", e)

    # 3. AI & COMMUNITY -> #ai-assistant at Pos 0
    cat_ai = discord.utils.get(guild.categories, name="🤖 AI & COMMUNITY") or discord.utils.get(guild.categories, name="AI & COMMUNITY")
    if cat_ai:
        await cat_ai.edit(position=2)
        ch_ai = discord.utils.get(cat_ai.text_channels, name="ai-assistant")
        if ch_ai:
            await ch_ai.edit(position=0)
            print("[OK] Positioned #ai-assistant to position 0 inside AI & COMMUNITY")

    # 4. SUPPORT TICKETS -> #tickets or #open-a-ticket at Pos 0
    cat_tickets = discord.utils.get(guild.categories, name="🎟️ SUPPORT TICKETS") or discord.utils.get(guild.categories, name="TICKETS")
    if cat_tickets:
        await cat_tickets.edit(position=3)
        ch_t = discord.utils.get(cat_tickets.text_channels, name="open-a-ticket") or discord.utils.get(cat_tickets.text_channels, name="tickets")
        if ch_t:
            await ch_t.edit(position=0)
            print(f"[OK] Positioned #{ch_t.name} to position 0 inside TICKETS")

    # 5. LEVELING & XP -> #leaderboard-and-ranks at Pos 0
    cat_lvl = discord.utils.get(guild.categories, name="🏆 LEVELING & XP") or discord.utils.get(guild.categories, name="LEVELING & XP")
    if cat_lvl:
        await cat_lvl.edit(position=4)
        ch_lvl = discord.utils.get(cat_lvl.text_channels, name="leaderboard-and-ranks")
        if ch_lvl:
            await ch_lvl.edit(position=0)
            print("[OK] Positioned #leaderboard-and-ranks to position 0 inside LEVELING & XP")

    # 6. COMMUNITY SUGGESTIONS -> #suggestions at Pos 0
    cat_sug = discord.utils.get(guild.categories, name="💡 COMMUNITY SUGGESTIONS") or discord.utils.get(guild.categories, name="COMMUNITY SUGGESTIONS")
    if cat_sug:
        await cat_sug.edit(position=5)
        ch_sug = discord.utils.get(cat_sug.text_channels, name="suggestions")
        if ch_sug:
            await ch_sug.edit(position=0)
            print("[OK] Positioned #suggestions to position 0 inside COMMUNITY SUGGESTIONS")

    # 7. SOCIAL & MARKET FEEDS -> #live-market-feeds at Pos 0
    cat_feed = discord.utils.get(guild.categories, name="📢 SOCIAL & MARKET FEEDS") or discord.utils.get(guild.categories, name="SOCIAL & MARKET FEEDS")
    if cat_feed:
        await cat_feed.edit(position=6)
        ch_feed = discord.utils.get(cat_feed.text_channels, name="live-market-feeds")
        if ch_feed:
            await ch_feed.edit(position=0)
            print("[OK] Positioned #live-market-feeds to position 0 inside SOCIAL & MARKET FEEDS")

    # 8. AUTOMOD & SAFETY -> #automod-logs at Pos 0
    cat_am = discord.utils.get(guild.categories, name="🛡️ AUTOMOD & SAFETY") or discord.utils.get(guild.categories, name="AUTOMOD & SAFETY")
    if cat_am:
        await cat_am.edit(position=7)
        ch_am = discord.utils.get(cat_am.text_channels, name="automod-logs")
        if ch_am:
            await ch_am.edit(position=0)
            print("[OK] Positioned #automod-logs to position 0 inside AUTOMOD & SAFETY")

    print("Channel positions successfully updated!")
    await client.close()

client.run(DISCORD_BOT_TOKEN)
