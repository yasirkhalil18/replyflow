import asyncio
import os
import sys
import discord
from dotenv import load_dotenv

sys.path.append(os.path.dirname(__file__))
import database
import bot_service

load_dotenv()
token = os.getenv('DISCORD_BOT_TOKEN') or os.getenv('DISCORD_TOKEN')

intents = discord.Intents.default()
intents.guilds = True
intents.members = True
intents.presences = True

client = discord.Client(intents=intents)

@client.event
async def on_ready():
    print(f"Connected to Discord as {client.user} ({client.user.id})")
    for guild in client.guilds:
        print(f"Syncing Live Stats for Guild: {guild.name} (ID: {guild.id})...")
        await bot_service.update_live_stats(guild, force=True)
        print(f"✅ Live Stats Synced for '{guild.name}'!")
    await client.close()

if __name__ == '__main__':
    if token:
        client.run(token)
    else:
        print("Error: No DISCORD_BOT_TOKEN found in environment!")
