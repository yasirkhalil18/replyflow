# REST API & Plugin SDK Developer Documentation

Documentation for REST API endpoints (`/api/v1`), WebSocket events (`ws://`), and Third-Party Plugin SDK development.

---

## 📡 REST API Specification

### 1. Fetch Active Server List
`GET /api/v1/guilds`
- **Response**: Array of registered `Guild` records.

### 2. Update Plugin Toggle State
`POST /api/v1/guilds/{guildId}/plugins/{pluginKey}/toggle`
- **Payload**: `{ "enabled": true }`
- **Response**: Updated `PluginSettings` JSON object.

### 3. Execute AI Assistant Prompt
`POST /api/v1/ai/chat`
- **Payload**:
  ```json
  {
    "message": "What are the server giveaway rules?",
    "model": "gpt-4o"
  }
  ```

---

## 🔌 Plugin SDK Lifecycle API

Third-party plugins extend `DiscordPlugin`:

```typescript
import { DiscordPlugin, PluginManifest, PluginContext } from '@discord-automation/plugin-sdk';

export default class MyPlugin extends DiscordPlugin {
  public manifest: PluginManifest = {
    key: 'custom-moderation',
    name: 'Custom Moderation Helper',
    version: '1.0.0',
    description: 'Custom guild moderation rules',
    author: 'Developer',
    category: 'Moderation',
    icon: '🛡️',
    permissions: ['MANAGE_MESSAGES', 'TIMEOUT_MEMBERS']
  };

  public override async onEnable(ctx: PluginContext): Promise<void> {
    ctx.logger.info(`Enabled on guild ${ctx.guildId}`);
  }

  public override registerSlashCommands() {
    return [
      {
        name: 'custom-mod',
        description: 'Execute custom moderation rule',
      }
    ];
  }
}
```

### CLI Generator Command:
```bash
npx create-discord-plugin my-custom-plugin
```
