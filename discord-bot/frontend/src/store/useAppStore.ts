import { create } from 'zustand';

export interface Server {
  id: string;
  name: string;
  icon: string;
  ownerId: string;
  memberCount: number;
  onlineCount: number;
  hasBot: boolean;
  tier: 'FREE' | 'PRO' | 'ENTERPRISE';
}

export interface Plugin {
  key: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  version: string;
  isPremium: boolean;
  enabled: boolean;
  usageCount: number;
  config: Record<string, any>;
}

interface AppState {
  currentGuild: Server | null;
  guilds: Server[];
  plugins: Plugin[];
  searchQuery: string;
  selectedCategory: string;
  notification: { message: string; type: 'success' | 'info' | 'error' } | null;
  setCurrentGuild: (guild: Server) => void;
  setGuilds: (guilds: Server[]) => void;
  setPlugins: (plugins: Plugin[]) => void;
  togglePlugin: (key: string) => void;
  updatePluginConfig: (key: string, newConfig: Record<string, any>) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;
  showNotification: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentGuild: {
    id: '1330964283198013461',
    name: 'NIT- NOIR INSIGHT TRADER',
    icon: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150&auto=format&fit=crop&q=80',
    ownerId: '1313432521215705121',
    memberCount: 9,
    onlineCount: 3,
    hasBot: true,
    tier: 'ENTERPRISE',
  },
  guilds: [
    {
      id: '1330964283198013461',
      name: 'NIT- NOIR INSIGHT TRADER',
      icon: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150&auto=format&fit=crop&q=80',
      ownerId: '1313432521215705121',
      memberCount: 9,
      onlineCount: 3,
      hasBot: true,
      tier: 'ENTERPRISE',
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
    }
  ],
  plugins: [],
  searchQuery: '',
  selectedCategory: 'All',
  notification: null,
  setCurrentGuild: (guild) => set({ currentGuild: guild }),
  setGuilds: (guilds) => set({ guilds }),
  setPlugins: (plugins) => set({ plugins }),
  togglePlugin: (key) =>
    set((state) => {
      const updated = state.plugins.map((p) =>
        p.key === key ? { ...p, enabled: !p.enabled } : p
      );
      const target = updated.find(p => p.key === key);
      if (target) {
        fetch('/api/plugins/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guild_id: state.currentGuild?.id || '1330964283198013461',
            plugin_key: key,
            enabled: target.enabled,
            config: target.config
          })
        }).catch(err => console.error("API sync error:", err));
      }
      return { plugins: updated };
    }),
  updatePluginConfig: (key, newConfig) =>
    set((state) => {
      const updated = state.plugins.map((p) =>
        p.key === key ? { ...p, config: { ...p.config, ...newConfig } } : p
      );
      const target = updated.find(p => p.key === key);
      if (target) {
        fetch('/api/plugins/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guild_id: state.currentGuild?.id || '1330964283198013461',
            plugin_key: key,
            enabled: target.enabled,
            config: target.config
          })
        }).catch(err => console.error("API sync error:", err));
      }
      return { plugins: updated };
    }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  showNotification: (message, type = 'success') => {
    set({ notification: { message, type } });
    setTimeout(() => set({ notification: null }), 4000);
  },
}));
