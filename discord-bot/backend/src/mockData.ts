export interface ServerData {
  id: string;
  name: string;
  icon: string;
  ownerId: string;
  memberCount: number;
  onlineCount: number;
  hasBot: boolean;
  tier: 'FREE' | 'PRO' | 'ENTERPRISE';
  joinedAt: string;
}

export interface PluginInfo {
  key: string;
  name: string;
  description: string;
  category: 'Engagement' | 'Moderation' | 'Utility' | 'AI & Feeds' | 'Automation';
  icon: string;
  version: string;
  isPremium: boolean;
  enabled: boolean;
  usageCount: number;
  config: Record<string, any>;
}

export const MOCK_SERVERS: ServerData[] = [
  {
    id: '108273948192847192',
    name: 'Cyberpunk Syndicate 2077',
    icon: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150&auto=format&fit=crop&q=80',
    ownerId: '98471928471928471',
    memberCount: 24890,
    onlineCount: 8420,
    hasBot: true,
    tier: 'ENTERPRISE',
    joinedAt: '2025-01-15T12:00:00Z',
  },
  {
    id: '209384759283748291',
    name: 'Neon Tech Community',
    icon: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
    ownerId: '98471928471928471',
    memberCount: 14200,
    onlineCount: 4120,
    hasBot: true,
    tier: 'PRO',
    joinedAt: '2025-03-10T09:30:00Z',
  },
  {
    id: '304958673928174829',
    name: 'Chill Lounge & Gaming',
    icon: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=150&auto=format&fit=crop&q=80',
    ownerId: '98471928471928471',
    memberCount: 6830,
    onlineCount: 1950,
    hasBot: true,
    tier: 'FREE',
    joinedAt: '2025-05-22T16:45:00Z',
  },
  {
    id: '401928374650192837',
    name: 'Apex Esports League',
    icon: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=150&auto=format&fit=crop&q=80',
    ownerId: '11223344556677889',
    memberCount: 45100,
    onlineCount: 12900,
    hasBot: false, // Bot needs invite
    tier: 'FREE',
    joinedAt: '2025-06-01T10:00:00Z',
  }
];

export const MOCK_PLUGINS: PluginInfo[] = [
  {
    key: 'welcome',
    name: 'Welcome & Auto Role',
    description: 'Custom canvas image welcomes, automated multi-roles, AI welcome text generator, and DM greetings.',
    category: 'Engagement',
    icon: 'Sparkles',
    version: 'v3.4.1',
    isPremium: false,
    enabled: true,
    usageCount: 18450,
    config: {
      welcomeChannelId: '10928374928174',
      dmWelcome: true,
      autoRoles: ['Member', 'Verified'],
      canvasTitle: 'WELCOME TO CYBERPUNK',
      canvasSubtitle: 'We are thrilled to have you here!',
      cardStyle: 'neon-cyber',
      delaySeconds: 0,
      accountAgeCheckDays: 3,
    }
  },
  {
    key: 'leveling',
    name: 'Leveling System',
    description: 'Text & voice XP tracking, prestige levels, interactive canvas rank cards, and web leaderboards.',
    category: 'Engagement',
    icon: 'Award',
    version: 'v2.8.0',
    isPremium: false,
    enabled: true,
    usageCount: 29400,
    config: {
      xpRate: 1.5,
      voiceXpEnabled: true,
      dailyReward: 250,
      roleRewards: [
        { level: 5, role: 'Rookie' },
        { level: 15, role: 'Veteran' },
        { level: 30, role: 'Cyber Lord' }
      ],
      rankCardBg: 'linear-gradient(135deg, #7928CA 0%, #FF0080 100%)',
      antiSpamCooldownSec: 60,
    }
  },
  {
    key: 'tickets',
    name: 'Ticket System',
    description: 'Multi-department ticket routing, interactive modals, HTML/PDF auto-transcripts, and claim workflows.',
    category: 'Utility',
    icon: 'Ticket',
    version: 'v4.1.2',
    isPremium: true,
    enabled: true,
    usageCount: 14200,
    config: {
      panelTitle: 'Support Hub & Inquiries',
      departments: ['Technical Support', 'Billing & Subscriptions', 'Report User', 'Partnerships'],
      categoryChannelId: '90827364510293',
      autoTranscript: true,
      allowClaiming: true,
      autoCloseHours: 48,
    }
  },
  {
    key: 'live-stats',
    name: 'Live Stats Counters',
    description: 'Dynamic voice/text channel statistical counters (Members, Boosts, Online, Active Tickets, Voice Users).',
    category: 'Utility',
    icon: 'BarChart3',
    version: 'v1.9.0',
    isPremium: false,
    enabled: true,
    usageCount: 38200,
    config: {
      updateIntervalMin: 10,
      counters: [
        { type: 'total_members', format: '👥┆Members: {count}' },
        { type: 'online_members', format: '🟢┆Online: {count}' },
        { type: 'server_boosts', format: '🚀┆Boosts: Level {level}' }
      ]
    }
  },
  {
    key: 'automod',
    name: 'Auto Moderation AI',
    description: 'AI Toxicity detection, anti-spam, raid shield, anti-invite, anti-link, anti-caps, and bad word regex.',
    category: 'Moderation',
    icon: 'ShieldAlert',
    version: 'v5.0.0',
    isPremium: true,
    enabled: true,
    usageCount: 42100,
    config: {
      aiToxicityThreshold: 0.85,
      antiLink: true,
      antiInvite: true,
      maxMentions: 5,
      maxCapsPercent: 70,
      actionOnViolation: 'TIMEOUT',
      timeoutDurationMinutes: 15,
      whitelistedRoles: ['Admin', 'Moderator']
    }
  },
  {
    key: 'social-feed',
    name: 'Social Feed Hub',
    description: 'Auto-post updates from YouTube, Twitter/X, Twitch, Reddit, TikTok, and RSS with custom embeds.',
    category: 'AI & Feeds',
    icon: 'Rss',
    version: 'v2.2.0',
    isPremium: false,
    enabled: true,
    usageCount: 11900,
    config: {
      feeds: [
        { platform: 'YouTube', handle: '@CyberpunkOfficial', channelId: '1029384756', pingRole: 'Notifications' },
        { platform: 'Twitch', handle: 'CyberStream', channelId: '1029384757', pingRole: 'Live' }
      ]
    }
  },
  {
    key: 'suggestions',
    name: 'Suggestion Engine',
    description: 'Interactive voting panels, category tagging, staff approval/rejection workflows, and top suggesters.',
    category: 'Engagement',
    icon: 'Lightbulb',
    version: 'v1.6.4',
    isPremium: false,
    enabled: true,
    usageCount: 8900,
    config: {
      suggestionChannelId: '90827364510294',
      anonymousAllowed: true,
      autoThread: true,
      upvoteEmoji: '👍',
      downvoteEmoji: '👎'
    }
  },
  {
    key: 'ai-assistant',
    name: 'AI Smart Assistant',
    description: 'Powered by OpenAI, Gemini, Claude & DeepSeek with server Knowledge Base RAG memory and image analysis.',
    category: 'AI & Feeds',
    icon: 'Bot',
    version: 'v3.0.0',
    isPremium: true,
    enabled: true,
    usageCount: 21500,
    config: {
      defaultModel: 'gpt-4o',
      systemPrompt: 'You are the official Cyberpunk Syndicate AI assistant. Help users politely and concisely.',
      memoryLimit: 10,
      dailyTokenLimit: 50000,
      allowedChannels: ['ai-chat', 'general-lounge']
    }
  }
];

export const MOCK_AUTOMATIONS = [
  {
    id: 'auto-1',
    name: 'VIP Welcome & Direct Onboarding',
    enabled: true,
    runCount: 1240,
    trigger: { type: 'MEMBER_JOIN', condition: 'Account age > 7 days' },
    actions: [
      { step: 1, type: 'ADD_ROLE', payload: { role: 'Cyber Member' } },
      { step: 2, type: 'DELAY', payload: { seconds: 10 } },
      { step: 3, type: 'SEND_EMBED', payload: { channel: 'welcome-hub', title: 'Welcome to the Syndicate!' } },
      { step: 4, type: 'DM_USER', payload: { text: 'Check out #rules and get your custom rank card in #bot-commands!' } }
    ]
  },
  {
    id: 'auto-2',
    name: 'High Toxicity Auto Escalation',
    enabled: true,
    runCount: 382,
    trigger: { type: 'AUTOMOD_FLAG', condition: 'Toxicity > 0.90' },
    actions: [
      { step: 1, type: 'TIMEOUT_USER', payload: { durationMinutes: 60 } },
      { step: 2, type: 'LOG_MODERATION', payload: { channel: 'mod-logs' } },
      { step: 3, type: 'NOTIFY_STAFF', payload: { role: 'Senior Mod' } }
    ]
  }
];
