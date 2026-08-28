#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const pluginName = args[0] || 'my-custom-plugin';

console.log(`🚀 Creating Discord Automation Cloud Plugin scaffold: ${pluginName}`);

const targetDir = path.join(process.cwd(), pluginName);

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const manifestContent = {
  key: pluginName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
  name: pluginName,
  version: '1.0.0',
  description: 'A third-party custom plugin for Discord Automation SaaS.',
  author: 'Developer',
  category: 'Custom',
  icon: '🔌',
  permissions: ['SEND_MESSAGES', 'MANAGE_ROLES'],
};

const pluginCode = `import { DiscordPlugin, PluginManifest, PluginContext } from '@discord-automation/plugin-sdk';

export default class CustomPlugin extends DiscordPlugin {
  public manifest: PluginManifest = ${JSON.stringify(manifestContent, null, 2)};

  public override async onEnable(ctx: PluginContext): Promise<void> {
    ctx.logger.info('${pluginName} has been enabled on guild: ' + ctx.guildId);
  }

  public override registerSlashCommands() {
    return [
      {
        name: '${manifestContent.key}',
        description: 'Execute custom command from ${pluginName}',
      }
    ];
  }
}
`;

fs.writeFileSync(path.join(targetDir, 'plugin.manifest.json'), JSON.stringify(manifestContent, null, 2));
fs.writeFileSync(path.join(targetDir, 'index.ts'), pluginCode);

console.log(`✅ Plugin scaffold created successfully in ./${pluginName}`);
console.log(`👉 Build and publish your plugin to the SaaS marketplace using: npx discord-plugin publish`);
