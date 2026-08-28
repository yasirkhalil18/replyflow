'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Rss, Save, ArrowLeft, Plus, Trash2, Send, Radio, Youtube, Twitch, Twitter, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function SocialFeedPluginPage() {
  const { showNotification } = useAppStore();

  const [feeds, setFeeds] = useState([
    { id: '1', platform: 'YouTube', handle: '@CyberpunkOfficial', channelName: '📢┆announcements', pingRole: 'Notifications' },
    { id: '2', platform: 'Twitch', handle: 'CyberStream', channelName: '🔴┆live-stream', pingRole: 'Stream Alerts' },
  ]);

  const [platform, setPlatform] = useState('YouTube');
  const [handle, setHandle] = useState('');

  const handleAddFeed = () => {
    if (!handle.trim()) return;
    setFeeds([
      ...feeds,
      { id: Date.now().toString(), platform, handle: handle.trim(), channelName: '📢┆updates', pingRole: 'Everyone' }
    ]);
    setHandle('');
    showNotification(`Linked ${platform} feed for ${handle}`);
  };

  const handleRemoveFeed = (id: string) => {
    setFeeds(feeds.filter((f) => f.id !== id));
  };

  const handleTestFeed = (platformName: string) => {
    showNotification(`Test webhook dispatched for ${platformName}! Check Discord channel.`, 'info');
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href="/dashboard/plugins" className="p-2 rounded-xl glass-panel hover:bg-white/10 text-slate-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
              <Rss className="w-6 h-6 text-discord-fuchsia" />
              <span>Social Feed Integrator</span>
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">Automatically publish YouTube, Twitch, Twitter/X, and RSS updates with custom embeds.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Link New Feed Form */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          <h3 className="text-base font-bold text-white pb-3 border-b border-white/10">Link Social Channel</h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full bg-discord-card border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-discord-blurple"
              >
                <option value="YouTube">YouTube Channel</option>
                <option value="Twitch">Twitch Live Stream</option>
                <option value="Twitter">Twitter / X Feed</option>
                <option value="Reddit">Subreddit Feed</option>
                <option value="RSS">Custom RSS Feed</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Channel Handle / URL</label>
              <input
                type="text"
                placeholder="e.g. @CyberpunkOfficial or URL"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="w-full bg-discord-card border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-discord-blurple"
              />
            </div>

            <button
              onClick={handleAddFeed}
              className="w-full py-2.5 bg-discord-fuchsia hover:bg-discord-fuchsia/90 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Connect Feed Integration</span>
            </button>
          </div>
        </div>

        {/* Linked Feeds Table */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <h3 className="text-base font-bold text-white">Active Social Feed Pipelines</h3>

          <div className="divide-y divide-white/10">
            {feeds.map((feed) => (
              <div key={feed.id} className="py-4 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-discord-blurple/20 text-discord-blurple text-[10px] font-bold font-mono">
                      {feed.platform}
                    </span>
                    <span className="text-xs font-bold text-white">{feed.handle}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Posting to <strong className="text-slate-200">{feed.channelName}</strong> • Ping Role: {feed.pingRole}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleTestFeed(feed.platform)}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold transition flex items-center space-x-1"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Test Webhook</span>
                  </button>
                  <button
                    onClick={() => handleRemoveFeed(feed.id)}
                    className="p-1.5 rounded-xl hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
