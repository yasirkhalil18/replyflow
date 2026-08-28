import os

token = os.environ.get("DISCORD_BOT_TOKEN", "")
client_id = os.environ.get("DISCORD_CLIENT_ID", "")

commands = [
    {"name": "rank", "description": "Display your custom Canvas rank card & XP progress"},
    {"name": "ticket", "description": "Open the support ticket selection panel"},
    {"name": "suggest", "description": "Submit a community proposal for voting"},
    {"name": "automod", "description": "Configure AI toxicity shield policies"},
    {"name": "ai", "description": "Query the server multi-model AI assistant"},
    {"name": "feed", "description": "Broadcast Social Media Feed Alerts (YouTube, Twitter, Twitch)"},
    {"name": "help", "description": "Display the official Server Member Help Guide"},
    {"name": "welcome", "description": "Trigger or preview welcome banner message"}
]

url = f"https://discord.com/api/v10/applications/{client_id}/commands"

headers = {
    "Authorization": f"Bot {token}",
    "Content-Type": "application/json",
    "User-Agent": "DiscordBot (https://github.com/discord, v1.0.0)"
}

data = json.dumps(commands).encode('utf-8')
req = urllib.request.Request(url, data=data, headers=headers, method='PUT')

try:
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        print(f"SUCCESS: Registered {len(res)} global slash commands with Discord REST API!")
        for cmd in res:
            print(f"  - /{cmd['name']}: {cmd['description']} (ID: {cmd['id']})")
except Exception as e:
    print("ERROR:", e)
