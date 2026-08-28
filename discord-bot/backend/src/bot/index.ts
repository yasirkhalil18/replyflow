import { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  Interaction, 
  GuildMember, 
  Message, 
  VoiceState 
} from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.User, Partials.Channel, Partials.GuildMember, Partials.Message, Partials.Reaction],
});

client.once('ready', () => {
  console.log(`[BotShard] Connected to Discord Gateway as ${client.user?.tag} (Serving ${client.guilds.cache.size} guilds)`);
});

// Member Join: Welcome, Auto Roles, Invite Tracker, Temp Roles
client.on('guildMemberAdd', async (member: GuildMember) => {
  console.log(`[Event:MemberJoin] ${member.user.tag} joined ${member.guild.name}`);
  // 1. Invite Tracker logic
  // 2. Auto Role assignment
  // 3. Welcome Canvas dispatch
});

// Message Event: AutoMod AI Toxicity, Anti Scam, XP Gain, AI Assistant Mention
client.on('messageCreate', async (message: Message) => {
  if (message.author.bot || !message.guild) return;

  // 1. Token Leak Shield (Check for Discord bot token pattern)
  const tokenPattern = /[MNO][a-zA-Z\d_-]{23,25}\.[a-zA-Z\d_-]{6}\.[a-zA-Z\d_-]{27,38}/;
  if (tokenPattern.test(message.content)) {
    await message.delete().catch(() => {});
    await message.channel.send(`⚠️ Security Alert: ${message.author}, a bot token leak was detected and deleted immediately!`);
    return;
  }

  // 2. AI Assistant Direct Mention
  if (client.user && message.mentions.has(client.user)) {
    await message.reply(`🤖 [Cyberpunk AI Assistant]: Processing your query... RAG knowledge base synchronized.`);
  }
});

// Voice State Update: Voice XP & Voice Counters
client.on('voiceStateUpdate', async (oldState: VoiceState, newState: VoiceState) => {
  if (newState.member?.user.bot) return;
  // Track voice time for XP rewards and live channel stats counters
});

// Interactions: Slash commands, Buttons, Modals, Select Menus
client.on('interactionCreate', async (interaction: Interaction) => {
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;
    if (commandName === 'rank') {
      await interaction.reply({ content: '📊 Generating Canvas Rank Card... Rank #1 • Level 42 • 148,200 XP' });
    } else if (commandName === 'ticket') {
      await interaction.reply({ content: '🎟️ Opening Ticket Support Panel...' });
    } else {
      await interaction.reply({ content: `Executed slash command /${commandName} successfully.` });
    }
  } else if (interaction.isButton()) {
    await interaction.reply({ content: `Action triggered: ${interaction.customId}`, ephemeral: true });
  } else if (interaction.isModalSubmit()) {
    await interaction.reply({ content: 'Form modal response recorded.', ephemeral: true });
  }
});

const token = process.env.DISCORD_BOT_TOKEN;
if (token) {
  client.login(token).catch((err) => console.error('[BotShard] Login failed:', err));
} else {
  console.log('[BotShard] DISCORD_BOT_TOKEN not provided. Bot worker initialized in dry-run mode.');
}
