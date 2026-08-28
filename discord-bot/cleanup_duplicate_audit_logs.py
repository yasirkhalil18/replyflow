import asyncio
import os
import discord
import dotenv

env_path = os.path.join(os.path.dirname(__file__), 'backend', '.env')
dotenv.load_dotenv(env_path)

TOKEN = os.environ.get("DISCORD_BOT_TOKEN", "")
intents = discord.Intents.all()
client = discord.Client(intents=intents)

@client.event
async def on_ready():
    print(f"Logged in as {client.user.name}")
    for guild in client.guilds:
        print(f"\nProcessing Guild: {guild.name} (ID: {guild.id})")
        audit_chans = [ch for ch in guild.text_channels if ch.name.lower() in ["audit-logs", "auditlogs", "security-logs"]]
        print(f"Found {len(audit_chans)} #audit-logs channels.")
        
        if len(audit_chans) > 1:
            print(f"Deleting {len(audit_chans) - 1} duplicate channels...")
            for ch in audit_chans[1:]:
                try:
                    await ch.delete(reason="Deleting duplicate #audit-logs channel")
                    print(f" -> 🗑️ Deleted channel: {ch.name} (ID: {ch.id})")
                    await asyncio.sleep(0.5)
                except Exception as e:
                    print(f" -> Delete error: {e}")
        else:
            print(" -> Channel count is clean (1 channel).")

    print("\nCleanup completed!")
    await client.close()

if __name__ == "__main__":
    client.run(TOKEN)
