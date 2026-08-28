import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const commands = [
  new SlashCommandBuilder().setName('rank').setDescription('Display your custom Canvas rank card & XP progress'),
  new SlashCommandBuilder().setName('ticket').setDescription('Open the support ticket selection panel'),
  new SlashCommandBuilder().setName('suggest').setDescription('Submit a community proposal for voting'),
  new SlashCommandBuilder().setName('automod').setDescription('Configure AI toxicity shield policies'),
  new SlashCommandBuilder().setName('ai').setDescription('Query the server multi-model AI assistant'),
].map((cmd) => cmd.toJSON());

export async function deployGlobalSlashCommands() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token || !clientId) {
    console.log('[DeployCommands] DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID missing. Dry run mode passed.');
    return { success: true, count: commands.length, dryRun: true };
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log(`[DeployCommands] Registering ${commands.length} global slash commands with Discord REST API...`);
    const data = await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log(`[DeployCommands] Successfully reloaded global application slash commands.`);
    return { success: true, count: commands.length, dryRun: false };
  } catch (error) {
    console.error('[DeployCommands Error]', error);
    throw error;
  }
}

if (require.main === module) {
  deployGlobalSlashCommands();
}
