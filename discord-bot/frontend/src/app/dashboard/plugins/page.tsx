'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/store/useAppStore';
import { 
  Search, 
  Sparkles, 
  Award, 
  Ticket, 
  BarChart3, 
  ShieldAlert, 
  Rss, 
  Lightbulb, 
  Bot, 
  Check, 
  Power, 
  Settings, 
  ArrowRight,
  Zap,
  Star,
  Layers
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Sparkles,
  Award,
  Ticket,
  BarChart3,
  ShieldAlert,
  Rss,
  Lightbulb,
  Bot,
  Zap,
  Star,
  Layers
};

const INITIAL_PLUGINS = [
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
    route: '/dashboard/plugins/welcome',
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
    route: '/dashboard/plugins/leveling',
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
    route: '/dashboard/plugins/tickets',
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
    route: '/dashboard/plugins/live-stats',
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
    route: '/dashboard/plugins/automod',
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
    route: '/dashboard/plugins/social-feed',
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
    route: '/dashboard/plugins/suggestions',
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
    route: '/dashboard/plugins/ai-assistant',
  },
  {
    key: 'reaction-roles',
    name: 'Reaction Roles',
    description: 'Self-assignable roles using button groups, select menus, and animated custom emoji menus.',
    category: 'Engagement',
    icon: 'Star',
    version: 'v2.1.0',
    isPremium: false,
    enabled: false,
    usageCount: 15300,
    route: '/dashboard/plugins/welcome',
  },
  {
    key: 'giveaways',
    name: 'Giveaways Engine',
    description: 'Host automated giveaways with role requirements, level checks, and instant randomized winner picking.',
    category: 'Engagement',
    icon: 'Zap',
    version: 'v1.4.0',
    isPremium: false,
    enabled: false,
    usageCount: 9200,
    route: '/dashboard/plugins/welcome',
  }
];

export default function PluginsPage() {
  const { showNotification } = useAppStore();
  const [plugins, setPlugins] = useState(INITIAL_PLUGINS);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = ['All', 'Engagement', 'Moderation', 'Utility', 'AI & Feeds'];

  const togglePluginState = (key: string) => {
    setPlugins((prev) =>
      prev.map((p) => {
        if (p.key === key) {
          const nextState = !p.enabled;
          showNotification(
            `${p.name} ${nextState ? 'enabled' : 'disabled'} successfully`,
            nextState ? 'success' : 'info'
          );
          return { ...p, enabled: nextState };
        }
        return p;
      })
    );
  };

  const filteredPlugins = plugins.filter((plugin) => {
    const matchesSearch =
      plugin.name.toLowerCase().includes(search.toLowerCase()) ||
      plugin.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || plugin.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Plugin Marketplace</h1>
          <p className="text-slate-400 text-xs mt-1">
            Modular feature extensions. Enable or disable plugins on the fly with zero bot restart required.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search plugins (e.g. Ticket, AI, Canvas)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-discord-card border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-discord-blurple transition"
          />
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap border ${
              selectedCategory === cat
                ? 'bg-discord-blurple text-white border-discord-blurple shadow-md shadow-discord-blurple/25'
                : 'glass-panel text-slate-400 border-white/10 hover:text-white hover:bg-white/5'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Plugin Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPlugins.map((plugin) => {
          const IconComponent = ICON_MAP[plugin.icon] || Sparkles;
          return (
            <div
              key={plugin.key}
              className={`glass-panel p-6 rounded-2xl border transition flex flex-col justify-between relative overflow-hidden group ${
                plugin.enabled
                  ? 'border-discord-blurple/40 shadow-lg shadow-discord-blurple/10'
                  : 'border-white/10 opacity-75 hover:opacity-100'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      plugin.enabled ? 'bg-discord-blurple/20 text-discord-blurple' : 'bg-white/5 text-slate-400'
                    }`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white leading-tight">{plugin.name}</h3>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="text-[10px] font-mono text-slate-400">{plugin.version}</span>
                        {plugin.isPremium && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-discord-yellow/20 text-discord-yellow border border-discord-yellow/30 uppercase">
                            PREMIUM
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={() => togglePluginState(plugin.key)}
                    className={`w-12 h-6.5 rounded-full p-1 transition-colors flex items-center ${
                      plugin.enabled ? 'bg-discord-green justify-end' : 'bg-slate-700 justify-start'
                    }`}
                  >
                    <span className="w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform" />
                  </button>
                </div>

                <p className="text-slate-400 text-xs leading-relaxed mb-6">
                  {plugin.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10 mt-auto">
                <span className="text-[11px] font-medium text-slate-500">
                  {plugin.usageCount.toLocaleString()} active servers
                </span>

                <Link
                  href={plugin.route}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-discord-blurple hover:text-white text-slate-200 transition flex items-center space-x-1"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Configure</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
